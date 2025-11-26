import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  session: null,
  profile: null,
  isLoading: false,
  error: null,
  initialized: false,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setInitialized: (initialized) => set({ initialized }),
  reset: () => set(initialState),
}));
