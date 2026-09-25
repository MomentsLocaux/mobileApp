import type { DiscoveryStatus } from '../constants/filters';
import type { EventCardStats } from '../services/event-card-stats.service';
import type { EventWithCreator } from '../types/database';
import type { DiscoveryWhenFilter } from './discovery-filters';
import { eventMatchesDatePreset, eventOverlapsWindow } from './event-date-windows';
import { isEventLive, isEventPast } from './event-status';
import { filtersForSearchTemporalChoice } from './search-temporal-choice';

/** Cards shown in the main « Autour de toi » block. */
export const HOME_CARD_LIMIT = 3;

export type HomeTimeSlot = 'now' | 'tonight' | 'tomorrow' | 'weekend';

export const HOME_TIME_SLOTS: readonly { key: HomeTimeSlot; label: string; accessibilityLabel: string }[] = [
  { key: 'now', label: 'Maintenant', accessibilityLabel: 'Maintenant' },
  { key: 'tonight', label: 'Ce soir', accessibilityLabel: 'Ce soir' },
  { key: 'tomorrow', label: 'Demain', accessibilityLabel: 'Demain' },
  { key: 'weekend', label: 'Week-end', accessibilityLabel: 'Ce week-end' },
];

export type HomeHeroContent = {
  /** Stable id so Lumia can replace a rules-based hero later without a UI change. */
  id: string;
  source: 'rules';
  title: string;
  subtitle?: string;
};

export type HomeRankContext = {
  now?: Date;
  slot: HomeTimeSlot;
  center?: { latitude: number; longitude: number } | null;
  preferredCategorySlugs?: readonly string[];
  limit?: number;
  excludeIds?: readonly string[];
  categorySlugs?: Record<string, string>;
};

export type LocalPulse = {
  city: string;
  count: number;
  center: { latitude: number; longitude: number };
  radiusKm: number;
  headline: string;
  detail: string;
  slot: HomeTimeSlot;
};

export type SocialSignal = {
  eventId: string;
  title: string;
  caption: string;
};

const toRad = (value: number) => (value * Math.PI) / 180;

