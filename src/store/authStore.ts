import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile, UserRole } from '../types/database';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: UserRole | null;
  onboardingCompleted: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  role: null,
  onboardingCompleted: false,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSession: (session) => set({ session, isAuthenticated: !!session }),
  setProfile: (profile) =>
    set({
      profile,
      role: profile?.role || null,
      onboardingCompleted: profile?.onboarding_completed || false,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set(initialState),
}));
