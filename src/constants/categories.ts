import type { EventCategory } from '../types/database';

export const CATEGORIES: Array<{
  value: EventCategory;
  label: string;
  icon: string;
}> = [
  { value: 'concert', label: 'Concert', icon: 'music' },
  { value: 'exposition', label: 'Exposition', icon: 'palette' },
  { value: 'spectacle', label: 'Spectacle', icon: 'theater' },
  { value: 'sport', label: 'Sport', icon: 'trophy' },
  { value: 'festival', label: 'Festival', icon: 'sparkles' },
  { value: 'atelier', label: 'Atelier', icon: 'wrench' },
  { value: 'conference', label: 'Conférence', icon: 'users' },
  { value: 'autre', label: 'Autre', icon: 'more-horizontal' },
];

export const getCategoryLabel = (category: EventCategory): string => {
  return CATEGORIES.find((c) => c.value === category)?.label || category;
};

export const getCategoryIcon = (category: EventCategory): string => {
  return CATEGORIES.find((c) => c.value === category)?.icon || 'circle';
};
