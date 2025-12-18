import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type AppLocale = 'fr' | 'en';

interface I18nState {
  locale: AppLocale;
  initialized: boolean;
  setLocale: (locale: AppLocale) => Promise<void>;
  initLocale: () => Promise<void>;
}

const STORAGE_KEY = 'app_locale';

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: 'fr',
  initialized: false,
  setLocale: async (locale) => {
    set({ locale });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, locale);
    } catch {
      // ignore storage errors
    }
  },
  initLocale: async () => {
    if (get().initialized) return;
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored === 'fr' || stored === 'en') {
        set({ locale: stored, initialized: true });
        return;
      }
    } catch {
      // ignore storage errors
    }
    const sysLocale = Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase() || '';
    const detected: AppLocale = sysLocale.startsWith('en') ? 'en' : 'fr';
    set({ locale: detected, initialized: true });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, detected);
    } catch {
      // ignore storage errors
    }
  },
}));
