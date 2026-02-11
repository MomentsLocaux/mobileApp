import { supabase } from '@/lib/supabase/client';
import type { IBugsProvider, IDataProvider } from './types';
import type { CommentWithAuthor, Event, EventWithCreator, Profile } from '@/types/database';
import type { FeatureCollection } from 'geojson';
import { resolveCategoryMarkerImageKey } from '@/constants/category-markers';

const formatSupabaseError = (error: any, context: string) => {
  const rawMessage =
    (typeof error?.message === 'string' && error.message) || (typeof error === 'string' && error) || 'Erreur Supabase';
  const message = rawMessage.trim().startsWith('<!DOCTYPE') || rawMessage.includes('Cloudflare')
    ? 'Supabase ne répond pas (timeout). Réessayez dans quelques instants.'
    : rawMessage;
  const details = [error?.code, error?.details, error?.hint].filter(Boolean).join(' | ');
  return new Error(`[${context}] ${message}${details ? ` (${details})` : ''}`);
};

const AVATAR_BUCKET = process.env.EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET || 'avatars';
const EVENT_COVER_BUCKET = process.env.EXPO_PUBLIC_SUPABASE_EVENT_COVER_BUCKET || 'public';

const EVENT_FULL_SELECT = `
  id,
  creator_id,
  title,
  description,
  category,
  subcategory,
  tags,
  starts_at,
  ends_at,
  schedule_mode,
  recurrence_rule,
  latitude,
  longitude,
  address,
  city,
  postal_code,
  venue_name,
  visibility,
  is_free,
  price,
  cover_url,
  max_participants,
  registration_required,
  external_url,
  contact_email,
  contact_phone,
  operating_hours,
  comments_count,
  media_count,
  rating_count,
  rating_avg,
  location,
  created_at,
  updated_at,
  status,
  ambiance,
  creator:profiles!events_creator_id_fkey(id, display_name, avatar_url, city, region),
  media:event_media(id, event_id, url, type, "order", created_at)
`;

// Ultra-light payload for the map (only what the GPU needs)
const EVENT_LIGHT_SELECT = `
  id,
  latitude,
  longitude,
  category_meta:event_category(slug, icon)
`;

const normalizeMakiIcon = (iconValue: any): string => {
  const raw =
    typeof iconValue === 'string'
      ? iconValue
      : typeof iconValue?.icon === 'string'
        ? iconValue.icon
        : '';
  if (!raw || typeof raw !== 'string') return 'marker-15';
  // Mapbox sprites are usually suffixed with -15/-11; add -15 if absent.
  return raw.includes('-11') || raw.includes('-15') ? raw : `${raw}-15`;
};

const pickCategoryMeta = (value: any): { slug?: string; icon?: string } | null => {
  if (Array.isArray(value)) return (value[0] as { slug?: string; icon?: string } | undefined) || null;
  if (value && typeof value === 'object') return value as { slug?: string; icon?: string };
  return null;
};

const resolveEventMarkerIcon = (categoryMetaValue: any): string => {
  const categoryMeta = pickCategoryMeta(categoryMetaValue);
  const slug = typeof categoryMeta?.slug === 'string' ? categoryMeta.slug : null;
  const customCategoryIcon = resolveCategoryMarkerImageKey(slug);
  if (customCategoryIcon) return customCategoryIcon;
  return normalizeMakiIcon(categoryMeta?.icon);
};

const isRlsError = (error: any) => {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return (
    code === '42501' ||
    message.includes('row-level security') ||
    details.includes('row-level security')
  );
};

