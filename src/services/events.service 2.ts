import { dataProvider } from '@/data-providers/provider';
import type { EventWithCreator, Event } from '@/types/database';

export const EventsService = {
  list: (limit?: number): Promise<EventWithCreator[]> => dataProvider.listEvents({ limit }),
  getById: (id: string): Promise<EventWithCreator | null> => dataProvider.getEventById(id),
  create: (payload: Partial<Event>): Promise<Event> => dataProvider.createEvent(payload),
  delete: (id: string): Promise<boolean> => dataProvider.deleteEvent(id),
};
