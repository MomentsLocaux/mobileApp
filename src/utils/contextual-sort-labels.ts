import type { SortOption, SortOrder } from '@/types/filters';
import type { EventMetaFilter } from './filter-events';

export type ContextualSortChoice = {
  key: string;
  label: string;
  sortBy: SortOption;
  sortOrder?: SortOrder;
};

const SHARED_CHOICES: Record<'triage' | 'distance' | 'popularity', ContextualSortChoice> = {
  triage: { key: 'triage', label: 'Recommandés', sortBy: 'triage' },
  distance: { key: 'distance', label: 'Les plus proches', sortBy: 'distance' },
  popularity: { key: 'popularity', label: 'Les plus populaires', sortBy: 'popularity' },
};

const LIVE_CHOICES: ContextualSortChoice[] = [
  SHARED_CHOICES.distance,
  { key: 'endDate:asc', label: 'Se terminent bientôt', sortBy: 'endDate', sortOrder: 'asc' },
  { key: 'date:desc', label: 'Commencés récemment', sortBy: 'date', sortOrder: 'desc' },
  SHARED_CHOICES.popularity,
  SHARED_CHOICES.triage,
  { key: 'date:asc', label: 'En cours depuis le plus longtemps', sortBy: 'date', sortOrder: 'asc' },
  { key: 'endDate:desc', label: 'Se terminent le plus tard', sortBy: 'endDate', sortOrder: 'desc' },
  { key: 'created:desc', label: 'Ajoutés récemment', sortBy: 'created', sortOrder: 'desc' },
  { key: 'created:asc', label: 'Ajoutés il y a longtemps', sortBy: 'created', sortOrder: 'asc' },
];

const UPCOMING_CHOICES: ContextualSortChoice[] = [
  { key: 'date:asc', label: 'Commencent bientôt', sortBy: 'date', sortOrder: 'asc' },
  SHARED_CHOICES.distance,
  SHARED_CHOICES.popularity,
  SHARED_CHOICES.triage,
  { key: 'date:desc', label: 'Commencent plus tard', sortBy: 'date', sortOrder: 'desc' },
  { key: 'endDate:asc', label: 'Se terminent le plus tôt', sortBy: 'endDate', sortOrder: 'asc' },
  { key: 'endDate:desc', label: 'Se terminent le plus tard', sortBy: 'endDate', sortOrder: 'desc' },
  { key: 'created:desc', label: 'Ajoutés récemment', sortBy: 'created', sortOrder: 'desc' },
  { key: 'created:asc', label: 'Ajoutés il y a longtemps', sortBy: 'created', sortOrder: 'asc' },
];

export function getContextualSortChoices(
  status: EventMetaFilter,
  options: readonly SortOption[],
): ContextualSortChoice[] | null {
  if (status !== 'live' && status !== 'upcoming') return null;
  const allowed = new Set(options);
  return (status === 'live' ? LIVE_CHOICES : UPCOMING_CHOICES)
    .filter((choice) => allowed.has(choice.sortBy));
}

export function findContextualSortChoice(
  choices: ContextualSortChoice[],
  sortBy: SortOption,
  sortOrder?: SortOrder,
): ContextualSortChoice | undefined {
  return choices.find((choice) =>
    choice.sortBy === sortBy && (!choice.sortOrder || choice.sortOrder === sortOrder),
  );
}
