import { supabase } from '@/lib/supabase/client';

export type AppNotificationType =
  | 'event_published'
  | 'event_soon'
  | 'event_nearby_new'
  | 'event_nearby_live'
  | 'followed_creator_published'
  | 'lumo_reward'
  | 'mission_completed'
  | 'boost_expired'
  | 'social_follow'
  | 'social_like'
  | 'system'
  | 'event_refused'
  | 'event_request_changes'
  | 'warning_received'
  | 'user_banned'
  | 'media_approved'
  | 'media_rejected'
  | 'contest_entry_refused'
  | 'contest_results'
  | 'moderation_escalation'
  | 'discovery_right_now'
  | 'discovery_break_loop'
  | 'discovery_new_area'
  | 'discovery_personal_match'
  | 'discovery_life_insight';

export type AppNotification = {
  id: string;
  user_id: string;
  type: AppNotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
};

export type NotificationVisual = {
  avatarUrl: string | null;
  categorySlug: string | null;
  eventTitle: string | null;
  actorName: string | null;
};

type InboxCacheEntry = {
  items: AppNotification[];
  visuals: Record<string, NotificationVisual>;
  fetchedAt: number;
};

const SELECT_FIELDS = 'id, user_id, type, title, body, data, read, created_at';
const INBOX_PAGE_SIZE = 40;
const INBOX_CACHE_TTL_MS = 45_000;
const EVENT_VISUAL_SELECT = `
  id,
  title,
  category,
  category_meta:event_category(slug),
  creator:profiles!events_creator_id_fkey(display_name, avatar_url)
`;

const inboxCache = new Map<string, InboxCacheEntry>();
const inboxInFlight = new Map<string, Promise<InboxCacheEntry>>();
const localNotificationListeners = new Set<() => void>();

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const pickString = (data: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

export const getNotificationEventId = (item: AppNotification): string | undefined =>
  pickString(asRecord(item.data), 'eventId', 'event_id');

export const getNotificationActorId = (item: AppNotification): string | undefined =>
  pickString(
    asRecord(item.data),
    'follower',
    'followerId',
    'follower_id',
    'creatorId',
    'creator_id',
    'actorId',
    'actor_id',
  );

const inboxCacheKey = (userId: string, unreadOnly: boolean) => `${userId}:${unreadOnly ? 'unread' : 'all'}`;

const pickCategorySlug = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    const slug = (value[0] as { slug?: string } | undefined)?.slug;
    return typeof slug === 'string' && slug.trim() ? slug.trim() : null;
  }
  if (value && typeof value === 'object') {
    const slug = (value as { slug?: string }).slug;
    return typeof slug === 'string' && slug.trim() ? slug.trim() : null;
  }
  return null;
};

export const peekInboxCache = (userId: string, unreadOnly: boolean): InboxCacheEntry | null =>
  inboxCache.get(inboxCacheKey(userId, unreadOnly)) ?? null;

export const hasFreshInboxCache = (userId: string, unreadOnly: boolean): boolean => {
  const entry = inboxCache.get(inboxCacheKey(userId, unreadOnly));
  return Boolean(entry && Date.now() - entry.fetchedAt <= INBOX_CACHE_TTL_MS);
};

export const invalidateInboxCache = () => {
  inboxCache.clear();
};

const emitLocalNotificationChange = () => {
  localNotificationListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // no-op: isolate listener failures
    }
  });
};

