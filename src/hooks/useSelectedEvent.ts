import { useState } from 'react';
import type { EventWithCreator } from '../types/database';

export const useSelectedEvent = () => {
  const [selectedEvent, setSelectedEvent] = useState<EventWithCreator | null>(null);
  return { selectedEvent, setSelectedEvent };
};
