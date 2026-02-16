import { useCallback, useEffect, useState } from 'react';
import { EventDetailService, type EventAttendee } from '@/services/event-detail.service';

export function useEventAttendees(eventId?: string | null) {
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [totalAttendees, setTotalAttendees] = useState(0);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!eventId) {
      setAttendees([]);
      setTotalAttendees(0);
      return;
    }

    setLoading(true);
    try {
      const data = await EventDetailService.getEventAttendees(eventId);
      setAttendees(data.attendees);
      setTotalAttendees(data.total);
    } catch (e) {
      console.warn('useEventAttendees', e);
      setAttendees([]);
      setTotalAttendees(0);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { attendees, totalAttendees, loading, reload };
}

