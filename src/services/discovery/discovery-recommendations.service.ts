import { Linking, Platform } from 'react-native';
import { supabase } from '@/lib/supabase/client';
import type { Event } from '@/types/database';
import type {
  EventRecommendation,
  RecommendationEventType,
  RecommendationType,
} from '@/types/discovery.types';

export type DiscoveryScoreSummary = Record<
  string,
  { generated: number; topScore: number | null }
>;

export type DiscoveryScoreResult = {
  success: boolean;
  generated_count?: number;
  summary?: DiscoveryScoreSummary;
  message?: string;
  hint?: string;
};

export type RecommendationWithEvent = EventRecommendation & {
  event: Event | null;
};

const EVENT_FIELDS =
  'id, title, description, category, subcategory, tags, starts_at, ends_at, latitude, longitude, address, city, cover_url, visibility, is_free, price, creator_id';

export const DiscoveryRecommendationsService = {
  async triggerScoring(params?: {
    latitude?: number;
    longitude?: number;
    types?: ('right_now' | 'for_you')[];
  }): Promise<DiscoveryScoreResult> {
    const { data, error } = await supabase.functions.invoke<DiscoveryScoreResult>('discovery-score', {
      body: {
        latitude: params?.latitude,
        longitude: params?.longitude,
        types: params?.types,
      },
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return data ?? { success: false, message: 'empty_response' };
  },

  async getActive(
    type?: RecommendationType,
    limit = 10,
  ): Promise<EventRecommendation[]> {
    const { data, error } = await supabase.rpc('get_active_recommendations', {
      p_type: type ?? null,
      p_limit: limit,
    });

    if (error) throw new Error(error.message || 'Impossible de charger les recommandations');
    return (data ?? []) as EventRecommendation[];
  },

  async getWithEvents(
    type: RecommendationType,
    limit = 10,
  ): Promise<RecommendationWithEvent[]> {
    const recommendations = await this.getActive(type, limit);
    if (recommendations.length === 0) return [];

    const eventIds = [...new Set(recommendations.map((row) => row.event_id))];
    const { data: events, error } = await supabase
      .from('events')
      .select(EVENT_FIELDS)
      .in('id', eventIds);

    if (error) throw new Error(error.message || 'Impossible de charger les événements');

    const eventMap = new Map((events ?? []).map((event) => [event.id, event as Event]));

    return recommendations.map((recommendation) => ({
      ...recommendation,
      event: eventMap.get(recommendation.event_id) ?? null,
    }));
  },

  async track(
    recommendationId: string,
    eventType: RecommendationEventType,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await supabase.rpc('track_recommendation_event', {
      p_recommendation_id: recommendationId,
      p_event_type: eventType,
      p_metadata: metadata ?? {},
    });

    if (error) throw new Error(error.message || 'Impossible d’enregistrer la réaction');
  },

  async markDisplayed(recommendationId: string): Promise<void> {
    await this.track(recommendationId, 'displayed');
  },

  async openRoute(latitude: number, longitude: number): Promise<void> {
    const google = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    const apple = `http://maps.apple.com/?daddr=${latitude},${longitude}`;
    const url = Platform.OS === 'ios' ? apple : google;
    await Linking.openURL(url);
  },

  async countPlaces(): Promise<number> {
    const { count, error } = await supabase
      .from('discovery_places')
      .select('id', { count: 'exact', head: true });

    if (error) return 0;
    return count ?? 0;
  },
};
