import { create } from 'zustand';

/**
 * Legacy post-MVP offers stub. Discovery Premium uses `usePremiumEntitlement`
 * (server-side `get_user_entitlement`) — do not use this store for Discovery gating.
 */
export type UserPlan = 'free' | 'creator_prime' | 'explorer_insider' | 'all_access' | 'institutional';

type OffersState = {
  userPlan: UserPlan;
  setUserPlan: (plan: UserPlan) => void;
};

export const useOffersStore = create<OffersState>((set) => ({
  userPlan: 'free',
  setUserPlan: (userPlan) => set({ userPlan }),
}));
