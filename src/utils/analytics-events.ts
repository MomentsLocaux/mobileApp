/** SCRUM-299 — allow-listed product events. No names, emails, or free text. */

export const ANALYTICS_EVENT_NAMES = [
  'app_opened',
  'home_viewed',
  'home_card_tapped',
  'home_card_dismissed',
  'event_viewed',
  'event_favorited',
  'search_performed',
  'notification_received',
  'notification_opened',
  'push_permission_result',
  'onboarding_completed',
  'session_end',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsProps = Record<string, string | number | boolean | null>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-z0-9_]{1,40}$/;
const VERSION = /^[0-9A-Za-z._-]{1,20}$/;

const ALLOWED = new Set<string>(ANALYTICS_EVENT_NAMES);

export type QueuedAnalyticsEvent = {
  client_event_id: string;
  session_id: string;
  name: AnalyticsEventName;
  props: AnalyticsProps;
  created_at: string;
};

const asInt = (value: unknown, max: number): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const next = Math.max(0, Math.floor(value));
  return next <= max ? next : null;
};

const asBool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);

const asToken = (value: unknown): string | null =>
  typeof value === 'string' && TOKEN.test(value) ? value : null;

const asUuid = (value: unknown): string | null =>
  typeof value === 'string' && UUID.test(value) ? value : null;

/** Stable motif codes. French sentences stay on screen and never enter props. */
export function homeReasonCode(reason: string | null | undefined): 'live' | 'soon' | 'theme' | 'nearby' | 'none' {
  if (!reason) return 'none';
  if (reason === 'En ce moment') return 'live';
  if (reason.startsWith('Dans ')) return 'soon';
  if (reason === 'Un de tes thèmes') return 'theme';
  if (reason === 'Tout près de toi') return 'nearby';
  return 'none';
}

export function sanitizeAnalyticsProps(
  name: AnalyticsEventName,
  props: AnalyticsProps | undefined,
): AnalyticsProps | null {
  const source = props ?? {};
  switch (name) {
    case 'app_opened': {
      const platform = asToken(source.platform);
      const version = typeof source.version === 'string' && VERSION.test(source.version) ? source.version : null;
      if (!platform || !version) return null;
      return { platform, version };
    }
    case 'home_viewed': {
      const slot = asToken(source.slot);
      const cardCount = asInt(source.card_count, 100);
      const withReason = asInt(source.cards_with_reason, 100);
      if (!slot || cardCount == null || withReason == null || withReason > cardCount) return null;
      return { slot, card_count: cardCount, cards_with_reason: withReason };
    }
    case 'home_card_tapped':
    case 'home_card_dismissed': {
      const position = asInt(source.position, 100);
      const reason = asToken(source.reason);
      if (position == null || !reason) return null;
      return { position, reason };
    }
    case 'event_viewed': {
      const eventId = asUuid(source.event_id);
      const viewSource = asToken(source.source);
      if (!eventId || !viewSource) return null;
      return { event_id: eventId, source: viewSource };
    }
    case 'event_favorited': {
      const eventId = asUuid(source.event_id);
      if (!eventId) return null;
      return { event_id: eventId };
    }
    case 'search_performed': {
      const hasWhere = asBool(source.has_where);
      const hasWhen = asBool(source.has_when);
      const hasCategory = asBool(source.has_category);
      if (hasWhere == null || hasWhen == null || hasCategory == null) return null;
      return { has_where: hasWhere, has_when: hasWhen, has_category: hasCategory };
    }
    case 'notification_received':
    case 'notification_opened': {
      const type = asToken(source.type);
      if (!type) return null;
      return { type };
    }
    case 'push_permission_result': {
      const result = source.result === 'granted' || source.result === 'denied' ? source.result : null;
      if (!result) return null;
      return { result };
    }
    case 'onboarding_completed': {
      const cityPresent = asBool(source.city_present);
      if (cityPresent == null) return null;
      return { city_present: cityPresent };
    }
    case 'session_end': {
      const duration = asInt(source.duration_seconds, 86_400);
      if (duration == null) return null;
      return { duration_seconds: duration };
    }
    default:
      return null;
  }
}

export function isAnalyticsEventName(name: string): name is AnalyticsEventName {
  return ALLOWED.has(name);
}

export function createAnalyticsId(): string {
  const bytes = new Uint8Array(16);
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Keeps a failed flush. A client id already queued is not added again. */
export function enqueueAnalyticsEvent(
  queue: QueuedAnalyticsEvent[],
  event: QueuedAnalyticsEvent,
): QueuedAnalyticsEvent[] {
  if (queue.some((row) => row.client_event_id === event.client_event_id)) return queue;
  return [...queue, event].slice(-200);
}

export function takeAnalyticsBatch(
  queue: QueuedAnalyticsEvent[],
  size = 20,
): { batch: QueuedAnalyticsEvent[]; rest: QueuedAnalyticsEvent[] } {
  return { batch: queue.slice(0, size), rest: queue.slice(size) };
}
