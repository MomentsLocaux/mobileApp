import type { AppNotificationType } from '@/services/notifications.service';

type RouteTarget =
  | { href: `/events/${string}` }
  | { href: '/notifications' }
  | { href: '/missions' }
  | { href: '/discovery' }
  | { href: `/creator/${string}` }
  | { href: '/profile/my-events' };

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

/** Resolves in-app navigation for a notification payload (push tap or inbox). */
export function resolveNotificationRoute(
  type: AppNotificationType | string | undefined,
  data: unknown,
): RouteTarget {
  const d = asRecord(data);
  const eventId = pickString(d, 'eventId', 'event_id');
  if (eventId) {
    return { href: `/events/${eventId}` };
  }

  if (type === 'moderation_escalation') {
    const targetType = pickString(d, 'targetType', 'target_type');
    const targetId = pickString(d, 'targetId', 'target_id');
    if (targetType === 'event' && targetId) {
      return { href: `/events/${targetId}` };
    }
  }

  if (type === 'social_follow') {
    const follower = pickString(d, 'follower', 'followerId', 'follower_id');
    if (follower) {
      return { href: `/creator/${follower}` };
    }
  }

  if (type === 'mission_completed') {
    return { href: '/missions' };
  }

  if (typeof type === 'string' && type.startsWith('discovery_')) {
    return { href: '/discovery' };
  }

  if (pickString(d, 'kind') === 'notification_digest') {
    return { href: '/notifications' };
  }

  if (type === 'event_refused' || type === 'event_request_changes' || type === 'event_published') {
    return { href: '/profile/my-events' };
  }

  return { href: '/notifications' };
}
