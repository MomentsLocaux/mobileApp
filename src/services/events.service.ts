import { dataProvider } from '@/data-provider';
import type { EventWithCreator, Event } from '@/types/database';

export const EventsService = {
  list: (limit?: number): Promise<EventWithCreator[]> => dataProvider.listEvents({ limit }),
  search: (filters?: Record<string, unknown>): Promise<EventWithCreator[]> =>
    (dataProvider as any).searchEvents ? (dataProvider as any).searchEvents(filters as any) : dataProvider.listEvents(filters),
  searchEvents: (filters?: Record<string, unknown>): Promise<EventWithCreator[]> =>
    (dataProvider as any).searchEvents ? (dataProvider as any).searchEvents(filters as any) : dataProvider.listEvents(filters),
  countEvents: (filters?: Record<string, unknown>): Promise<number> =>
    (dataProvider as any).countEvents ? (dataProvider as any).countEvents(filters as any) : Promise.resolve(0),
  getById: (id: string): Promise<EventWithCreator | null> => dataProvider.getEventById(id),
  create: (payload: Partial<Event>): Promise<Event> => dataProvider.createEvent(payload),
  update: (id: string, payload: Partial<Event>): Promise<EventWithCreator> =>
    (dataProvider as any).updateEvent ? (dataProvider as any).updateEvent(id, payload) : Promise.reject(new Error('updateEvent not implemented')),
  delete: (id: string): Promise<boolean> => dataProvider.deleteEvent(id),
  // Legacy aliases
  listEvents: (filters?: Record<string, unknown>): Promise<EventWithCreator[]> => dataProvider.listEvents(filters),
  getEventById: (id: string): Promise<EventWithCreator | null> => dataProvider.getEventById(id),
  createEvent: (payload: Partial<Event>): Promise<Event> => dataProvider.createEvent(payload),
  updateEvent: (id: string, payload: Partial<Event>): Promise<EventWithCreator> =>
    (dataProvider as any).updateEvent ? (dataProvider as any).updateEvent(id, payload) : Promise.reject(new Error('updateEvent not implemented')),
  deleteEvent: (id: string): Promise<boolean> => dataProvider.deleteEvent(id),
  listEventsByCreator: (creatorId: string): Promise<EventWithCreator[]> =>
    dataProvider.listEventsByCreator ? dataProvider.listEventsByCreator(creatorId) : dataProvider.listEvents({ creatorId }),
};
