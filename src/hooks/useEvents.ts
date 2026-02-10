import { useEffect, useCallback, useState } from 'react';
import { useEventsStore } from '@/store';
import { EventsService } from '@/services/events.service';
import type { EventWithCreator } from '@/types/database';

interface UseEventsOptions {
  limit?: number;
  staleMs?: number;
}

export function useEvents(options: UseEventsOptions = {}) {
  const { limit = 50, staleMs } = options;
  const { events, loading, error, fetchEvents } = useEventsStore();

  const loadEvents = useCallback(() => fetchEvents({ limit, staleMs }), [fetchEvents, limit, staleMs]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return { events, loading, error, reload: loadEvents };
}

export function useEvent(eventId?: string) {
  const [event, setEvent] = useState<EventWithCreator | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await EventsService.getById(eventId);
      setEvent(data as EventWithCreator | null);
    } catch (e: any) {
      console.error('Error loading event:', e);
      setError(e?.message || 'Erreur chargement événement');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  return { event, loading, error, reload: loadEvent };
}
