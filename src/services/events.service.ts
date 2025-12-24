import { dataProvider } from '@/data-provider';
import type { EventWithCreator, Event } from '@/types/database';
type MediaInput = { id?: string; url: string; order?: number };

export const EventsService = {
  list: (limit?: number): Promise<EventWithCreator[]> => dataProvider.listEvents({ limit }),
  getById: (id: string): Promise<EventWithCreator | null> => dataProvider.getEventById(id),
  create: (payload: Partial<Event>): Promise<Event> => dataProvider.createEvent(payload),
  update: (id: string, payload: Partial<Event>): Promise<EventWithCreator> =>
    (dataProvider as any).updateEvent ? (dataProvider as any).updateEvent(id, payload) : Promise.reject(new Error('updateEvent not implemented')),
  setMedia: (id: string, medias: MediaInput[]): Promise<void> =>
    (dataProvider as any).setEventMedia ? (dataProvider as any).setEventMedia(id, medias) : Promise.resolve(),
  delete: (id: string): Promise<boolean> => dataProvider.deleteEvent(id),
  // Legacy aliases
  listEvents: (filters?: Record<string, unknown>): Promise<EventWithCreator[]> => dataProvider.listEvents(filters),
  getEventById: (id: string): Promise<EventWithCreator | null> => dataProvider.getEventById(id),
  createEvent: (payload: Partial<Event>): Promise<Event> => dataProvider.createEvent(payload),
  deleteEvent: (id: string): Promise<boolean> => dataProvider.deleteEvent(id),
  listEventsByCreator: (creatorId: string): Promise<EventWithCreator[]> =>
    dataProvider.listEventsByCreator ? dataProvider.listEventsByCreator(creatorId) : dataProvider.listEvents({ creatorId }),
  listEventsByBBox: (params: { ne: [number, number]; sw: [number, number]; limit?: number }) =>
    (dataProvider as any).listEventsByBBox
      ? (dataProvider as any).listEventsByBBox(params)
      : Promise.resolve({ type: 'FeatureCollection', features: [] }),
  uploadEventCover: (userId: string, uri: string): Promise<string | null> =>
    (dataProvider as any).uploadEventCover ? (dataProvider as any).uploadEventCover(userId, uri) : Promise.resolve(null),
  getEventsByIds: async (ids: string[]): Promise<EventWithCreator[]> => {
    const unique = Array.from(new Set((ids || []).filter(Boolean)));
    if (!unique.length) return [];
    if (!(dataProvider as any).getEventsByIds) return [];

    const chunkSize = 80;
    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += chunkSize) {
      chunks.push(unique.slice(i, i + chunkSize));
    }

    const results: EventWithCreator[] = [];
    for (const chunk of chunks) {
      const data = await (dataProvider as any).getEventsByIds(chunk);
      if (Array.isArray(data)) {
        results.push(...(data as EventWithCreator[]));
      }
    }
    return results;
  },
};
