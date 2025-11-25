import { dataProvider } from '@/data-provider';

export class SocialService {
  static async toggleFavorite(_userId: string, eventId: string): Promise<boolean> {
    return dataProvider.toggleFavorite(eventId);
  }

  static async toggleInterest(_userId: string, eventId: string): Promise<boolean> {
    return dataProvider.toggleInterest(eventId);
  }

  static async like(_userId: string, eventId: string): Promise<boolean> {
    return dataProvider.like(eventId);
  }
}
