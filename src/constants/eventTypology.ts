import { getPreferredLocale } from '@/utils/locale';
import type { EventCategory } from '@/types/database';

export type TypologyItem = {
  value: EventCategory;
  icon: string;
  color: string;
  translations: {
    fr: string;
    en: string;
  };
  position?: number;
};

export const FALLBACK_TYPOLOGY: TypologyItem[] = [
  { value: 'concert', icon: 'music', color: '#7C3AED', translations: { fr: 'Concert', en: 'Concert' }, position: 1 },
  { value: 'party', icon: 'confetti', color: '#EC4899', translations: { fr: 'Soirée', en: 'Party' }, position: 2 },
  { value: 'market', icon: 'market', color: '#F97316', translations: { fr: 'Marché', en: 'Market' }, position: 3 },
  { value: 'food', icon: 'food', color: '#EA580C', translations: { fr: 'Gastronomie', en: 'Food' }, position: 4 },
  { value: 'exhibition', icon: 'culture', color: '#2563EB', translations: { fr: 'Exposition', en: 'Exhibition' }, position: 5 },
  { value: 'theater', icon: 'theater', color: '#4F46E5', translations: { fr: 'Spectacle', en: 'Show' }, position: 6 },
  { value: 'kids', icon: 'kids', color: '#16A34A', translations: { fr: 'Enfants', en: 'Kids' }, position: 7 },
  { value: 'nature', icon: 'leaf', color: '#22C55E', translations: { fr: 'Nature', en: 'Nature' }, position: 8 },
  { value: 'workshop', icon: 'hammer', color: '#CA8A04', translations: { fr: 'Atelier', en: 'Workshop' }, position: 9 },
  { value: 'conference', icon: 'mic', color: '#0EA5E9', translations: { fr: 'Conférence', en: 'Talk' }, position: 10 },
];

let typologyCache: TypologyItem[] = [...FALLBACK_TYPOLOGY];

export const setEventTypology = (items: TypologyItem[]) => {
  if (items && items.length > 0) {
    typologyCache = items;
  }
};

export const getEventTypology = (): TypologyItem[] => typologyCache;

const translate = (item: TypologyItem, locale: string) =>
  item.translations[locale as 'fr' | 'en'] ||
  item.translations.fr ||
  item.translations.en ||
  item.value;

export const getCategoryLabel = (category: EventCategory, locale = getPreferredLocale()): string => {
  const item = typologyCache.find((c) => c.value === category);
  return item ? translate(item, locale) : category;
};

export const getCategoryIcon = (category: EventCategory): string => {
  const item = typologyCache.find((c) => c.value === category);
  return item?.icon || 'circle';
};

export const getTypologyOptions = (locale = getPreferredLocale()) =>
  [...typologyCache]
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((item) => ({
      value: item.value,
      label: translate(item, locale),
      icon: item.icon,
      color: item.color,
    }));
