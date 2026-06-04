import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const storageMarker = '/storage/v1/object/public/';
const buckets = ['avatar', 'avatars', 'event-media', 'public'];

const pathFromPublicUrl = (url?: string | null, bucket?: string) => {
  if (!url || !bucket) return null;
  const marker = `${storageMarker}${bucket}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const path = decodeURIComponent(url.slice(index + marker.length).split('?')[0] ?? '');
  return path || null;
};

const collectPath = (paths: Record<string, Set<string>>, url?: string | null) => {
  for (const bucket of buckets) {
    const path = pathFromPublicUrl(url, bucket);
    if (path) paths[bucket].add(path);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Méthode non autorisée.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ success: false, message: 'Configuration serveur manquante.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return new Response(JSON.stringify({ success: false, message: 'Authentification requise.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return new Response(JSON.stringify({ success: false, message: 'Utilisateur invalide.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const storagePaths: Record<string, Set<string>> = {
    avatar: new Set<string>(),
    avatars: new Set<string>(),
    'event-media': new Set<string>(),
    public: new Set<string>(),
  };

  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_url, cover_url')
    .eq('id', user.id)
    .maybeSingle();
  collectPath(storagePaths, profile?.avatar_url);
  collectPath(storagePaths, profile?.cover_url);

  const { data: events } = await supabase
    .from('events')
    .select('id, cover_url, status, visibility')
    .eq('creator_id', user.id);
  const retainedPublicEventIds = new Set(
    (events ?? [])
      .filter((event: { id: string; status?: string | null; visibility?: string | null }) =>
        event.status === 'published' && event.visibility === 'public'
      )
      .map((event: { id: string }) => event.id),
  );
  const eventIds = (events ?? []).map((event: { id: string }) => event.id);
  for (const event of events ?? []) {
    if (!retainedPublicEventIds.has(event.id)) {
      collectPath(storagePaths, event.cover_url);
    }
  }

  if (eventIds.length > 0) {
    const { data: eventMedia } = await supabase
      .from('event_media')
      .select('event_id, url')
      .in('event_id', eventIds);
    for (const media of eventMedia ?? []) {
      if (!retainedPublicEventIds.has(media.event_id)) {
        collectPath(storagePaths, media.url);
      }
    }
  }

  const { data: submissions } = await supabase
    .from('event_media_submissions')
    .select('url')
    .eq('author_id', user.id);
  for (const submission of submissions ?? []) {
    collectPath(storagePaths, submission.url);
  }

  for (const [bucket, paths] of Object.entries(storagePaths)) {
    const uniquePaths = [...paths];
    if (uniquePaths.length === 0) continue;
    const { error: removeError } = await supabase.storage.from(bucket).remove(uniquePaths);
    if (removeError) {
      console.log('[delete-account] storage remove error', { bucket, removeError });
    }
  }

  const { data: deletionResult, error: deletionError } = await supabase.rpc('process_account_deletion', {
    p_user_id: user.id,
  });
  if (deletionError) {
    console.log('[delete-account] process_account_deletion error', { deletionError });
    return new Response(JSON.stringify({ success: false, message: 'Suppression des données impossible.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id, true);
  if (authDeleteError) {
    console.log('[delete-account] auth soft delete error', { authDeleteError });
    return new Response(JSON.stringify({ success: false, message: 'Suppression Auth impossible.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const requestId =
    typeof deletionResult === 'object' && deletionResult && 'request_id' in deletionResult
      ? String(deletionResult.request_id)
      : null;
  if (requestId) {
    await supabase
      .from('account_deletion_requests')
      .update({ status: 'auth_deleted', auth_deleted_at: new Date().toISOString() })
      .eq('id', requestId);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
