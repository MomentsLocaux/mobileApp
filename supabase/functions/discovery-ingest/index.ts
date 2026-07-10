import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLUSTER_RADIUS_METERS = 120;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type IngestVisit = {
  clientVisitId: string;
  arrivedAt: string;
  departedAt?: string;
  latitude: number;
  longitude: number;
  durationMinutes?: number;
  transportMode?: 'walking' | 'cycling' | 'driving' | 'stationary' | 'transit' | 'unknown';
  confidence?: number;
};

type IngestPayload = {
  consentVersion?: string;
  visits: IngestVisit[];
};

type PlaceRow = {
  id: string;
  centroid_latitude: number;
  centroid_longitude: number;
  visit_count: number;
  radius_meters: number;
  total_duration_minutes: number;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidVisit(visit: IngestVisit): boolean {
  return (
    typeof visit.clientVisitId === 'string' &&
    visit.clientVisitId.trim().length > 0 &&
    typeof visit.arrivedAt === 'string' &&
    Number.isFinite(visit.latitude) &&
    Number.isFinite(visit.longitude) &&
    visit.latitude >= -90 &&
    visit.latitude <= 90 &&
    visit.longitude >= -180 &&
    visit.longitude <= 180
  );
}

function findMatchingPlace(places: PlaceRow[], lat: number, lon: number): PlaceRow | null {
  let best: PlaceRow | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const place of places) {
    const distance = haversineMeters(lat, lon, place.centroid_latitude, place.centroid_longitude);
    const threshold = Math.max(CLUSTER_RADIUS_METERS, place.radius_meters ?? CLUSTER_RADIUS_METERS);
    if (distance <= threshold && distance < bestDistance) {
      best = place;
      bestDistance = distance;
    }
  }

  return best;
}

async function loadPlaces(admin: SupabaseClient, userId: string): Promise<PlaceRow[]> {
  const { data, error } = await admin
    .from('discovery_places')
    .select('id, centroid_latitude, centroid_longitude, visit_count, radius_meters, total_duration_minutes')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false })
    .limit(250);

  if (error) throw new Error(error.message);
  return (data ?? []) as PlaceRow[];
}

async function upsertPlaceForVisit(
  admin: SupabaseClient,
  userId: string,
  visit: IngestVisit,
  places: PlaceRow[],
): Promise<{ placeId: string; places: PlaceRow[] }> {
  const existing = findMatchingPlace(places, visit.latitude, visit.longitude);
  const duration = Math.max(0, visit.durationMinutes ?? 0);
  const arrivedAt = new Date(visit.arrivedAt).toISOString();

  if (existing) {
    const nextVisitCount = existing.visit_count + 1;
    const nextLat =
      (existing.centroid_latitude * existing.visit_count + visit.latitude) / nextVisitCount;
    const nextLon =
      (existing.centroid_longitude * existing.visit_count + visit.longitude) / nextVisitCount;

    const { error } = await admin
      .from('discovery_places')
      .update({
        centroid_latitude: nextLat,
        centroid_longitude: nextLon,
        location: { type: 'Point', coordinates: [nextLon, nextLat] },
        visit_count: nextVisitCount,
        total_duration_minutes: existing.total_duration_minutes + duration,
        last_seen_at: arrivedAt,
        is_new: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);

    const updated: PlaceRow = {
      ...existing,
      centroid_latitude: nextLat,
      centroid_longitude: nextLon,
      visit_count: nextVisitCount,
    };

    return {
      placeId: existing.id,
      places: places.map((place) => (place.id === existing.id ? updated : place)),
    };
  }

  const label = `Lieu découvert n°${places.length + 1}`;
  const { data, error } = await admin
    .from('discovery_places')
    .insert({
      user_id: userId,
      location: { type: 'Point', coordinates: [visit.longitude, visit.latitude] },
      centroid_latitude: visit.latitude,
      centroid_longitude: visit.longitude,
      radius_meters: CLUSTER_RADIUS_METERS,
      place_type: 'discovered',
      confidence: Math.min(1, Math.max(0, visit.confidence ?? 0.5)),
      label,
      first_seen_at: arrivedAt,
      last_seen_at: arrivedAt,
      visit_count: 1,
      total_duration_minutes: duration,
      is_new: true,
      metadata: { source: 'discovery-ingest-v1' },
    })
    .select('id, centroid_latitude, centroid_longitude, visit_count, radius_meters, total_duration_minutes')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'place_insert_failed');

  const created = data as PlaceRow;
  return { placeId: created.id, places: [created, ...places] };
}

