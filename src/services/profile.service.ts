import { dataProvider } from '@/data-provider';
import type { Profile } from '../types/database';

export class ProfileService {
  static async getProfile(userId: string): Promise<Profile | null> {
    return dataProvider.getProfile(userId);
  }

  static async fetchProfileById(userId: string): Promise<Profile | null> {
    return this.getProfile(userId);
  }

  static async updateProfile(
    userId: string,
    updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<Profile | null> {
    return dataProvider.updateProfile(userId, updates);
  }

  static async uploadAvatar(userId: string, uri: string): Promise<string | null> {
    return dataProvider.uploadAvatar(userId, uri);
  }
}
