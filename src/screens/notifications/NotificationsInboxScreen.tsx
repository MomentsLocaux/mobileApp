import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  Bell,
  CalendarCheck2,
  Image as ImageIcon,
  MessageSquareWarning,
  ShieldAlert,
} from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { NotificationsService, type AppNotification, type AppNotificationType } from '@/services/notifications.service';
import { EventsService } from '@/services/events.service';
import { ScreenHeader } from '@/components/ui';

type FilterMode = 'all' | 'unread';

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const getEventIdFromNotification = (item: AppNotification): string | null => {
  const data = asRecord(item.data);
  const directEventId = (data.eventId as string | undefined) || (data.event_id as string | undefined);
  if (directEventId) return directEventId;

  if (item.type === 'moderation_escalation') {
    const targetType = (data.targetType as string | undefined) || (data.target_type as string | undefined);
    const targetId = (data.targetId as string | undefined) || (data.target_id as string | undefined);
    if (targetType === 'event' && targetId) return targetId;
  }

  return null;
};

const formatRelative = (value: string) => {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const delta = Date.now() - t;
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return 'à l’instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(new Date(value));
};

const typeLabel: Record<AppNotificationType, string> = {
  event_published: 'Événement',
  event_soon: 'Rappel',
  lumo_reward: 'Récompense',
  mission_completed: 'Mission',
  boost_expired: 'Boutique',
  social_follow: 'Communauté',
  social_like: 'Communauté',
  system: 'Système',
  event_refused: 'Modération',
  event_request_changes: 'Modération',
  warning_received: 'Modération',
  user_banned: 'Modération',
  media_approved: 'Modération',
  media_rejected: 'Modération',
  contest_entry_refused: 'Modération',
  moderation_escalation: 'Modération',
};

const typeIcon = (type: AppNotificationType) => {
  if (type === 'event_published' || type === 'event_refused' || type === 'event_request_changes') {
    return CalendarCheck2;
  }
  if (type === 'media_approved' || type === 'media_rejected') {
    return ImageIcon;
  }
  if (type === 'warning_received' || type === 'user_banned') {
    return ShieldAlert;
  }
  if (type === 'moderation_escalation') {
    return MessageSquareWarning;
  }
  return Bell;
};

export default function NotificationsInboxScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [mode, setMode] = useState<FilterMode>('all');
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const loadNotifications = useCallback(async () => {
    if (!profile?.id) {
      setItems([]);
      setError('Connectez-vous pour consulter vos notifications.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await NotificationsService.listMyNotifications({
        limit: 100,
        unreadOnly: mode === 'unread',
      });
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [mode, profile?.id]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  useEffect(() => {
    if (!profile?.id) return;
    return NotificationsService.subscribeToMyNotifications(profile.id, () => {
      loadNotifications();
    });
  }, [profile?.id, loadNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    await NotificationsService.markAllAsRead();
    await loadNotifications();
  };

  const handleOpen = async (item: AppNotification) => {
    if (!item.read) {
      try {
        await NotificationsService.markAsRead(item.id);
      } catch { }
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, read: true } : row)));
    }

    const eventId = getEventIdFromNotification(item);

    if (eventId) {
      try {
        const event = await EventsService.getEventById(eventId);
        if (!event) {
          Alert.alert('Événement indisponible', 'Cet événement n’est plus accessible depuis votre compte.');
          return;
        }
      } catch {
        Alert.alert('Navigation impossible', 'Impossible d’ouvrir cet événement pour le moment.');
        return;
      }
      router.push(`/events/${eventId}` as any);
      return;
    }

    if (item.type === 'moderation_escalation' && (profile?.role === 'moderateur' || profile?.role === 'admin')) {
      router.push('/moderation/reports' as any);
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const IconCmp = typeIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.itemCard, !item.read && styles.itemUnread]}
        onPress={() => handleOpen(item)}
        activeOpacity={0.8}
      >
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleRow}>
            <View style={styles.itemIcon}>
              <IconCmp size={16} color={colors.brand.secondary} />
            </View>
            <Text style={styles.itemTitle}>{item.title}</Text>
          </View>
          {!item.read ? <View style={styles.unreadDot} /> : null}
        </View>
        {item.body ? <Text style={styles.itemBody}>{item.body}</Text> : null}
        <View style={styles.itemFooter}>
          <Text style={styles.itemType}>{typeLabel[item.type]}</Text>
          <Text style={styles.itemDate}>{formatRelative(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      <ScreenHeader
        title="Notifications"
        onBack={() => router.back()}
        right={
          <TouchableOpacity
            style={[styles.readAllButton, unreadCount === 0 && styles.readAllButtonDisabled]}
            onPress={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            <Text style={[styles.readAllText, unreadCount === 0 && styles.readAllTextDisabled]}>Tout lire</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterPill, mode === 'all' && styles.filterPillActive]}
          onPress={() => setMode('all')}
        >
          <Text style={[styles.filterText, mode === 'all' && styles.filterTextActive]}>Toutes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterPill, mode === 'unread' && styles.filterPillActive]}
          onPress={() => setMode('unread')}
        >
          <Text style={[styles.filterText, mode === 'unread' && styles.filterTextActive]}>Non lues</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={colors.primary[600]} />
          <Text style={styles.stateText}>Chargement des notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Bell size={20} color={colors.brand.textSecondary} />
              <Text style={styles.stateText}>
                {error ? `Erreur: ${error}` : mode === 'unread' ? 'Aucune notification non lue.' : 'Aucune notification.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  readAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  readAllButtonDisabled: {
    backgroundColor: 'transparent',
    opacity: 0.5,
  },
  readAllText: {
    ...typography.caption,
    color: colors.brand.text,
    fontWeight: '700',
  },
  readAllTextDisabled: {
    color: colors.brand.textSecondary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  filterPill: {
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  filterPillActive: {
    backgroundColor: colors.brand.secondary,
  },
  filterText: {
    ...typography.caption,
    color: colors.brand.text,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#0f1719',
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  itemCard: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  itemUnread: {
    borderColor: colors.brand.secondary,
    backgroundColor: 'rgba(43, 191, 227, 0.05)',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  itemIcon: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  itemTitle: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
    flex: 1,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.primary,
  },
  itemBody: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemType: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  itemDate: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  stateText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
});