async function ingestVisit(
  admin: SupabaseClient,
  userId: string,
  visit: IngestVisit,
  places: PlaceRow[],
): Promise<{ placeId: string; places: PlaceRow[]; skipped: boolean }> {
  const { data: existingVisit, error: existingError } = await admin
    .from('discovery_visits')
    .select('id')
    .eq('user_id', userId)
    .eq('client_visit_id', visit.clientVisitId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existingVisit) {
    return { placeId: '', places, skipped: true };
  }

  const { placeId, places: nextPlaces } = await upsertPlaceForVisit(admin, userId, visit, places);
  const departedAt = visit.departedAt ? new Date(visit.departedAt).toISOString() : null;

  const { error: visitError } = await admin.from('discovery_visits').insert({
    user_id: userId,
    place_id: placeId,
    client_visit_id: visit.clientVisitId,
    arrived_at: new Date(visit.arrivedAt).toISOString(),
    departed_at: departedAt,
    duration_minutes: visit.durationMinutes ?? null,
    transport_mode: visit.transportMode ?? 'unknown',
    confidence: Math.min(1, Math.max(0, visit.confidence ?? 0.5)),
    source: 'passive',
    metadata: { source: 'discovery-ingest-v1' },
  });

  if (visitError) throw new Error(visitError.message);
  return { placeId, places: nextPlaces, skipped: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, message: 'method_not_allowed' }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ success: false, message: 'server_misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return json({ success: false, message: 'authentication_required' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ success: false, message: 'invalid_user' }, 401);
  }

  const userId = userData.user.id;

  const { data: consent, error: consentError } = await admin
    .from('discovery_consents')
    .select('enabled, location_enabled, consent_version')
    .eq('user_id', userId)
    .maybeSingle();

  if (consentError) {
    return json({ success: false, message: 'consent_lookup_failed' }, 500);
  }

  if (!consent?.enabled || !consent.location_enabled) {
    return json({ success: false, message: 'location_consent_required' }, 403);
  }

  let body: IngestPayload;
  try {
    body = (await req.json()) as IngestPayload;
  } catch {
    return json({ success: false, message: 'invalid_json' }, 400);
  }

  if (!Array.isArray(body.visits) || body.visits.length === 0) {
    return json({ success: false, message: 'visits_required' }, 400);
  }

  if (body.visits.length > 20) {
    return json({ success: false, message: 'batch_too_large' }, 400);
  }

  if (
    body.consentVersion &&
    consent.consent_version &&
    body.consentVersion !== consent.consent_version
  ) {
    return json({ success: false, message: 'consent_version_mismatch' }, 409);
  }

  const validVisits = body.visits.filter(isValidVisit);
  if (validVisits.length === 0) {
    return json({ success: false, message: 'no_valid_visits' }, 400);
  }

  let places = await loadPlaces(admin, userId);
  let inserted = 0;
  let skipped = 0;
  const placeIds: string[] = [];

  for (const visit of validVisits) {
    const result = await ingestVisit(admin, userId, visit, places);
    places = result.places;
    if (result.skipped) {
      skipped += 1;
      continue;
    }
    inserted += 1;
    if (result.placeId) placeIds.push(result.placeId);
  }

  return json({
    success: true,
    user_id: userId,
    received: validVisits.length,
    inserted,
    skipped,
    place_ids: placeIds,
  });
});
