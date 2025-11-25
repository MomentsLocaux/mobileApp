import { useEffect, useState, useCallback } from 'react';
import type { EventWithCreator } from '@/types/database';
import { EventsService } from '@/services/events.service';

interface UseEventsOptions {
  limit?: number;
}

export function useEvents(options: UseEventsOptions = {}) {
  const { limit = 50 } = options;
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await EventsService.list(limit);
      setEvents((data as EventWithCreator[]) || []);
    } catch (e: any) {
      console.error('Error loading events:', e);
      setError(e?.message || 'Erreur chargement événements');
    } finally {
      setLoading(false);
    }
  }, [limit]);

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
