import { supabase } from '@/lib/supabase/client';
import { EventsService } from '@/services/events.service';
import { isMissingSchemaError } from '@/utils/schema-missing';
import { isCommunitySuggestedEvent } from '@/utils/suggestion-history';
import type { EventWithCreator } from '@/types/database';

const uniqueIds = (ids: (string | null | undefined)[]): string[] =>
  Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0)));

async function listEventIds(
  table: 'favorites' | 'event_likes' | 'event_interests' | 'event_checkins',
  ownerColumn: 'profile_id' | 'user_id',
  ownerId: string,
): Promise<string[]> {
  const { data, error } = await supabase.from(table).select('event_id').eq(ownerColumn, ownerId).limit(500);
  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
  return uniqueIds((data || []).map((row: { event_id?: string }) => row.event_id));
}

export const AgendaService = {
  async listInterestedEventIds(userId: string): Promise<string[]> {
    const [favorites, likes] = await Promise.all([
      listEventIds('favorites', 'profile_id', userId),
      listEventIds('event_likes', 'user_id', userId),
    ]);
    return uniqueIds([...favorites, ...likes]);
  },

  async listParticipatingEventIds(userId: string): Promise<string[]> {
    const [checkins, interests] = await Promise.all([
      listEventIds('event_checkins', 'user_id', userId),
      listEventIds('event_interests', 'user_id', userId),
    ]);
    return uniqueIds([...checkins, ...interests]);
  },

  async listOrganizingEvents(userId: string): Promise<EventWithCreator[]> {
    const events = await EventsService.listEventsByCreator(userId);
    return events.filter((event) => !isCommunitySuggestedEvent(event.submission_source));
  },

  async getEventsByIds(ids: string[]): Promise<EventWithCreator[]> {
    const unique = uniqueIds(ids);
    if (!unique.length) return [];
    return EventsService.getEventsByIds(unique);
  },

  async listFollowedMembers(userId: string): Promise<
    { user_id: string; display_name: string; avatar_url: string | null; city: string | null }[]
  > {
    const { data, error } = await supabase
      .from('follows')
      .select('following, profile:profiles!follows_following_fkey(id, display_name, avatar_url, city)')
      .eq('follower', userId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      if (isMissingSchemaError(error)) return [];
      throw error;
    }
    return ((data || []) as { profile?: { id?: string; display_name?: string; avatar_url?: string | null; city?: string | null } }[])
      .map((row) => {
        const profile = row.profile;
        if (!profile?.id) return null;
        return {
          user_id: profile.id,
          display_name: profile.display_name || 'Membre',
          avatar_url: profile.avatar_url ?? null,
          city: profile.city ?? null,
        };
      })
      .filter((row): row is { user_id: string; display_name: string; avatar_url: string | null; city: string | null } => !!row);
  },
};
