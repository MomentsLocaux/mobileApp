import { useCallback, useEffect, useState } from 'react';
import { EventDetailService, type EventEngagementStats } from '@/services/event-detail.service';

const EMPTY_STATS: EventEngagementStats = {
  likes: 0,
  favorites: 0,
  interests: 0,
  checkins: 0,
  views: 0,
};

export function useEventEngagementStats(eventId?: string | null) {
  const [stats, setStats] = useState<EventEngagementStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!eventId) {
      setStats(EMPTY_STATS);
      return;
    }

    setLoading(true);
    try {
      const data = await EventDetailService.getEventEngagementStats(eventId);
      setStats(data);
    } catch (e) {
      console.warn('useEventEngagementStats', e);
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { stats, loading, reload };
}

