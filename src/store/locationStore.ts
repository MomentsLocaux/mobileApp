import { create } from 'zustand';
import type { LocationObject } from 'expo-location';

interface LocationState {
  currentLocation: LocationObject | null;
  permissionGranted: boolean;
  isLoading: boolean;
  error: string | null;
  setCurrentLocation: (location: LocationObject | null) => void;
  setPermissionGranted: (granted: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  currentLocation: null,
  permissionGranted: false,
  isLoading: false,
  error: null,
};

export const useLocationStore = create<LocationState>((set) => ({
  ...initialState,
  setCurrentLocation: (currentLocation) => set({ currentLocation }),
  setPermissionGranted: (permissionGranted) => set({ permissionGranted }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