export const NotificationsService = {
  async notifyPrivateAudience(params: {
    userIds: string[];
    eventId: string;
    eventTitle: string;
    creatorName?: string | null;
  }) {
    const { userIds, eventId, eventTitle, creatorName } = params;
    if (!userIds.length) return;
    const rows = userIds.map((userId) => ({
      user_id: userId,
      type: 'system',
      title: 'Invitation privée',
      body: `${creatorName || 'Un créateur'} vous invite à un événement privé: ${eventTitle}`,
      data: {
        kind: 'private_invite',
        eventId: eventId,
        eventTitle: eventTitle,
      },
      read: false,
    }));
    const { error } = await supabase.from('notifications').insert(rows as any);
    if (error) throw new Error(error.message || "Impossible d'envoyer les invitations privées");
    emitLocalNotificationChange();
  },

  async listMyNotifications(params?: { limit?: number; unreadOnly?: boolean }) {
    let query = supabase
      .from('notifications')
      .select(SELECT_FIELDS)
      .order('created_at', { ascending: false });

    if (params?.unreadOnly) query = query.eq('read', false);
    if (params?.limit) query = query.limit(params.limit);

    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Impossible de charger les notifications');
    return (data || []) as unknown as AppNotification[];
  },

  async getUnreadCount() {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('read', false);

    if (error) throw new Error(error.message || 'Impossible de compter les notifications non lues');
    return count || 0;
  },

  async markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('read', false);

    if (error) throw new Error(error.message || 'Impossible de marquer la notification comme lue');
    inboxCache.forEach((entry) => {
      entry.items = entry.items.map((row) => (row.id === notificationId ? { ...row, read: true } : row));
    });
    emitLocalNotificationChange();
    return true;
  },

  async markAllAsRead() {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false);

    if (error) throw new Error(error.message || 'Impossible de marquer les notifications comme lues');
    inboxCache.forEach((entry) => {
      entry.items = entry.items.map((row) => ({ ...row, read: true }));
    });
    emitLocalNotificationChange();
    return true;
  },

  subscribeToLocalChanges(onChange: () => void) {
    localNotificationListeners.add(onChange);
    return () => {
      localNotificationListeners.delete(onChange);
    };
  },

  subscribeToMyNotifications(userId: string, onChange: () => void) {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          onChange();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async listActors(ids: string[]): Promise<{ id: string; display_name: string | null; avatar_url: string | null }[]> {
    const unique = Array.from(new Set((ids || []).filter(Boolean)));
    if (!unique.length) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', unique);
    if (error) throw new Error(error.message || 'Impossible de charger les portraits');
    return (data || []) as { id: string; display_name: string | null; avatar_url: string | null }[];
  },

  async listEventVisuals(ids: string[]): Promise<{
    id: string;
    title: string | null;
    category: string | null;
    category_meta?: unknown;
    creator?: { display_name?: string | null; avatar_url?: string | null } | null;
  }[]> {
    const unique = Array.from(new Set((ids || []).filter(Boolean)));
    if (!unique.length) return [];
    const { data, error } = await supabase
      .rpc('get_events_by_ids', { ids: unique })
      .select(EVENT_VISUAL_SELECT);
    if (error) return [];
    return (data || []) as {
      id: string;
      title: string | null;
      category: string | null;
      category_meta?: unknown;
      creator?: { display_name?: string | null; avatar_url?: string | null } | null;
    }[];
  },

  async loadInbox(params: { userId: string; unreadOnly?: boolean; force?: boolean }): Promise<InboxCacheEntry> {
    const unreadOnly = Boolean(params.unreadOnly);
    const key = inboxCacheKey(params.userId, unreadOnly);
    if (!params.force && hasFreshInboxCache(params.userId, unreadOnly)) {
      return inboxCache.get(key)!;
    }
    const pending = inboxInFlight.get(key);
    if (pending) return pending;

    const request = (async () => {
      const items = await NotificationsService.listMyNotifications({
        limit: INBOX_PAGE_SIZE,
        unreadOnly,
      });
      const eventIds = items.map(getNotificationEventId).filter((id): id is string => Boolean(id));
      const actorIds = items
        .map((row) => (getNotificationEventId(row) ? undefined : getNotificationActorId(row)))
        .filter((id): id is string => Boolean(id));

      const [events, actors] = await Promise.all([
        NotificationsService.listEventVisuals(eventIds).catch(() => []),
        NotificationsService.listActors(actorIds).catch(() => []),
      ]);

      const eventById = new Map(events.map((event) => [event.id, event]));
      const actorById = new Map(actors.map((actor) => [actor.id, actor]));
      const visuals: Record<string, NotificationVisual> = {};

      items.forEach((row) => {
        const event = eventById.get(getNotificationEventId(row) || '');
        const actor = actorById.get(getNotificationActorId(row) || '');
        visuals[row.id] = {
          avatarUrl: event?.creator?.avatar_url || actor?.avatar_url || null,
          categorySlug: pickCategorySlug(event?.category_meta) || event?.category || null,
          eventTitle: event?.title?.trim() || null,
          actorName: actor?.display_name?.trim() || null,
        };
      });

      const entry: InboxCacheEntry = { items, visuals, fetchedAt: Date.now() };
      inboxCache.set(key, entry);
      return entry;
    })().finally(() => {
      inboxInFlight.delete(key);
    });

    inboxInFlight.set(key, request);
    return request;
  },

  async prefetchInboxIfStale(userId: string) {
    if (!userId || hasFreshInboxCache(userId, false)) return;
    try {
      await NotificationsService.loadInbox({ userId, unreadOnly: false });
    } catch {
      // Warm cache is best-effort.
    }
  },

  invalidateInboxCache() {
    invalidateInboxCache();
  },
};