export const supabaseProvider: (Pick<
  IDataProvider,
  | 'listEvents'
  | 'getEventById'
  | 'createEvent'
  | 'updateEvent'
  | 'setEventMedia'
  | 'deleteEvent'
  | 'listComments'
  | 'createComment'
  | 'deleteComment'
  | 'reportProfile'
  | 'reportMedia'
  | 'getProfile'
  | 'updateProfile'
  | 'earnLumo'
  | 'spendLumo'
  | 'toggleFavorite'
  | 'toggleInterest'
  | 'like'
  | 'likeComment'
  | 'likeMedia'
  | 'uploadAvatar'
  | 'uploadEventCover'
  | 'listEventsByBBox'
  | 'getEventsByIds'
> &
  IBugsProvider) = {
  async listEvents(filters: Record<string, unknown> = {}) {
    const { limit, creatorId, includePast } = filters as { limit?: number; creatorId?: string; includePast?: boolean };
    const appliedLimit = typeof limit === 'number' ? limit : 200;
    const nowIso = new Date().toISOString();

    let query = supabase
      .from('events')
      .select(EVENT_FULL_SELECT)
      .order('created_at', { ascending: false });

    query = query.limit(appliedLimit);
    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    } else {
      query = query.neq('status', 'draft');
    }
    // Par défaut, ne retourner que les événements en cours (starts_at <= now <= ends_at ou ends_at null)
    // Pour un créateur ou si includePast est true, on retourne tout l'historique sans filtre temporel.
    if (!creatorId && !includePast) {
      query = query.lte('starts_at', nowIso).or(`ends_at.is.null,ends_at.gte.${nowIso}`);
    }

    const { data, error } = await query;
    if (error) throw formatSupabaseError(error, 'listEvents');
    return (data || []) as unknown as EventWithCreator[];
  },

  async getEventById(id: string) {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_FULL_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw formatSupabaseError(error, 'getEventById');
    return data ? (data as unknown as EventWithCreator) : null;
  },

  async getEventsByIds(ids: string[]) {
    const cleanedIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (!cleanedIds.length) return [];

    const { data, error } = await supabase
      .rpc('get_events_by_ids', { ids: cleanedIds })
      .select(EVENT_FULL_SELECT);
    if (error) throw formatSupabaseError(error, 'getEventsByIds');
    return (data || []) as unknown as EventWithCreator[];
  },

  async listEventsByBBox(params: { ne: [number, number]; sw: [number, number]; limit?: number; includePast?: boolean }) {
    const { ne, sw, limit = 300, includePast = false } = params || {};
    const nowIso = new Date().toISOString();
    const minLon = Math.min(ne?.[0] ?? 0, sw?.[0] ?? 0);
    const maxLon = Math.max(ne?.[0] ?? 0, sw?.[0] ?? 0);
    const minLat = Math.min(ne?.[1] ?? 0, sw?.[1] ?? 0);
    const maxLat = Math.max(ne?.[1] ?? 0, sw?.[1] ?? 0);

    let query = supabase
      .from('events')
      .select(EVENT_LIGHT_SELECT)
      .gte('longitude', minLon)
      .lte('longitude', maxLon)
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .neq('status', 'draft');

    if (!includePast) {
      query = query.lte('starts_at', nowIso).or(`ends_at.is.null,ends_at.gte.${nowIso}`);
    }

    const { data, error } = await query.limit(limit);
    if (error) throw formatSupabaseError(error, 'listEventsByBBox');

    const events = ((data || []) as any[]).map((row) => ({
      id: String(row.id),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      icon: resolveEventMarkerIcon(row.category_meta),
    })) as { id: string; latitude: number; longitude: number; icon?: string }[];
    const features =
      events
        .filter((e) => typeof e.longitude === 'number' && typeof e.latitude === 'number')
        .map((e) => {
          const icon = typeof e.icon === 'string' && e.icon.trim().length > 0 ? e.icon : 'marker-15';
          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [e.longitude as number, e.latitude as number],
            },
            properties: {
              id: e.id,
              icon,
            },
          };
        }) || [];

    return {
      type: 'FeatureCollection',
      features,
    } as FeatureCollection;
  },

  async createEvent(payload: Partial<Event>) {
    const { data, error } = await supabase
      .from('events')
      .insert(payload as any)
      .select()
      .single();
    if (error) throw formatSupabaseError(error, 'createEvent');
    return data as Event;
  },

  async updateEvent(id: string, payload: Partial<Event>) {
    const { data, error } = await supabase
      .from('events')
      .update(payload as any)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw formatSupabaseError(error, 'updateEvent');
    // Si RLS bloque le retour de la ligne, on ne jette pas d'erreur : on renvoie le payload enrichi
    return (data as EventWithCreator) || ({ id, ...payload } as any);
  },

  async setEventMedia(eventId: string, medias: { id?: string; url: string; order?: number }[]) {
    console.log('[setEventMedia] eventId', eventId, 'incomingMedias', medias);
    const { data: existing, error: fetchError } = await supabase
      .from('event_media')
      .select('id, url')
      .eq('event_id', eventId);
    if (fetchError) throw formatSupabaseError(fetchError, 'setEventMedia');

    const finalMedias = (medias || [])
      .filter((m) => m && typeof m.url === 'string' && m.url.trim().length > 0)
      .slice(0, 3)
      .map((m, idx) => ({
        id: m.id,
        url: m.url,
        order: typeof m.order === 'number' ? m.order : idx,
      }));
    const newIds = new Set(finalMedias.filter((m) => !!m.id).map((m) => m.id as string));
    const existingList = (existing || []) as { id: string; url: string }[];
    const idsToRemove = existingList.filter((e) => !newIds.has(e.id)).map((e) => e.id);
    console.log('[setEventMedia] existing', existing, 'idsToRemove', idsToRemove);

    if (idsToRemove.length > 0) {
      console.log('[setEventMedia] deleting by id', idsToRemove);
      const { error: delByIdError } = await supabase
        .from('event_media')
        .delete()
        .in('id', idsToRemove);
      if (delByIdError) {
        if (isRlsError(delByIdError)) {
          throw new Error(
            `[setEventMedia-delete-by-id] Permission refusée sur event_media. Vérifie les policies RLS d'écriture (insert/update/delete) pour le créateur de l'événement.`
          );
        }
        throw formatSupabaseError(delByIdError, 'setEventMedia-delete-by-id');
      }
      console.log('[setEventMedia] delete response OK for ids', idsToRemove);
    } else if (finalMedias.length === 0) {
      // purge tout si aucune media active
      console.log('[setEventMedia] purge all event_media for event', eventId);
      const { error: purgeError } = await supabase.from('event_media').delete().eq('event_id', eventId);
      if (purgeError) {
        if (isRlsError(purgeError)) {
          throw new Error(
            `[setEventMedia-purge-all] Permission refusée sur event_media. Vérifie les policies RLS d'écriture (insert/update/delete) pour le créateur de l'événement.`
          );
        }
        throw formatSupabaseError(purgeError, 'setEventMedia-purge-all');
      }
      console.log('[setEventMedia] purge response OK for event', eventId);
    }

    if (finalMedias.length === 0) {
      return;
    }

    const existingToUpdate = finalMedias.filter((m) => m.id);
    const newToInsert = finalMedias.filter((m) => !m.id).map((m) => ({
      event_id: eventId,
      url: m.url,
      type: 'image',
      order: m.order ?? 0,
      position: m.order ?? 0,
    }));

    if (existingToUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from('event_media')
        .upsert(
          existingToUpdate.map((m) => ({
            id: m.id,
            event_id: eventId,
            url: m.url,
            type: 'image',
            order: m.order ?? 0,
            position: m.order ?? 0,
          })) as any,
          { onConflict: 'id' }
        );
      if (updateError) {
        if (isRlsError(updateError)) {
          throw new Error(
            `[setEventMedia-upsert-existing] Permission refusée sur event_media. Vérifie les policies RLS d'écriture (insert/update/delete) pour le créateur de l'événement.`
          );
        }
        throw formatSupabaseError(updateError, 'setEventMedia-upsert-existing');
      }
      console.log('[setEventMedia] upsert existing response OK', existingToUpdate.map((m) => m.id));
    }

    if (newToInsert.length > 0) {
      console.log('[setEventMedia] inserting', newToInsert);
      const { error: insertError } = await supabase.from('event_media').insert(newToInsert as any);
      if (insertError) {
        if (isRlsError(insertError)) {
          throw new Error(
            `[setEventMedia] Permission refusée sur event_media. Vérifie les policies RLS d'écriture (insert/update/delete) pour le créateur de l'événement.`
          );
        }
        throw formatSupabaseError(insertError, 'setEventMedia');
      }
      console.log('[setEventMedia] insert response OK count', newToInsert.length);
    }
    // Fin : pas de vérification supplémentaire, on s'appuie sur les IDs et l'ordre fournis.
  },

  async deleteEvent(id: string) {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw formatSupabaseError(error, 'deleteEvent');
    return true;
  },

  async listComments(eventId: string) {
    const { data, error } = await supabase
      .from('event_comments')
      .select(
        `
          *,
          author:profiles!event_comments_author_id_fkey(*)
        `,
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) throw formatSupabaseError(error, 'listComments');
    return (data || []) as CommentWithAuthor[];
  },

  async createComment(payload: { eventId: string; authorId: string; message: string; rating?: number | null }) {
    const { data, error } = await supabase
      .from('event_comments')
      .insert({
        event_id: payload.eventId,
        author_id: payload.authorId,
        message: payload.message,
        rating: payload.rating ?? null,
      } as any)
      .select(
        `
          *,
          author:profiles!event_comments_author_id_fkey(*)
        `,
      )
      .single();
    if (error) throw formatSupabaseError(error, 'createComment');
    return (data as CommentWithAuthor) || null;
  },

  async deleteComment(id: string) {
    const { error } = await supabase.from('event_comments').delete().eq('id', id);
    if (error) throw formatSupabaseError(error, 'deleteComment');
    return true;
  },

  async reportProfile(profileId: string, payload: { reason: string; severity?: string; details?: string }) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw formatSupabaseError(userError, 'reportProfile-auth');
    const reporterId = userData.user?.id;
    const { error } = await supabase.from('reports').insert({
      target_type: 'user',
      target_id: profileId,
      reporter_id: reporterId,
      reason: payload.reason,
      severity: payload.severity || 'minor',
    } as any);
    if (error) throw formatSupabaseError(error, 'reportProfile');
    return true;
  },

  async reportMedia(mediaId: string, payload: { reason: string; severity?: string; details?: string }) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw formatSupabaseError(userError, 'reportMedia-auth');
    const reporterId = userData.user?.id;
    const { error } = await supabase.from('reports').insert({
      target_type: 'media',
      target_id: mediaId,
      reporter_id: reporterId,
      reason: payload.reason,
      severity: payload.severity || 'minor',
    } as any);
    if (error) throw formatSupabaseError(error, 'reportMedia');
    return true;
  },

  async getProfile(userId: string) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    console.log('getProfile response', { userId, data, error });
    if (error) throw formatSupabaseError(error, 'getProfile');
    return data ? (data as Profile) : null;
  },

  async updateProfile(userId: string, payload: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>) {
    const { data, error } = await (supabase.from('profiles') as any)
      .update(payload as any)
      .eq('id', userId)
      .select()
      .maybeSingle();
    if (error) throw formatSupabaseError(error, 'updateProfile');
    return data ? (data as Profile) : null;
  },

  async earnLumo(payload: { amount?: number; reason?: string; item_type?: string; item_id?: string }) {
    const { data, error } = await (supabase.rpc as any)('earn_lumo', payload as any);
    if (error) throw formatSupabaseError(error, 'earnLumo');
    return data;
  },

  async spendLumo(payload: { amount: number; reason?: string; item_type?: string; item_id?: string }) {
    const { data, error } = await (supabase.rpc as any)('spend_lumo', payload as any);
    if (error) throw formatSupabaseError(error, 'spendLumo');
    return data;
  },

  async submitBug(payload: { category: string; severity: string; page?: string; description: string; reporterId?: string }) {
    const { error } = await (supabase.from('bug_reports') as any).insert({
      reporter_id: payload.reporterId,
      page: payload.page,
      category: payload.category,
      severity: payload.severity,
      description: payload.description,
      status: 'open',
    } as any);
    if (error) throw formatSupabaseError(error, 'submitBug');
    return true;
  },

  async toggleFavorite(eventId: string) {
    // Implémente un toggle en s'appuyant sur like_event / unlike_event (paramètre attendu : p_event).
    const { error } = await (supabase.rpc as any)('like_event', { p_event: eventId });
    if (!error) return true;

    // Si déjà liké (conflit), on tente l'unlike pour basculer l'état.
    if (error?.code === '23505' || (typeof error.message === 'string' && error.message.toLowerCase().includes('duplicate'))) {
      const { error: unlikeError } = await (supabase.rpc as any)('unlike_event', { p_event: eventId });
      if (unlikeError) throw formatSupabaseError(unlikeError, 'toggleFavorite');
      return true;
    }

    throw formatSupabaseError(error, 'toggleFavorite');
  },

  async toggleInterest(eventId: string) {
    const { error } = await (supabase.rpc as any)('toggle_interest', { event_id: eventId });
    if (error) throw formatSupabaseError(error, 'toggleInterest');
    return true;
  },

  async like(eventId: string) {
    const { error } = await (supabase.rpc as any)('toggle_like', { event_id: eventId });
    if (error) throw formatSupabaseError(error, 'like');
    return true;
  },

  async likeComment(commentId: string) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw formatSupabaseError(userError, 'likeComment-auth');
    const userId = userData.user?.id;
    if (!userId) throw formatSupabaseError('Utilisateur non authentifié', 'likeComment-auth');
    const { error } = await supabase.from('comment_likes').insert({
      comment_id: commentId,
      user_id: userId,
    } as any);
    if (error && String(error.code) === '23505') {
      const { error: deleteError } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId);
      if (deleteError) throw formatSupabaseError(deleteError, 'likeComment');
      return true;
    }
    if (error) throw formatSupabaseError(error, 'likeComment');
    return true;
  },

  async likeMedia(mediaId: string) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw formatSupabaseError(userError, 'likeMedia-auth');
    const userId = userData.user?.id;
    if (!userId) throw formatSupabaseError('Utilisateur non authentifié', 'likeMedia-auth');
    const { error } = await supabase.from('event_media_submission_likes').insert({
      submission_id: mediaId,
      user_id: userId,
    } as any);
    if (error && String(error.code) === '23505') {
      const { error: deleteError } = await supabase
        .from('event_media_submission_likes')
        .delete()
        .eq('submission_id', mediaId)
        .eq('user_id', userId);
      if (deleteError) throw formatSupabaseError(deleteError, 'likeMedia');
      return true;
    }
    if (error) throw formatSupabaseError(error, 'likeMedia');
    return true;
  },

  async uploadAvatar(userId: string, uri: string) {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const ext = uri.split('.').pop() || 'jpg';
    const fileName = `${userId}-${Date.now()}.${ext}`;
    const filePath = `avatars/${fileName}`;
    const contentType =
      response.headers.get('content-type') ||
      (ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg');

    const tryUpload = async (bucket: string) =>
      supabase.storage.from(bucket).upload(filePath, arrayBuffer, { contentType, upsert: true });

    let bucketUsed = AVATAR_BUCKET;
    let uploadError: any = null;

    const { error: primaryError } = await tryUpload(bucketUsed);
    if (primaryError?.message?.includes('Bucket not found')) {
      // Fallback to a public bucket if avatars is missing in the project.
      bucketUsed = 'public';
      const { error: fallbackError } = await tryUpload(bucketUsed);
      uploadError = fallbackError;
    } else {
      uploadError = primaryError;
    }

    if (uploadError) throw formatSupabaseError(uploadError, 'uploadAvatar');

    const { data } = supabase.storage.from(bucketUsed).getPublicUrl(filePath);
    return data.publicUrl;
  },

  async uploadEventCover(userId: string, uri: string) {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const ext = uri.split('.').pop() || 'jpg';
    const fileName = `${userId}-${Date.now()}.${ext}`;
    const filePath = `event_covers/${fileName}`;
    const contentType =
      response.headers.get('content-type') ||
      (ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg');

    const tryUpload = async (bucket: string) =>
      supabase.storage.from(bucket).upload(filePath, arrayBuffer, { contentType, upsert: true });

    let bucketUsed = EVENT_COVER_BUCKET;
    let uploadError: any = null;

    const { error: primaryError } = await tryUpload(bucketUsed);
    if (primaryError?.message?.includes('Bucket not found')) {
      // Fallback to a public bucket if the configured one is missing.
      bucketUsed = 'public';
      const { error: fallbackError } = await tryUpload(bucketUsed);
      uploadError = fallbackError;
    } else {
      uploadError = primaryError;
    }

    if (uploadError) throw formatSupabaseError(uploadError, 'uploadEventCover');

    const { data } = supabase.storage.from(bucketUsed).getPublicUrl(filePath);
    return data.publicUrl;
  },
};