export function homeDistanceKm(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number {
  const dLat = toRad(toLat - fromLat);
  const dLon = toRad(toLon - fromLon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Tightest camera circle that still shows every event, never wider than the request. */
export const HOME_FOCUS_MIN_RADIUS_KM = 2;

export function focusForHomeEvents(
  events: Array<{ latitude: number; longitude: number }>,
  fallback: { latitude: number; longitude: number; radiusKm: number },
): { latitude: number; longitude: number; radiusKm: number } {
  const coords = events.filter(
    (event) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude),
  );
  if (!coords.length) return fallback;
  const latitude = coords.reduce((sum, event) => sum + event.latitude, 0) / coords.length;
  const longitude = coords.reduce((sum, event) => sum + event.longitude, 0) / coords.length;
  const farthest = Math.max(
    ...coords.map((event) => homeDistanceKm(latitude, longitude, event.latitude, event.longitude)),
  );
  const needed = Math.ceil((farthest + 0.6) * 10) / 10;
  return {
    latitude,
    longitude,
    radiusKm: Math.max(HOME_FOCUS_MIN_RADIUS_KM, Math.min(fallback.radiusKm, needed)),
  };
}

const startOfDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

export function defaultHomeTimeSlot(now: Date = new Date()): HomeTimeSlot {
  const day = now.getDay();
  const hour = now.getHours();
  if ((day === 6 || day === 0) && hour < 17) return 'weekend';
  if (hour >= 17) return 'tonight';
  return 'now';
}

export function nextHomeTimeSlot(slot: HomeTimeSlot): HomeTimeSlot | null {
  if (slot === 'now') return 'tonight';
  if (slot === 'tonight') return 'tomorrow';
  if (slot === 'tomorrow') return 'weekend';
  return null;
}

export function eventMatchesHomeSlot(
  event: EventWithCreator,
  slot: HomeTimeSlot,
  now: Date = new Date(),
): boolean {
  if (!isHomeEventEligible(event, now)) return false;
  if (slot === 'now') return isEventLive(event, now);
  if (slot === 'tonight') return eventMatchesDatePreset(event, 'tonight', now);
  if (slot === 'tomorrow') return eventMatchesDatePreset(event, 'tomorrow', now);
  return eventMatchesDatePreset(event, 'weekend', now);
}

/** Same temporal contract for the cards, counts, pulse and map. */
export function filtersForHomeTimeSlot(slot: HomeTimeSlot): {
  status: DiscoveryStatus;
  when: DiscoveryWhenFilter;
} {
  return filtersForSearchTemporalChoice(slot === 'now' ? 'live' : slot);
}

export function isHomeEventEligible(event: EventWithCreator, now: Date): boolean {
  return event.status === 'published' && event.visibility !== 'prive' &&
    Number.isFinite(Date.parse(event.starts_at || '')) && !isEventPast(event, now);
}

export function homeCategorySlug(event: EventWithCreator, slugs: Record<string, string> = {}): string {
  const meta = Array.isArray(event.category_meta) ? event.category_meta[0] : event.category_meta;
  return slugs[event.category || ''] || meta?.slug || event.category || '';
}

export function uniqueHomeEvents(events: EventWithCreator[]): EventWithCreator[] {
  const ids = new Set<string>();
  return events.filter(event => { if (!event.id || ids.has(event.id)) return false; ids.add(event.id); return true; });
}

export function countHomeSlotEvents(
  events: EventWithCreator[],
  slot: HomeTimeSlot,
  now: Date = new Date(),
): number {
  return uniqueHomeEvents(events).filter((event) => eventMatchesHomeSlot(event, slot, now)).length;
}

const byStartAsc = (left: EventWithCreator, right: EventWithCreator) => {
  const leftMs = Date.parse(left.starts_at || '') || 0;
  const rightMs = Date.parse(right.starts_at || '') || 0;
  if (leftMs !== rightMs) return leftMs - rightMs;
  return (left.title || '').localeCompare(right.title || '', 'fr');
};

function eventDistanceKm(
  event: EventWithCreator,
  center: { latitude: number; longitude: number } | null | undefined,
): number | null {
  if (!center) return null;
  if (!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)) return null;
  return homeDistanceKm(center.latitude, center.longitude, event.latitude, event.longitude);
}

function scoreHomeEvent(
  event: EventWithCreator,
  context: HomeRankContext,
  now: Date,
): number {
  let score = 0;
  const distance = eventDistanceKm(event, context.center);
  if (distance != null) score += Math.max(0, 40 - distance * 2);

  const startMs = Date.parse(event.starts_at || '');
  if (Number.isFinite(startMs)) {
    const hoursUntil = (startMs - now.getTime()) / 3_600_000;
    if (hoursUntil <= 0 && isEventLive(event, now)) score += 25;
    else score += Math.max(0, 22 - Math.min(22, Math.abs(hoursUntil)));
  }

  const popularity = (event.interests_count || 0) + (event.likes_count || 0);
  score += Math.min(15, Math.log2(popularity + 1) * 4);

  const category = homeCategorySlug(event, context.categorySlugs);
  if (category && context.preferredCategorySlugs?.includes(category)) score += 20;

  const createdMs = Date.parse(event.created_at || '');
  if (Number.isFinite(createdMs)) {
    const ageDays = (now.getTime() - createdMs) / 86_400_000;
    if (ageDays >= 0 && ageDays < 7) score += 10 * (1 - ageDays / 7);
  }

  return score;
}

/** Rank a local pool into at most `limit` diverse events. UI must not slice the API list itself. */
export function rankHomeEvents(
  events: EventWithCreator[],
  context: HomeRankContext,
): EventWithCreator[] {
  const now = context.now ?? new Date();
  const limit = Math.min(HOME_CARD_LIMIT, Math.max(0, context.limit ?? HOME_CARD_LIMIT));
  const scored = uniqueHomeEvents(events)
    .filter(event => !context.excludeIds?.includes(event.id))
    .filter((event) => eventMatchesHomeSlot(event, context.slot, now))
    .map((event) => ({
      event,
      score: scoreHomeEvent(event, context, now),
      category: homeCategorySlug(event, context.categorySlugs),
    }))
    .sort((left, right) => right.score - left.score || byStartAsc(left.event, right.event));

  const picked: typeof scored = [];
  const usedCategories = new Map<string, number>();
  const pool = [...scored];
  while (picked.length < limit && pool.length > 0) {
    let bestIndex = 0;
    let bestAdjusted = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < pool.length; index += 1) {
      const candidate = pool[index];
      const repeats = candidate.category ? usedCategories.get(candidate.category) ?? 0 : 0;
      const sameTitle = picked.some(item => item.event.title.trim().toLocaleLowerCase('fr') === candidate.event.title.trim().toLocaleLowerCase('fr'));
      const adjusted = candidate.score - repeats * 18 - (sameTitle ? 80 : 0);
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIndex = index;
      }
    }
    const [chosen] = pool.splice(bestIndex, 1);
    if (!chosen) break;
    picked.push(chosen);
    if (chosen.category) {
      usedCategories.set(chosen.category, (usedCategories.get(chosen.category) ?? 0) + 1);
    }
  }
  return picked.map((item) => item.event);
}

