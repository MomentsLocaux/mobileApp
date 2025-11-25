import { supabase } from '../lib/supabase';
import type { Event, EventWithCreator, EventCategory, EventVisibility } from '../types/database';

export interface EventFilters {
  category?: EventCategory;
  tags?: string[];
  isFree?: boolean;
  visibility?: EventVisibility;
  includePast?: boolean;
  minDate?: string;
  maxDate?: string;
  searchQuery?: string;
  minInterests?: number;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export type SortMode = 'distance' | 'popularity' | 'date';

export class EventsService {
  static async listEvents(
    filters: EventFilters = {},
    sortMode: SortMode = 'date',
    userLat?: number,
    userLng?: number
  ): Promise<EventWithCreator[]> {
    try {
      let query = supabase
        .from('events')
        .select(
          `
          *,
          creator:profiles!events_creator_id_fkey(*)
        `
        )
        .order('created_at', { ascending: false });

      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      if (filters.isFree !== undefined) {
        query = query.eq('is_free', filters.isFree);
      }

      if (filters.visibility) {
        query = query.eq('visibility', filters.visibility);
      }

      if (!filters.includePast) {
        query = query.gte('ends_at', new Date().toISOString());
      }

      if (filters.minDate) {
        query = query.gte('starts_at', filters.minDate);
      }

      if (filters.maxDate) {
        query = query.lte('starts_at', filters.maxDate);
      }

      if (filters.searchQuery) {
        query = query.or(
          `title.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`
        );
      }

      if (filters.bounds) {
        query = query
          .gte('latitude', filters.bounds.south)
          .lte('latitude', filters.bounds.north)
          .gte('longitude', filters.bounds.west)
          .lte('longitude', filters.bounds.east);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error listing events:', error);
        return [];
      }

      if (!data) return [];

      let events: EventWithCreator[] = data.map((event) => ({
        ...event,
        likes_count: 0,
        interests_count: 0,
        comments_count: 0,
        checkins_count: 0,
      }));

      if (filters.tags && filters.tags.length > 0) {
        events = events.filter((event) =>
          filters.tags!.some((tag) => event.tags.includes(tag))
        );
      }

      const eventIds = events.map((e) => e.id);
      if (eventIds.length > 0) {
        const [interestsData, likesData, commentsData, checkinsData] = await Promise.all([
          supabase
            .from('event_interests')
            .select('event_id')
            .in('event_id', eventIds),
          supabase
            .from('event_likes')
            .select('event_id')
            .in('event_id', eventIds),
          supabase
            .from('event_comments')
            .select('event_id')
            .in('event_id', eventIds),
          supabase
            .from('event_checkins')
            .select('event_id')
            .in('event_id', eventIds),
        ]);

        const interestsCounts = interestsData.data?.reduce(
          (acc, { event_id }) => {
            acc[event_id] = (acc[event_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {};

        const likesCounts = likesData.data?.reduce(
          (acc, { event_id }) => {
            acc[event_id] = (acc[event_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {};

        const commentsCounts = commentsData.data?.reduce(
          (acc, { event_id }) => {
            acc[event_id] = (acc[event_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {};

        const checkinsCounts = checkinsData.data?.reduce(
          (acc, { event_id }) => {
            acc[event_id] = (acc[event_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {};

        events = events.map((event) => ({
          ...event,
          likes_count: likesCounts[event.id] || 0,
          interests_count: interestsCounts[event.id] || 0,
          comments_count: commentsCounts[event.id] || 0,
          checkins_count: checkinsCounts[event.id] || 0,
        }));
      }

      if (filters.minInterests !== undefined) {
        events = events.filter((e) => e.interests_count >= filters.minInterests!);
      }

      if (sortMode === 'popularity') {
        events.sort((a, b) => b.interests_count - a.interests_count);
      } else if (sortMode === 'distance' && userLat && userLng) {
        events = events.map((event) => ({
          ...event,
          distance: this.calculateDistance(userLat, userLng, event.latitude, event.longitude),
        }));
        events.sort((a: any, b: any) => a.distance - b.distance);
      } else {
        events.sort(
          (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
        );
      }

      return events;
    } catch (error) {
      console.error('Unexpected error listing events:', error);
      return [];
    }
  }

  static async getEventById(eventId: string, userId?: string): Promise<EventWithCreator | null> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(
          `
          *,
          creator:profiles!events_creator_id_fkey(*)
        `
        )
        .eq('id', eventId)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching event:', error);
        return null;
      }

      const [interestsRes, likesRes, commentsRes, checkinsRes] = await Promise.all([
        supabase.from('event_interests').select('user_id').eq('event_id', eventId),
        supabase.from('event_likes').select('user_id').eq('event_id', eventId),
        supabase.from('event_comments').select('id').eq('event_id', eventId),
        supabase.from('event_checkins').select('id').eq('event_id', eventId),
      ]);

      const event: EventWithCreator = {
        ...data,
        likes_count: likesRes.data?.length || 0,
        interests_count: interestsRes.data?.length || 0,
        comments_count: commentsRes.data?.length || 0,
        checkins_count: checkinsRes.data?.length || 0,
      };

      if (userId) {
        event.is_liked = likesRes.data?.some((l) => l.user_id === userId) || false;
        event.is_interested = interestsRes.data?.some((i) => i.user_id === userId) || false;

        const { data: favoriteData } = await supabase
          .from('favorites')
          .select('*')
          .eq('profile_id', userId)
          .eq('event_id', eventId)
          .maybeSingle();

        event.is_favorited = !!favoriteData;
      }

      return event;
    } catch (error) {
      console.error('Unexpected error fetching event:', error);
      return null;
    }
  }

  static async getCreatorEvents(creatorId: string): Promise<EventWithCreator[]> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(
          `
          *,
          creator:profiles!events_creator_id_fkey(*)
        `
        )
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        console.error('Error fetching creator events:', error);
        return [];
      }

      return data.map((event) => ({
        ...event,
        likes_count: 0,
        interests_count: 0,
        comments_count: 0,
        checkins_count: 0,
      }));
    } catch (error) {
      console.error('Unexpected error fetching creator events:', error);
      return [];
    }
  }

  static async createEvent(event: Omit<Event, 'id' | 'created_at' | 'updated_at'>): Promise<Event | null> {
    try {
      const { data, error } = await supabase
        .from('events')
        .insert(event)
        .select()
        .single();

      if (error) {
        console.error('Error creating event:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Unexpected error creating event:', error);
      return null;
    }
  }

  static async updateEvent(eventId: string, updates: Partial<Event>): Promise<Event | null> {
    try {
      const { data, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', eventId)
        .select()
        .single();

      if (error) {
        console.error('Error updating event:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Unexpected error updating event:', error);
      return null;
    }
  }

  static async deleteEvent(eventId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('events').delete().eq('id', eventId);

      if (error) {
        console.error('Error deleting event:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error deleting event:', error);
      return false;
    }
  }

  static async listEventsByCreator(creatorId: string): Promise<EventWithCreator[]> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(
          `
          *,
          creator:profiles!events_creator_id_fkey(*)
        `
        )
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching creator events:', error);
        return [];
      }

      let events = (data || []) as EventWithCreator[];

      const eventIds = events.map((e) => e.id);
      if (eventIds.length > 0) {
        const [interestsData, likesData, commentsData, checkinsData] = await Promise.all([
          supabase
            .from('event_interests')
            .select('event_id')
            .in('event_id', eventIds),
          supabase
            .from('event_likes')
            .select('event_id')
            .in('event_id', eventIds),
          supabase
            .from('event_comments')
            .select('event_id')
            .in('event_id', eventIds),
          supabase
            .from('event_checkins')
            .select('event_id')
            .in('event_id', eventIds),
        ]);

        const interestsCounts = interestsData.data?.reduce(
          (acc, { event_id }) => {
            acc[event_id] = (acc[event_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {};

        const likesCounts = likesData.data?.reduce(
          (acc, { event_id }) => {
            acc[event_id] = (acc[event_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {};

        const commentsCounts = commentsData.data?.reduce(
          (acc, { event_id }) => {
            acc[event_id] = (acc[event_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {};

        const checkinsCounts = checkinsData.data?.reduce(
          (acc, { event_id }) => {
            acc[event_id] = (acc[event_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {};

        events = events.map((event) => ({
          ...event,
          likes_count: likesCounts[event.id] || 0,
          interests_count: interestsCounts[event.id] || 0,
          comments_count: commentsCounts[event.id] || 0,
          checkins_count: checkinsCounts[event.id] || 0,
        }));
      }

      return events;
    } catch (error) {
      console.error('Unexpected error fetching creator events:', error);
      return [];
    }
  }

  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static async uploadEventImage(uri: string, eventId?: string): Promise<string | null> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${eventId || Date.now()}-${Date.now()}.${fileExt}`;
      const filePath = `events/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, blob, {
          contentType: blob.type || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Error uploading event image:', uploadError);
        return null;
      }

      const { data } = supabase.storage.from('event-images').getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Unexpected error uploading event image:', error);
      return null;
    }
  }
}
