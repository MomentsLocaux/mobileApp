import { features } from '../config/features';
import {
  hrefForNotificationDestination,
  type NotificationRouteHref,
} from './notification-routes';

type RouteTarget =
  | { href: NotificationRouteHref }
  | { href: `/events/${string}` }
  | { href: `/events/create?edit=${string}` }
  | { href: `/community/${string}` }
  | { href: '/profile/my-events' }
  | { href: `/messages/${string}` }
  | { href: `/notifications/nearby-review?ids=${string}` };

const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEARBY_REVIEW_LIMIT = 20;

/** Identifiers carried by a nearby digest. Accepts a comma-separated string or a string array. */
export function nearbyReviewEventIds(data: unknown): string[] {
  const record = asRecord(data);
  const raw = record.eventIds ?? record.event_ids;
  const parts = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  const ids: string[] = [];
  for (const part of parts) {
    if (typeof part !== 'string') continue;
    const id = part.trim().toLowerCase();
    if (!EVENT_ID.test(id) || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= NEARBY_REVIEW_LIMIT) break;
  }
  return ids;
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const pickString = (data: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const v = data[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
};

const inbox = (): RouteTarget => ({ href: '/notifications' });

/** Resolves in-app navigation for a notification payload (push tap or inbox). */
export function resolveNotificationRoute(
  type: string | undefined,
  data: unknown,
): RouteTarget {
  const d = asRecord(data);

  const nearbyIds = nearbyReviewEventIds(d);
  if (pickString(d, 'kind') === 'event_nearby_digest' && nearbyIds.length > 1) {
    return { href: `/notifications/nearby-review?ids=${nearbyIds.join(',')}` };
  }

  if (type === 'event_request_changes') {
    const changeEventId = pickString(d, 'eventId', 'event_id');
    if (changeEventId) {
      return { href: `/events/create?edit=${changeEventId}` };
    }
    if (features.eventCreate && !features.eventSuggest) {
      return { href: '/profile/my-events' };
    }
    return { href: '/profile/my-suggestions' };
  }

  const eventId = pickString(d, 'eventId', 'event_id');
  if (eventId) {
    return { href: `/events/${eventId}` };
  }

  const destination = hrefForNotificationDestination(d);
  if (destination) {
    return { href: destination };
  }

  if (type === 'moderation_escalation') {
    const targetType = pickString(d, 'targetType', 'target_type');
    const targetId = pickString(d, 'targetId', 'target_id');
    if (targetType === 'event' && targetId) {
      return { href: `/events/${targetId}` };
    }
  }

  if (type === 'direct_message') {
    const conversationId = pickString(d, 'conversationId', 'conversation_id');
    if (conversationId) {
      return { href: `/messages/${conversationId}` };
    }
  }

  if (type === 'social_follow') {
    const follower = pickString(d, 'follower', 'followerId', 'follower_id');
    if (follower) {
      // Peer social MVP uses /community/[id]; creator hub is out of MVP.
      if (features.socialPeers) {
        return { href: `/community/${follower}` };
      }
      return inbox();
    }
  }

  if (type === 'mission_completed') {
    return inbox();
  }

  if (type === 'followed_creator_published') {
    // Scraper MVP: no creator-follow loop. eventId already handled above.
    return inbox();
  }

  if (typeof type === 'string' && type.startsWith('discovery_')) {
    return inbox();
  }

  if (pickString(d, 'kind') === 'notification_digest') {
    return inbox();
  }

  if (type === 'event_refused' || type === 'event_published') {
    if (features.eventCreate && !features.eventSuggest) {
      return { href: '/profile/my-events' };
    }
    return { href: '/profile/my-suggestions' };
  }

  if (
    type === 'contest_entry_refused'
    || type === 'contest_opened'
    || type === 'contest_ending_soon'
    || type === 'contest_results'
  ) {
    return inbox();
  }

  return inbox();
}
