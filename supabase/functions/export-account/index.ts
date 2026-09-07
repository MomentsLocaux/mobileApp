import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const EXPORT_TTL_HOURS = 24;
const MIN_HOURS_BETWEEN_REQUESTS = 1;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const selectMaybe = async (
  supabase: ReturnType<typeof createClient>,
  table: string,
  columns: string,
  filter: { column: string; value: string },
) => {
  const { data, error } = await supabase.from(table).select(columns).eq(filter.column, filter.value);
  if (error) {
    console.log('[export-account] skip table', { table, message: error.message });
    return [];
  }
  return data ?? [];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, message: 'Méthode non autorisée.' }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ success: false, message: 'Configuration serveur manquante.' }, 500);
  }

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  if (!token) {
    return json({ success: false, message: 'Authentification requise.' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return json({ success: false, message: 'Utilisateur invalide.' }, 401);
  }

  const since = new Date(Date.now() - MIN_HOURS_BETWEEN_REQUESTS * 60 * 60 * 1000).toISOString();
  const { data: recentReady } = await supabase
    .from('account_export_requests')
    .select('id, status, storage_path, created_at, ready_at, expires_at')
    .eq('user_id', user.id)
    .eq('status', 'ready')
    .gt('expires_at', new Date().toISOString())
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentReady?.storage_path) {
    const { data: existing } = await supabase.storage
      .from('account-exports')
      .download(recentReady.storage_path);
    let isV2 = false;
    if (existing) {
      try {
        const parsed = JSON.parse(await existing.text());
        isV2 = parsed?.format === 'moments-locaux-account-export-v2';
      } catch {
        isV2 = false;
      }
    }
    if (isV2) {
      const { data: signed } = await supabase.storage
        .from('account-exports')
        .createSignedUrl(recentReady.storage_path, EXPORT_TTL_HOURS * 3600);
      if (signed?.signedUrl) {
        return json({
          success: true,
          reused: true,
          request_id: recentReady.id,
          status: 'ready',
          download_url: signed.signedUrl,
          expires_at: recentReady.expires_at,
          created_at: recentReady.created_at,
        });
      }
    }
  }

  const requestId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPORT_TTL_HOURS * 60 * 60 * 1000);

  const { error: insertError } = await supabase.from('account_export_requests').insert({
    id: requestId,
    user_id: user.id,
    status: 'pending',
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
  if (insertError) {
    console.log('[export-account] insert request error', insertError);
    return json({ success: false, message: 'Impossible de créer la demande d’export.' }, 500);
  }

  try {
    const [
      profile,
      preferences,
      createdEvents,
      likes,
      favorites,
      followsOut,
      followsIn,
      interests,
      checkins,
      comments,
      corrections,
      mediaSubmissions,
    ] = await Promise.all([
      selectMaybe(
        supabase,
        'profiles',
        'id, display_name, city, bio, avatar_url, cover_url, created_at',
        { column: 'id', value: user.id },
      ),
      selectMaybe(
        supabase,
        'user_preferences',
        'user_id, push_enabled, email_enabled, notify_event_nearby, notify_proximity_live, notify_social, notify_radius_km, notify_frequency, notify_event_reminders, location_visibility, quiet_hours_start, quiet_hours_end, preferred_category_slugs, updated_at',
        { column: 'user_id', value: user.id },
      ),
      selectMaybe(supabase, 'events', 'id, title, description, city, address, starts_at, ends_at, status, visibility, submission_source, created_at', {
        column: 'creator_id',
        value: user.id,
      }),
      selectMaybe(supabase, 'event_likes', 'event_id, created_at', { column: 'user_id', value: user.id }),
      selectMaybe(supabase, 'favorites', 'event_id, created_at', { column: 'profile_id', value: user.id }),
      selectMaybe(supabase, 'follows', 'following, created_at', { column: 'follower', value: user.id }),
      selectMaybe(supabase, 'follows', 'follower, created_at', { column: 'following', value: user.id }),
      selectMaybe(supabase, 'event_interests', 'event_id, created_at', { column: 'user_id', value: user.id }),
      selectMaybe(supabase, 'event_checkins', 'event_id, created_at', { column: 'user_id', value: user.id }),
      selectMaybe(supabase, 'event_comments', 'id, event_id, content, created_at', { column: 'user_id', value: user.id }),
      selectMaybe(supabase, 'event_correction_proposals', 'id, event_id, kind, status, created_at', {
        column: 'author_id',
        value: user.id,
      }),
      selectMaybe(supabase, 'event_media_submissions', 'id, event_id, status, created_at', {
        column: 'author_id',
        value: user.id,
      }),
    ]);

    const preferenceRow = (preferences[0] ?? null) as Record<string, unknown> | null;
    let homeLocation: { lat: number; lon: number } | null = null;
    const { data: coords } = await supabase.rpc('get_home_location_coords', { p_user_id: user.id });
    if (coords && typeof coords === 'object') {
      const lat = Number((coords as { lat?: unknown }).lat);
      const lon = Number((coords as { lon?: unknown }).lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        homeLocation = { lat, lon };
      }
    }

    const payload = {
      exported_at: now.toISOString(),
      format: 'moments-locaux-account-export-v2',
      account: {
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at ?? null,
      },
      profile: profile[0] ?? null,
      preferences: preferenceRow
        ? {
            ...preferenceRow,
            home_location: homeLocation,
          }
        : null,
      events_created: createdEvents,
      likes,
      favorites,
      following: followsOut,
      followers: followsIn,
      interests,
      checkins,
      comments,
      correction_proposals: corrections,
      media_submissions: mediaSubmissions,
    };

    const storagePath = `${user.id}/${requestId}.json`;
    const blob = JSON.stringify(payload, null, 2);
    const { error: uploadError } = await supabase.storage
      .from('account-exports')
      .upload(storagePath, blob, { contentType: 'application/json', upsert: true });
    if (uploadError) {
      throw uploadError;
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from('account-exports')
      .createSignedUrl(storagePath, EXPORT_TTL_HOURS * 3600);
    if (signedError || !signed?.signedUrl) {
      throw signedError ?? new Error('signed url missing');
    }

    await supabase
      .from('account_export_requests')
      .update({
        status: 'ready',
        storage_path: storagePath,
        ready_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', requestId);

    return json({
      success: true,
      reused: false,
      request_id: requestId,
      status: 'ready',
      download_url: signed.signedUrl,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
    });
  } catch (error) {
    console.log('[export-account] failed', error);
    await supabase
      .from('account_export_requests')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'export failed',
      })
      .eq('id', requestId);
    return json({ success: false, message: 'Préparation de l’export impossible.' }, 500);
  }
});
