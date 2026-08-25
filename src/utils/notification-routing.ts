import type { AppNotificationType } from '@/services/notifications.service';
import { features } from '@/config/features';

type RouteTarget =
  | { href: `/events/${string}` }
  | { href: '/notifications' }
  | { href: '/missions' }
  | { href: '/discovery' }
  | { href: `/creator/${string}` }
  | { href: `/community/${string}` }
  | { href: '/profile/my-events' }
  | { href: `/contests/${string}` }
  | { href: '/contests' };

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
      // Peer social MVP uses /community/[id]; creator hub is out of MVP.
      if (features.socialPeers) {
        return { href: `/community/${follower}` };
      }
      return inbox();
    }
  }

  if (type === 'mission_completed') {
    return features.gamification ? { href: '/missions' } : inbox();
  }

  if (type === 'followed_creator_published') {
    // Scraper MVP: no creator-follow loop. eventId already handled above.
    return inbox();
  }

  if (typeof type === 'string' && type.startsWith('discovery_')) {
    return features.discovery ? { href: '/discovery' } : inbox();
  }

  if (pickString(d, 'kind') === 'notification_digest') {
    return inbox();
  }

  if (type === 'event_refused' || type === 'event_request_changes' || type === 'event_published') {
    return features.eventCreate || features.eventSuggest ? { href: '/profile/my-events' } : inbox();
  }

  if (
    type === 'contest_entry_refused'
    || type === 'contest_opened'
    || type === 'contest_ending_soon'
    || type === 'contest_results'
  ) {
    if (!features.contests) return inbox();
    const contestId = pickString(d, 'contestId', 'contest_id');
    if (contestId) {
      return { href: `/contests/${contestId}` };
    }
    return { href: '/contests' };
  }

  return inbox();
}
