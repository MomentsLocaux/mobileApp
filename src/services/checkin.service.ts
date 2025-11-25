import { dataProvider } from '@/data-provider';

export const CheckinService = {
  checkIn: (eventId: string, lat: number, lon: number, token?: string) =>
    dataProvider.checkInEvent(eventId, lat, lon, token),
};
