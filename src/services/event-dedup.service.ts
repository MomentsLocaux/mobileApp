import { supabase } from '@/lib/supabase/client';

export type EventSubmitDuplicate = {
  id: string;
  title: string;
  starts_at: string | null;
  city: string | null;
  status: string;
  distance_m: number | null;
  title_score: number | null;
};

export const EventDedupService = {
  async findSubmitDuplicates(params: {
    title: string;
    startsAt: string;
    latitude: number;
    longitude: number;
    excludeId?: string | null;
  }): Promise<EventSubmitDuplicate[]> {
    const { data, error } = await supabase.rpc('find_event_submit_duplicates' as never, {
      p_title: params.title,
      p_starts_at: params.startsAt,
      p_lat: params.latitude,
      p_lng: params.longitude,
      p_radius_m: 500,
      p_exclude_id: params.excludeId ?? null,
    } as never);
    if (error) throw new Error(error.message || 'Recherche de doublons impossible');
    return (data || []) as EventSubmitDuplicate[];
  },
};
