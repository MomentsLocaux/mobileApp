import type { SearchState } from '@/store/searchStore';
import type { Category, Subcategory, Tag } from '@/store/taxonomyStore';

const presetLabel = (preset: 'today' | 'tomorrow' | 'weekend') => {
  switch (preset) {
    case 'today':
      return "Aujourd'hui";
    case 'tomorrow':
      return 'Demain';
    case 'weekend':
      return 'Ce week-end';
    default:
      return 'Flexible';
  }
};

const formatDate = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

export const buildSearchSummary = (
  state: SearchState,
  categories: Category[],
  subcategories: Subcategory[],
  tags: Tag[]
) => {
  const whereLabel =
    state.where.location?.city ||
    state.where.location?.label ||
    (state.where.radiusKm ? 'À proximité' : 'Partout');

  const whenLabel = state.when.includePast
    ? "N'importe quand"
    : state.when.startDate && state.when.endDate
      ? `${formatDate(state.when.startDate)} - ${formatDate(state.when.endDate)}`
      : state.when.startDate
        ? formatDate(state.when.startDate)
        : state.when.preset
          ? presetLabel(state.when.preset)
          : 'Flexible';

  const categoryLabel = state.what.categories.length
    ? categories.find((c) => c.id === state.what.categories[0])?.label
    : undefined;
  const subcategoryLabel = !categoryLabel && state.what.subcategories.length
    ? subcategories.find((s) => s.id === state.what.subcategories[0])?.label
    : undefined;
  const tagLabel = !categoryLabel && !subcategoryLabel && state.what.tags.length
    ? tags.find((t) => t.slug === state.what.tags[0])?.label || state.what.tags[0]
    : undefined;

  const whatLabel = categoryLabel || subcategoryLabel || tagLabel || 'Tous types';

  const queryLabel = state.what.query?.trim();
  const prefix = queryLabel ? `“${queryLabel}” · ` : '';

  return `${prefix}${whereLabel} · ${whenLabel} · ${whatLabel}`;
};
