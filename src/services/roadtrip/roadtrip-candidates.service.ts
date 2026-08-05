import { supabase } from '@/lib/supabase/client';
import type { EventWithCreator } from '@/types/database';
import { fetchRoadtripEventPool } from '@/screens/roadtrip/roadtrip-candidate-fetch';
import { corridorHalfWidthKm, downsampleLine } from '@/screens/roadtrip/roadtrip-geo';
import type { RoadtripLeg } from '@/screens/roadtrip/roadtrip.types';

/** Hard cap accepted by the RPC (validated server-side too). */
const MAX_ROUTE_POINTS = 800;
const RPC_LIMIT = 200;

type CandidateRow = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  category: string | null;
  category_slug: string | null;
  category_icon: string | null;
  tags: string[] | null;
  starts_at: string;
  ends_at: string | null;
  schedule_mode: string | null;
  operating_hours: unknown;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  venue_name: string | null;
  is_free: boolean;
  price: number | null;
  status: string;
  visibility: string;
  creator_id: string;
  creator_display_name: string | null;
  creator_avatar_url: string | null;
  distance_to_route_m: number;
};

const isMissingRpc = (error: unknown): boolean => {
  const code = String((error as { code?: string })?.code || '');
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    (message.includes('function') && message.includes('does not exist')) ||
    message.includes('could not find the function')
  );
};

const rowToEvent = (row: CandidateRow): EventWithCreator =>
  ({
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    cover_url: row.cover_url,
    category: row.category,
    tags: row.tags ?? [],
    starts_at: row.starts_at,
    ends_at: row.ends_at ?? row.starts_at,
    schedule_mode: row.schedule_mode,
    operating_hours: row.operating_hours ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address ?? '',
    city: row.city,
    postal_code: row.postal_code,
    venue_name: row.venue_name,
    is_free: row.is_free,
    price: row.price,
    status: row.status,
    visibility: row.visibility,
    creator_id: row.creator_id,
    creator: {
      id: row.creator_id,
      display_name: row.creator_display_name ?? '',
      avatar_url: row.creator_avatar_url,
    },
  }) as unknown as EventWithCreator;

export type RoadtripCandidateQuery = {
  legs: RoadtripLeg[];
  detourBudgetMinutes: number;
  windowStart: string;
  windowEnd: string;
  categoryIds: string[];
  freeOnly: boolean;
};

/**
 * Candidate pool along the route.
 *
 * Primary path: `list_roadtrip_event_candidates` — PostGIS corridor
 * (ST_DWithin on the whole route geometry) + coarse journey time window,
 * filtered server-side. Falls back to the bbox viewport fetch when the RPC is
 * not deployed yet, so the spike keeps working on any environment. Precise
 * per-leg passage times and ranking always run client-side afterwards.
 */
export async function fetchRoadtripCandidatePool(
  query: RoadtripCandidateQuery,
): Promise<EventWithCreator[]> {
  const { legs, detourBudgetMinutes, windowStart, windowEnd, categoryIds, freeOnly } = query;

  const fullLine = legs.flatMap((leg, index) =>
    index === 0 ? leg.geometry : leg.geometry.slice(1),
  );
  if (fullLine.length < 2) return [];

  const routeGeoJson = JSON.stringify({
    type: 'LineString',
    coordinates: downsampleLine(fullLine, MAX_ROUTE_POINTS),
  });

  try {
    const { data, error } = await supabase.rpc('list_roadtrip_event_candidates', {
      p_route_geojson: routeGeoJson,
      p_corridor_m: Math.round(corridorHalfWidthKm(detourBudgetMinutes) * 1000),
      p_window_start: windowStart,
      p_window_end: windowEnd,
      p_categories: categoryIds.length > 0 ? categoryIds : null,
      p_free_only: freeOnly,
      p_limit: RPC_LIMIT,
    });
    if (error) throw error;
    return ((data ?? []) as CandidateRow[]).map(rowToEvent);
  } catch (error) {
    if (!isMissingRpc(error)) throw error;
    console.warn('[roadtrip] corridor RPC unavailable — falling back to bbox viewport', error);
    return fetchRoadtripEventPool({ legs, detourBudgetMinutes });
  }
}
