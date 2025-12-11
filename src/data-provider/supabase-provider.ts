import { supabase } from '@/lib/supabase/client';
import type { IBugsProvider, IDataProvider } from './types';
import type { CommentWithAuthor, Event, EventWithCreator, Profile, Database, EventComment } from '@/types/database';

const formatSupabaseError = (error: any, context: string) => {
  const rawMessage =
    (typeof error?.message === 'string' && error.message) || (typeof error === 'string' && error) || 'Erreur Supabase';
  const message = rawMessage.trim().startsWith('<!DOCTYPE') || rawMessage.includes('Cloudflare')
    ? 'Supabase ne répond pas (timeout). Réessayez dans quelques instants.'
    : rawMessage;
  return new Error(`[${context}] ${message}`);
};

export const supabaseProvider: (Pick<
  IDataProvider,
  | 'listEvents'
  | 'getEventById'
  | 'createEvent'
  | 'deleteEvent'
  | 'listComments'
  | 'createComment'
  | 'deleteComment'
  | 'getProfile'
  | 'updateProfile'
  | 'earnLumo'
  | 'spendLumo'
  | 'toggleFavorite'
  | 'toggleInterest'
  | 'like'
  | 'uploadAvatar'
> &
  IBugsProvider) = {
  async listEvents(filters: Record<string, unknown> = {}) {
    const { limit, creatorId } = filters as { limit?: number; creatorId?: string };
    const appliedLimit = typeof limit === 'number' ? limit : 200;

    let query = supabase
      .from('events')
      .select(
        `
          id,
          creator_id,
          title,
          description,
          category,
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
          location,
          created_at,
          updated_at,
          status,
          ambiance,
          creator:profiles!events_creator_id_fkey(id, display_name, avatar_url, city, region),
          media:event_media(id, event_id, url, type, "order", created_at)
        `,
      )
      .order('created_at', { ascending: false });

    query = query.limit(appliedLimit);
    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }

    const { data, error } = await query;
    if (error) throw formatSupabaseError(error, 'listEvents');
    return (data || []) as EventWithCreator[];
  },

  async getEventById(id: string) {
    const { data, error } = await supabase
      .from('events')
      .select(
        `
          id,
          creator_id,
          title,
          description,
          category,
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
          location,
          created_at,
          updated_at,
          status,
          ambiance,
          creator:profiles!events_creator_id_fkey(id, display_name, avatar_url, city, region),
          media:event_media(id, event_id, url, type, "order", created_at)
        `,
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw formatSupabaseError(error, 'getEventById');
    return data ? (data as EventWithCreator) : null;
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

  async createComment(payload: { eventId: string; authorId: string; message: string }) {
    const { data, error } = await supabase
      .from('event_comments')
      .insert({
        event_id: payload.eventId,
        author_id: payload.authorId,
        message: payload.message,
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
    const { error } = await (supabase.rpc as any)('toggle_favorite', { event_id: eventId });
    if (error) throw formatSupabaseError(error, 'toggleFavorite');
    return true;
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

  async uploadAvatar(userId: string, uri: string) {
    const response = await fetch(uri);
    const blob = await response.blob();
    const ext = uri.split('.').pop() || 'jpg';
    const fileName = `${userId}-${Date.now()}.${ext}`;
    const filePath = `avatars/${fileName}`;
    const { error } = await supabase.storage.from('avatars').upload(filePath, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    });
    if (error) throw formatSupabaseError(error, 'uploadAvatar');
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  },
};
