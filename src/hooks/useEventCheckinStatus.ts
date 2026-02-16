import { useCallback, useEffect, useState } from 'react';
import { EventDetailService } from '@/services/event-detail.service';

export function useEventCheckinStatus(eventId?: string | null, userId?: string | null) {
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [xpReward, setXpReward] = useState(0);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!eventId || !userId) {
      setHasCheckedIn(false);
      return;
    }

    setLoading(true);
    try {
      const checkedIn = await EventDetailService.getCheckinStatus(eventId, userId);
      setHasCheckedIn(checkedIn);
    } catch (e) {
      console.warn('useEventCheckinStatus', e);
      setHasCheckedIn(false);
    } finally {
      setLoading(false);
    }
  }, [eventId, userId]);

  const loadXpReward = useCallback(async () => {
    try {
      const reward = await EventDetailService.getCheckinXpReward();
      setXpReward(reward);
    } catch (e) {
      console.warn('useEventCheckinStatus xpReward', e);
      setXpReward(0);
    }
  }, []);

  const markCheckedIn = useCallback(() => {
    setHasCheckedIn(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    loadXpReward();
  }, [loadXpReward]);

  return { hasCheckedIn, xpReward, loading, reload, markCheckedIn };
}

