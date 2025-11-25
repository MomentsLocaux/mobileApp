import { create } from 'zustand';

interface AppState {
  isOnline: boolean;
  isInitialized: boolean;
  setOnline: (online: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

const initialState = {
  isOnline: true,
  isInitialized: false,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  setOnline: (isOnline) => set({ isOnline }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  reset: () => set(initialState),
}));
