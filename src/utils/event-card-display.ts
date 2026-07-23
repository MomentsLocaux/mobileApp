import type { EventWithCreator } from '@/types/database';
import { getEventCardSchedule, getEventCardCity } from './event-card-meta';

export type EventTemporalState = 'upcoming' | 'live' | 'past' | 'cancelled';

export type EventAccessLabel =
  | 'Entrée libre'
  | 'Réservation requise'
  | 'Places limitées'
  | 'Sur inscription'
  | 'Complet'
  | 'Annulé'
  | 'Infos accès à confirmer';

export type HumanizedDate = {
  headline: string | null;
  startLine: string;
  endLine: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

const capitalize = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const diffDays = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);

const formatShortDate = (date: Date) =>
  capitalize(
    date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  );

const formatTime = (date: Date) =>
  date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function getEventTemporalState(event: Pick<EventWithCreator, 'starts_at' | 'ends_at' | 'status'>): EventTemporalState {
  if (event.status === 'refused' || event.status === 'archived') return 'cancelled';

  const now = new Date();
  const start = parseDate(event.starts_at);
  const end = parseDate(event.ends_at);

  if (end && end < now) return 'past';
  if (start && end && start <= now && end >= now) return 'live';
  if (start && start > now) return 'upcoming';
  if (start && start <= now && !end) return 'live';
  return 'upcoming';
}

export function getHumanizedDate(event: Pick<EventWithCreator, 'starts_at' | 'ends_at'>): HumanizedDate {
  const start = parseDate(event.starts_at);
  const end = parseDate(event.ends_at);
  const now = new Date();

  let headline: string | null = null;
  if (start) {
    const days = diffDays(now, start);
    if (days === 0) headline = 'Aujourd\'hui';
    else if (days === 1) headline = 'Demain';
    else if (days >= 2 && days <= 6) headline = `Dans ${days} jours`;
    else if (days >= 7 && days <= 13) headline = 'Cette semaine';
    else {
      const day = now.getDay();
      const daysUntilSaturday = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
      const thisWeekend = new Date(now);
      thisWeekend.setDate(now.getDate() + daysUntilSaturday);
      const weekendEnd = new Date(thisWeekend);
      weekendEnd.setDate(thisWeekend.getDate() + 1);
      if (start >= thisWeekend && start <= weekendEnd) headline = 'Ce week-end';
    }
  }

  const schedule = getEventCardSchedule(event, 'compact');

  return {
    headline,
    startLine: schedule.start,
    endLine: schedule.end,
    startDate: start ? formatShortDate(start) : 'Date à confirmer',
    startTime: start ? formatTime(start) : '--:--',
    endDate: end ? formatShortDate(end) : 'Fin non précisée',
    endTime: end ? formatTime(end) : '--:--',
  };
}

export function getEventPriceLabel(event: Pick<EventWithCreator, 'is_free' | 'price'>): string {
  if (event.is_free) return 'Gratuit';
  if (typeof event.price === 'number' && Number.isFinite(event.price) && event.price > 0) {
    const formatted = event.price % 1 === 0 ? String(event.price) : event.price.toFixed(2).replace('.', ',');
    return `À partir de ${formatted} €`;
  }
  return 'Prix non renseigné';
}

/** Hide empty/placeholder price badges that hurt social proof on cards. */
export function isMeaningfulPriceLabel(label: string): boolean {
  return label !== 'Prix non renseigné';
}

/** Hide empty/placeholder access badges. */
export function isMeaningfulAccessLabel(label: string): boolean {
  return label !== 'Infos accès à confirmer';
}

/** Minimum view count before showing the eye badge on event cards. */
export const MIN_VIEWS_BADGE_THRESHOLD = 5;

export function getEventAccessLabel(
  event: Pick<
    EventWithCreator,
    'registration_required' | 'max_participants' | 'external_url' | 'status' | 'interests_count' | 'checkins_count'
  >
): EventAccessLabel {
  if (event.status === 'refused' || event.status === 'archived') return 'Annulé';

  const participants = (event.interests_count || 0) + (event.checkins_count || 0);
  if (event.max_participants && participants >= event.max_participants) return 'Complet';
  if (event.registration_required) return 'Réservation requise';
  if (event.external_url) return 'Sur inscription';
  if (event.max_participants) return 'Places limitées';
  return 'Entrée libre';
}

export function isEventVerified(event: Pick<EventWithCreator, 'status'>): boolean {
  return event.status === 'published';
}

export function getEventSocialProofLabel(
  friendsGoingCount?: number,
  participantsCount?: number
): string {
  const friends = Number.isFinite(friendsGoingCount) ? Number(friendsGoingCount) : 0;
  if (friends > 0) return `${friends} ami·e·s y vont`;

  const participants = Number.isFinite(participantsCount) ? Number(participantsCount) : 0;
  if (participants > 0) return `${participants} personne${participants > 1 ? 's' : ''} y vont`;

  return 'Soyez le premier à y aller';
}

export function getEventDescriptionPreview(description?: string | null, maxLength = 140): string | null {
  if (!description?.trim() || maxLength <= 0) return null;
  const normalized = description.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

const CARD_HIDDEN_TAG_RE = /^(#?)(datatourisme(_api)?|data_tourisme(_api)?)$/i;

export function getEventContextTags(event: Pick<EventWithCreator, 'tags' | 'ambiance'>): string[] {
  const tags = (Array.isArray(event.tags) ? event.tags : [])
    .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    .filter((tag) => !CARD_HIDDEN_TAG_RE.test(tag.trim()))
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag.trim()}`))
    .slice(0, 2);

  if (!tags.length && event.ambiance?.trim()) {
    const ambiance = event.ambiance.trim();
    if (!CARD_HIDDEN_TAG_RE.test(ambiance)) {
      tags.push(ambiance.startsWith('#') ? ambiance : `#${ambiance}`);
    }
  }

  return tags;
}

export function formatDistanceLabel(distanceKm?: number | null, distanceLabel?: string | null): string | null {
  if (distanceLabel?.trim()) return distanceLabel;
  if (typeof distanceKm === 'number' && Number.isFinite(distanceKm)) {
    if (distanceKm < 0.1) return `${Math.round(distanceKm * 1000)} m de toi`;
    if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m de toi`;
    return `${distanceKm.toFixed(1)} km de toi`;
  }
  return null;
}

export function getEventLocationLabel(event: Pick<EventWithCreator, 'city' | 'venue_name' | 'address'>): string {
  return getEventCardCity(event);
}

export function getEventImageUrls(event: Pick<EventWithCreator, 'cover_url' | 'media'>): string[] {
  const normalize = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (lower === 'null' || lower === 'undefined' || lower === 'none') return null;
    return trimmed;
  };

  const urls = [
    normalize(event.cover_url),
    ...((event.media || []).map((m) => normalize(m.url))),
  ].filter((u): u is string => !!u);

  return Array.from(new Set(urls)).slice(0, 4);
}
