import { create } from 'zustand';

export type UserPlan = 'free' | 'creator_prime' | 'explorer_insider' | 'all_access' | 'institutional';

type OffersState = {
  userPlan: UserPlan;
  setUserPlan: (plan: UserPlan) => void;
};

export const useOffersStore = create<OffersState>((set) => ({
  userPlan: 'free',
  setUserPlan: (userPlan) => set({ userPlan }),
}));
