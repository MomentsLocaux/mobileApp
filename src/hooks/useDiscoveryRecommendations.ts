import { useCallback, useState } from 'react';
import {
  DiscoveryRecommendationsService,
  type RecommendationWithEvent,
} from '@/services/discovery/discovery-recommendations.service';

type LoadOptions = {
  latitude?: number;
  longitude?: number;
  refreshScores?: boolean;
};

export function useDiscoveryRecommendations() {
  const [rightNow, setRightNow] = useState<RecommendationWithEvent[]>([]);
  const [forYou, setForYou] = useState<RecommendationWithEvent[]>([]);
  const [placesCount, setPlacesCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationRequired, setLocationRequired] = useState(false);

  const load = useCallback(async (options?: LoadOptions) => {
    setLoading(true);
    setError(null);
    setLocationRequired(false);

    try {
      if (options?.refreshScores !== false) {
        const scoreResult = await DiscoveryRecommendationsService.triggerScoring({
          latitude: options?.latitude,
          longitude: options?.longitude,
          types: ['right_now', 'for_you'],
        });

        if (!scoreResult.success && scoreResult.message === 'location_required') {
          setLocationRequired(true);
        }
      }

      const [rightNowRows, forYouRows, placeCount] = await Promise.all([
        DiscoveryRecommendationsService.getWithEvents('right_now', 3),
        DiscoveryRecommendationsService.getWithEvents('for_you', 10),
        DiscoveryRecommendationsService.countPlaces(),
      ]);

      setRightNow(rightNowRows);
      setForYou(forYouRows);
      setPlacesCount(placeCount);

      await Promise.all(
        [...rightNowRows, ...forYouRows].map((row) =>
          DiscoveryRecommendationsService.markDisplayed(row.id).catch(() => undefined),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger Discovery');
    } finally {
      setLoading(false);
    }
  }, []);

  const react = useCallback(
    async (
      recommendationId: string,
      eventType: 'opened' | 'dismissed' | 'interested' | 'route_requested',
    ) => {
      await DiscoveryRecommendationsService.track(recommendationId, eventType);
    },
    [],
  );

  return {
    rightNow,
    forYou,
    placesCount,
    loading,
    error,
    locationRequired,
    load,
    react,
  };
}
