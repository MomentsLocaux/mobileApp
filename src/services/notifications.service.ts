import { supabase } from '@/lib/supabase/client';

export type AppNotificationType =
  | 'event_published'
  | 'event_soon'
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
  | 'moderation_escalation';

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

const SELECT_FIELDS = 'id, user_id, type, title, body, data, read, created_at';
const localNotificationListeners = new Set<() => void>();

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
    emitLocalNotificationChange();
    return true;
  },

  async markAllAsRead() {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false);

    if (error) throw new Error(error.message || 'Impossible de marquer les notifications comme lues');
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
};