function momentsPhrase(count: number): string {
  return count === 1 ? '1 moment' : `${count} moments`;
}

export function mapMomentsCta(count: number, complete = true): string {
  if (!complete || count === 0) return 'Explorer cette période sur la carte';
  if (count === 1) return 'Voir le moment sur la carte';
  return `Voir les ${count} moments sur la carte`;
}

export function emptyHomeSlotCopy(slot: HomeTimeSlot, complete = true): string {
  if (!complete) return 'Pas de suggestion pour cette période dans la sélection actuelle';
  if (slot === 'now') return 'Aucun moment en cours autour de toi';
  if (slot === 'tonight') return 'Rien de prévu autour de toi ce soir';
  if (slot === 'tomorrow') return 'Rien de prévu autour de toi demain';
  return 'Rien de prévu autour de toi ce week-end';
}

export function buildHomeHero(input: {
  now?: Date;
  nearbyCount: number;
  isAuthenticated: boolean;
  hasSaturdayPlan: boolean;
  todayCount?: number;
  complete?: boolean;
}): HomeHeroContent {
  const now = input.now ?? new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const countLine =
    input.nearbyCount > 0
      ? input.complete === false ? 'Une sélection de moments près de toi' : `${momentsPhrase(input.nearbyCount)} à découvrir autour de toi`
      : 'Quelques idées devraient te plaire';

  const weekendStarting = (day === 5 && hour >= 16) || (day === 6 && hour < 12);
  if (weekendStarting && input.nearbyCount > 0) {
    return {
      id: 'weekend-start',
      source: 'rules',
      title: 'Le week-end commence ici',
      subtitle: countLine.charAt(0).toUpperCase() + countLine.slice(1),
    };
  }

  const saturdayStillOpen = day === 4 || day === 5 || (day === 6 && hour < 18);
  if (input.isAuthenticated && saturdayStillOpen && !input.hasSaturdayPlan) {
    return {
      id: 'saturday-open',
      source: 'rules',
      title: 'Une idée pour samedi ?',
      subtitle: 'Quelques idées devraient te plaire',
    };
  }

  if (hour >= 18 && input.nearbyCount > 0) {
    return {
      id: 'go-out',
      source: 'rules',
      title: 'Et si tu sortais un peu ?',
      subtitle: input.complete !== false && (input.todayCount ?? 0) > 0 ? `${momentsPhrase(input.todayCount!)} ${input.todayCount === 1 ? 'a' : 'ont'} lieu autour de toi aujourd’hui` : 'Trouve une sortie à ton rythme',
    };
  }

  if (input.nearbyCount > 0) {
    const title = countLine.charAt(0).toUpperCase() + countLine.slice(1);
    return { id: 'discover', source: 'rules', title };
  }

  return {
    id: 'quiet',
    source: 'rules',
    title: 'Et si tu sortais un peu ?',
    subtitle: 'Élargis la zone ou regarde les prochains jours',
  };
}

export function selectNextAgendaEvent(
  events: EventWithCreator[],
  now: Date = new Date(),
): EventWithCreator | null {
  const upcoming = uniqueHomeEvents(events).filter((event) => isHomeEventEligible(event, now) && Date.parse(event.starts_at) > now.getTime() && Date.parse(event.starts_at) <= now.getTime() + 30 * 86_400_000).sort(byStartAsc);
  return upcoming[0] ?? null;
}

export function hasSaturdayPlan(events: EventWithCreator[], now: Date = new Date()): boolean {
  const saturday = startOfDay(now);
  const daysUntilSaturday = (6 - saturday.getDay() + 7) % 7;
  saturday.setDate(saturday.getDate() + daysUntilSaturday);
  const end = endOfDay(saturday);
  return events.some((event) => isHomeEventEligible(event, now) && eventOverlapsWindow(event, saturday, end, now));
}

