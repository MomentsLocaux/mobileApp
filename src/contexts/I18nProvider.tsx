import React, { createContext, useContext, useEffect } from 'react';
import { useI18nStore, type AppLocale } from '@/store/i18nStore';
import { t, translations } from '@/i18n/translations';

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (namespace: any, key: string) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const { locale, setLocale, initLocale } = useI18nStore();

  useEffect(() => {
    initLocale();
  }, [initLocale]);

  const translate = (namespace: any, key: string) => {
    return t(namespace, key, locale);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: translate }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};
