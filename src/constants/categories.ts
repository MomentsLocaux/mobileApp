import { useTaxonomyStore } from '@/store/taxonomyStore';
import { colors } from './theme';
import type { EventCategory } from '../types/database';

const DEFAULT_CATEGORY_COLOR = colors.primary[600];
const DEFAULT_CATEGORY_TEXT_COLOR = colors.neutral[0];
const DARK_TEXT_COLOR = colors.neutral[900];

const normalizeHexColor = (value: string): string | null => {
  const raw = value.trim();
  if (!raw.startsWith('#')) return null;
  const hex = raw.slice(1);
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const expanded = hex
      .split('')
      .map((ch) => `${ch}${ch}`)
      .join('');
    return `#${expanded}`;
  }
  return null;
};

const getColorLuminance = (hexColor: string): number => {
  const hex = hexColor.replace('#', '');
  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

export const getCategoryLabel = (category: EventCategory): string => {
  const { categoriesMap } = useTaxonomyStore.getState();
  if (!category) return 'Catégorie';
  return categoriesMap[category]?.label || String(category);
};

export const getCategoryIcon = (category: EventCategory): string => {
  const { categoriesMap } = useTaxonomyStore.getState();
  if (!category) return 'circle';
  return categoriesMap[category]?.icon || 'circle';
};

export const getCategoryColor = (category: EventCategory): string => {
  const { categoriesMap } = useTaxonomyStore.getState();
  if (!category) return DEFAULT_CATEGORY_COLOR;
  const rawColor = categoriesMap[category]?.color;
  if (typeof rawColor !== 'string') return DEFAULT_CATEGORY_COLOR;
  return normalizeHexColor(rawColor) || DEFAULT_CATEGORY_COLOR;
};

export const getCategoryTextColor = (category: EventCategory): string => {
  const categoryColor = getCategoryColor(category);
  const luminance = getColorLuminance(categoryColor);
  return luminance > 0.5 ? DARK_TEXT_COLOR : DEFAULT_CATEGORY_TEXT_COLOR;
};
