/**
 * User-facing history of community contributions (suggested events, field
 * corrections, duplicate reports, bug / improvement tickets).
 */

import { bugReportPageLabel } from '../constants/bug-report-pages';

export const SUGGESTION_KINDS = [
  'event_suggest',
  'field_correction',
  'duplicate',
  'bug',
] as const;

export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];
export type SuggestionFilter = 'all' | SuggestionKind;
export type SuggestionStatusTone = 'pending' | 'success' | 'danger' | 'muted' | 'info';

export type SuggestionHistoryItem = {
  id: string;
  kind: SuggestionKind;
  title: string;
  subtitle: string | null;
  status: string;
  statusLabel: string;
  tone: SuggestionStatusTone;
  createdAt: string;
  href: string | null;
  reviewNote: string | null;
};

export type SuggestionEventInput = {
  id: string;
  title?: string | null;
  status?: string | null;
  city?: string | null;
  address?: string | null;
  refusal_reason?: string | null;
  created_at?: string | null;
  submission_source?: string | null;
};

export type SuggestionCorrectionInput = {
  id: string;
  kind: string;
  comment: string;
  status: string;
  review_note?: string | null;
  created_at: string;
  event_id: string;
  duplicate_hint?: string | null;
  event?: { title?: string | null } | { title?: string | null }[] | null;
  events?: { title?: string | null } | { title?: string | null }[] | null;
};

export type SuggestionBugInput = {
  id: string;
  category: string;
  description: string;
  page?: string | null;
  status: string;
  created_at: string;
};

/** Reuse a loaded history instead of hitting the network again. */
export const SUGGESTION_HISTORY_FRESH_MS = 20_000;

export function isSuggestionHistoryCacheFresh(
  fetchedAt: number,
  now = Date.now(),
  freshMs = SUGGESTION_HISTORY_FRESH_MS,
): boolean {
  return now - fetchedAt >= 0 && now - fetchedAt < freshMs;
}

export const SUGGESTION_FILTER_OPTIONS: { key: SuggestionFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'event_suggest', label: 'Événements' },
  { key: 'field_correction', label: 'Corrections' },
  { key: 'duplicate', label: 'Doublons' },
  { key: 'bug', label: 'Bugs' },
];

export function isCommunitySuggestedEvent(source?: string | null): boolean {
  return source === 'community_suggest';
}

export function labelForSuggestionKind(kind: SuggestionKind): string {
  if (kind === 'event_suggest') return 'Événement suggéré';
  if (kind === 'field_correction') return 'Correction';
  if (kind === 'duplicate') return 'Doublon';
  return 'Bug / idée';
}

export function eventModerationStatusMeta(status: string | null | undefined): {
  label: string;
  tone: SuggestionStatusTone;
} {
  if (status === 'draft') return { label: 'Brouillon', tone: 'muted' };
  if (status === 'pending') return { label: 'En validation', tone: 'pending' };
  if (status === 'published') return { label: 'Publié', tone: 'success' };
  if (status === 'refused') return { label: 'Refusé', tone: 'danger' };
  if (status === 'archived') return { label: 'Archivé', tone: 'muted' };
  return { label: status || 'Inconnu', tone: 'muted' };
}

export function correctionStatusMeta(status: string | null | undefined): {
  label: string;
  tone: SuggestionStatusTone;
} {
  if (status === 'pending') return { label: 'En validation', tone: 'pending' };
  if (status === 'accepted') return { label: 'Acceptée', tone: 'success' };
  if (status === 'rejected') return { label: 'Refusée', tone: 'danger' };
  return { label: status || 'Inconnu', tone: 'muted' };
}

export function bugStatusMeta(status: string | null | undefined): {
  label: string;
  tone: SuggestionStatusTone;
} {
  if (status === 'open') return { label: 'Ouvert', tone: 'pending' };
  if (status === 'triage') return { label: 'En triage', tone: 'info' };
  if (status === 'in_progress') return { label: 'En cours', tone: 'info' };
  if (status === 'done') return { label: 'Traité', tone: 'success' };
  if (status === 'ignored') return { label: 'Ignoré', tone: 'muted' };
  return { label: status || 'Inconnu', tone: 'muted' };
}

function relatedTitle(
  rel: { title?: string | null } | { title?: string | null }[] | null | undefined,
): string | null {
  if (!rel) return null;
  const obj = Array.isArray(rel) ? rel[0] : rel;
  const title = obj?.title?.trim();
  return title || null;
}

export function eventSuggestToHistoryItem(event: SuggestionEventInput): SuggestionHistoryItem {
  const status = event.status ?? 'pending';
  const meta = eventModerationStatusMeta(status);
  const editable = status === 'draft' || status === 'refused';
  const place = event.city || event.address || null;
  return {
    id: `event:${event.id}`,
    kind: 'event_suggest',
    title: event.title?.trim() || 'Sans titre',
    subtitle: place,
    status,
    statusLabel: meta.label,
    tone: meta.tone,
    createdAt: event.created_at || '',
    href: editable ? `/events/create?edit=${event.id}` : `/events/${event.id}`,
    reviewNote: event.refusal_reason?.trim() || null,
  };
}

export function correctionToHistoryItem(row: SuggestionCorrectionInput): SuggestionHistoryItem {
  const kind: SuggestionKind = row.kind === 'duplicate' ? 'duplicate' : 'field_correction';
  const meta = correctionStatusMeta(row.status);
  const title =
    relatedTitle(row.event) ||
    relatedTitle(row.events) ||
    (kind === 'duplicate' ? 'Signalement de doublon' : 'Correction proposée');
  const subtitle =
    kind === 'duplicate'
      ? row.duplicate_hint?.trim() || row.comment.trim() || null
      : row.comment.trim() || null;
  return {
    id: `correction:${row.id}`,
    kind,
    title,
    subtitle,
    status: row.status,
    statusLabel: meta.label,
    tone: meta.tone,
    createdAt: row.created_at,
    href: `/events/${row.event_id}`,
    reviewNote: row.review_note?.trim() || null,
  };
}

export function bugToHistoryItem(bug: SuggestionBugInput): SuggestionHistoryItem {
  const meta = bugStatusMeta(bug.status);
  const category =
    bug.category === 'ux' ? 'UX' : bug.category === 'suggestion' ? 'Amélioration' : 'Bug';
  const page = bugReportPageLabel(bug.page);
  return {
    id: `bug:${bug.id}`,
    kind: 'bug',
    title: bug.description.trim().split('\n')[0]?.slice(0, 90) || `${category} signalé`,
    subtitle: `${category} · ${page}`,
    status: bug.status,
    statusLabel: meta.label,
    tone: meta.tone,
    createdAt: bug.created_at,
    href: null,
    reviewNote: null,
  };
}

export function mergeSuggestionHistory(items: SuggestionHistoryItem[]): SuggestionHistoryItem[] {
  return [...items].sort((a, b) => {
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bDate - aDate;
  });
}

export function filterSuggestionHistory(
  items: SuggestionHistoryItem[],
  filter: SuggestionFilter,
): SuggestionHistoryItem[] {
  if (filter === 'all') return items;
  return items.filter((item) => item.kind === filter);
}