function cityKey(event: EventWithCreator): string | null {
  const raw = event.city?.trim();
  if (!raw) return null;
  const [primary] = raw.split(',').map((part) => part.trim());
  return primary || null;
}

function slotPhrase(slot: HomeTimeSlot): string {
  if (slot === 'now') return 'en ce moment';
  if (slot === 'tonight') return 'ce soir';
  if (slot === 'tomorrow') return 'demain';
  return 'ce week-end';
}

export function selectLocalPulse(
  events: EventWithCreator[],
  context: { now?: Date; slot: HomeTimeSlot; center?: { latitude: number; longitude: number } | null },
): LocalPulse | null {
  const now = context.now ?? new Date();
  const slotEvents = events.filter((event) => eventMatchesHomeSlot(event, context.slot, now));
  const source = uniqueHomeEvents(slotEvents);
  const groups = new Map<string, EventWithCreator[]>();
  for (const event of source) {
    const city = cityKey(event);
    if (!city || !Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)) continue;
    const key = city.toLocaleLowerCase('fr');
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }

  let best: LocalPulse | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const coords = group.filter(
      (event) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude),
    );
    if (!coords.length) continue;
    const latitude = coords.reduce((sum, event) => sum + event.latitude, 0) / coords.length;
    const longitude = coords.reduce((sum, event) => sum + event.longitude, 0) / coords.length;
    const distance = context.center
      ? homeDistanceKm(context.center.latitude, context.center.longitude, latitude, longitude)
      : 30;
    const score = group.length * 10 + Math.max(0, 30 - distance);
    if (score <= bestScore) continue;
    bestScore = score;
    const city = cityKey(group[0])!;
    const focus = focusForHomeEvents(coords, { latitude, longitude, radiusKm: 100 });
    best = {
      city,
      count: group.length,
      center: { latitude: focus.latitude, longitude: focus.longitude },
      radiusKm: focus.radiusKm,
      slot: context.slot,
      headline: `Ça bouge à ${city} ${slotPhrase(context.slot)}`,
      detail: `${momentsPhrase(group.length)} ${slotPhrase(context.slot)}`,
    };
  }
  return best;
}

export function selectSocialSignal(
  events: EventWithCreator[],
  statsById: Record<string, Pick<EventCardStats, 'friendsGoingCount' | 'likers'>>,
  now: Date = new Date(),
): SocialSignal | null {
  let best: { event: EventWithCreator; weight: number; caption: string } | null = null;
  for (const event of events) {
    if (!isHomeEventEligible(event, now) || Date.parse(event.starts_at) <= now.getTime() || Date.parse(event.starts_at) > now.getTime() + 7 * 86_400_000) continue;
    const stats = statsById[event.id];
    if (!stats) continue;
    const followed = (stats.likers || []).filter((liker) => liker.is_followed);
    const saved = stats.friendsGoingCount || 0;
    let caption = '';
    let weight = 0;
    if (saved >= 2) {
      caption = `${saved} personnes que tu suis ont enregistré`;
      weight = 100 + saved;
    } else if (saved === 1) {
      caption = 'Une personne que tu suis a enregistré';
      weight = 80;
    } else if (followed.length >= 2) {
      caption = `${followed.length} personnes que tu suis aiment`;
      weight = 60 + followed.length;
    } else if (followed.length === 1) {
      const name = followed[0]?.display_name?.trim() || 'Une personne que tu suis';
      caption = `${name} aime`;
      weight = 40;
    }
    if (!caption) continue;
    if (!best || weight > best.weight || (weight === best.weight && byStartAsc(event, best.event) < 0)) {
      best = { event, weight, caption };
    }
  }
  if (!best) return null;
  return { eventId: best.event.id, title: best.event.title, caption: best.caption };
}

/** A factual cue, never an invented participation or AI explanation. */
export function homeEventReason(event: EventWithCreator, context: HomeRankContext): string | null {
  const now = context.now ?? new Date();
  if (isEventLive(event, now)) return 'En ce moment';
  const minutes = Math.ceil((Date.parse(event.starts_at) - now.getTime()) / 60_000);
  if (minutes > 0 && minutes <= 90) return `Dans ${minutes} min`;
  if (context.preferredCategorySlugs?.includes(homeCategorySlug(event, context.categorySlugs))) return 'Un de tes thèmes';
  const km = eventDistanceKm(event, context.center);
  if (km != null && km < 2) return 'Tout près de toi';
  return null;
}
