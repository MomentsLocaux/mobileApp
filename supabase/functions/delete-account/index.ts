import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Keep in sync with src/utils/owned-storage-path.ts */
const isOwnedAccountStoragePath = (bucket: string, path: string, userId: string) => {
  if (!userId || !UUID_RE.test(userId)) return false;
  if (!path || path.includes('\\') || path.includes('..')) return false;
  const parts = path.split('/').filter((part) => part.length > 0);
  if (parts.length !== path.split('/').length || parts.some((part) => part === '.' || part === '..')) {
    return false;
  }
  if (bucket === 'avatar') {
    return (
      (parts[0] === 'avatars' || parts[0] === 'profile-covers') &&
      parts[1] === userId &&
      parts.length >= 3
    );
  }
  if (bucket === 'event-media') {
    if (parts[0] === 'category-defaults') return false;
    if ((parts[0] === 'event-covers' || parts[0] === 'gallery') && parts[1] === userId && parts.length >= 3) {
      return true;
    }
    return parts[0] === 'contrib' && UUID_RE.test(parts[1] ?? '') && parts[2] === userId && parts.length >= 4;
  }
  if (bucket === 'account-exports' || bucket === 'bug-report-attachments') {
    return parts[0] === userId && parts.length >= 2;
  }
  return false;
};

const ownedPathFromPublicUrl = (url: string | null | undefined, bucket: string, userId: string) => {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const path = decodeURIComponent(url.slice(index + marker.length).split('?')[0] ?? '');
  return isOwnedAccountStoragePath(bucket, path, userId) ? path : null;
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
    'event-media': new Set<string>(),
  };
  const retainedEventMedia = new Set<string>();

  const rememberOwned = (bucket: string, url?: string | null, retain = false) => {
    const path = ownedPathFromPublicUrl(url, bucket, user.id);
    if (!path) return;
    if (retain) retainedEventMedia.add(path);
    else storagePaths[bucket]?.add(path);
  };

  const listFolder = async (bucket: string, folder: string) => {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 100, offset });
      if (error) {
        console.log('[delete-account] storage list error', { bucket, folder, error });
        return;
      }
      const entries = data ?? [];
      for (const entry of entries) {
        if (!entry?.name) continue;
        const path = `${folder}/${entry.name}`;
        if (isOwnedAccountStoragePath(bucket, path, user.id)) storagePaths[bucket]?.add(path);
      }
      if (entries.length < 100) return;
      offset += entries.length;
    }
  };

  await listFolder('avatar', `avatars/${user.id}`);
  await listFolder('avatar', `profile-covers/${user.id}`);
  await listFolder('event-media', `event-covers/${user.id}`);
  await listFolder('event-media', `gallery/${user.id}`);

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
    rememberOwned('event-media', event.cover_url, retainedPublicEventIds.has(event.id));
  }

  if (eventIds.length > 0) {
    const { data: eventMedia } = await supabase
      .from('event_media')
      .select('event_id, url')
      .in('event_id', eventIds);
    for (const media of eventMedia ?? []) {
      rememberOwned('event-media', media.url, retainedPublicEventIds.has(media.event_id));
    }
  }

  const { data: submissions } = await supabase
    .from('event_media_submissions')
    .select('url')
    .eq('author_id', user.id);
  for (const submission of submissions ?? []) {
    rememberOwned('event-media', submission.url, retainedEventMedia.has(
      ownedPathFromPublicUrl(submission.url, 'event-media', user.id) ?? '',
    ));
  }

  for (const path of retainedEventMedia) storagePaths['event-media']?.delete(path);

  for (const [bucket, paths] of Object.entries(storagePaths)) {
    const uniquePaths = [...paths].filter((path) => isOwnedAccountStoragePath(bucket, path, user.id));
    for (let index = 0; index < uniquePaths.length; index += 100) {
      const chunk = uniquePaths.slice(index, index + 100);
      const { error: removeError } = await supabase.storage.from(bucket).remove(chunk);
      if (removeError) {
        console.log('[delete-account] storage remove error', { bucket, removeError });
      }
    }
  }

  // SCRUM-277: Auth stays a soft-delete (`deleteUser(id, true)`). CASCADE FKs do not
  // fire, so prefs / tokens / usage / exports must be purged explicitly.
  const extraTables = [
    'user_preferences',
    'device_push_tokens',
    'lumia_chat_usage',
    'event_cover_generate_usage',
    'event_poster_analyze_usage',
    'event_suggest_usage',
    'account_export_requests',
    'ai_processing_notices',
  ] as const;
  const { data: exportRows } = await supabase
    .from('account_export_requests')
    .select('storage_path')
    .eq('user_id', user.id);
  const exportPaths = (exportRows ?? [])
    .map((row: { storage_path?: string | null }) => row.storage_path)
    .filter((path: string | null | undefined): path is string =>
      !!path && isOwnedAccountStoragePath('account-exports', path, user.id)
    );
  if (exportPaths.length > 0) {
    const { error: exportRemoveError } = await supabase.storage.from('account-exports').remove(exportPaths);
    if (exportRemoveError) {
      console.log('[delete-account] account-exports remove error', { exportRemoveError });
    }
  }
  for (const table of extraTables) {
    const { error: extraError } = await supabase.from(table).delete().eq('user_id', user.id);
    if (extraError) {
      console.log('[delete-account] extra purge error', { table, extraError });
    }
  }

  // Read paths before process_account_deletion deletes bug_reports rows.
  const { data: bugReports, error: bugReportsError } = await supabase
    .from('bug_reports')
    .select('attachment_path')
    .eq('reporter_id', user.id);
  if (bugReportsError) {
    console.log('[delete-account] bug report attachment lookup error', { bugReportsError });
  }
  const attachmentPaths = (bugReports ?? [])
    .map((row: { attachment_path?: string | null }) => row.attachment_path)
    .filter((path: string | null | undefined): path is string =>
      !!path && isOwnedAccountStoragePath('bug-report-attachments', path, user.id)
    );
  if (attachmentPaths.length > 0) {
    const { error: attachmentRemoveError } = await supabase.storage
      .from('bug-report-attachments')
      .remove(attachmentPaths);
    if (attachmentRemoveError) {
      console.log('[delete-account] bug-report-attachments remove error', { attachmentRemoveError });
    }
  }

  const { data: deletionResult, error: deletionError } = await supabase.rpc('process_account_deletion', {
    p_user_id: user.id,
  });
  const { error: analyticsPurgeError } = await supabase.rpc('purge_analytics_events', {
    p_user_id: user.id,
  });
  if (analyticsPurgeError) {
    console.log('[delete-account] analytics purge error', { analyticsPurgeError });
  }
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
