import { dataProvider } from '@/data-provider';
import type { Profile } from '@/types/database';

export const UserService = {
  getProfile: (userId: string): Promise<Profile | null> => dataProvider.getProfile(userId),
  updateProfile: (userId: string, payload: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>) =>
    dataProvider.updateProfile(userId, payload),
};
