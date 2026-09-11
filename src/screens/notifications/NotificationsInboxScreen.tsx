import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  Bell,
  CalendarCheck2,
  Image as ImageIcon,
  MapPin,
  MessageSquareWarning,
  ShieldAlert,
  Trophy,
  UserPlus,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { useAuthStore } from '@/state/auth';
import { NotificationsService, type AppNotification, type AppNotificationType, type NotificationVisual, hasFreshInboxCache, peekInboxCache } from '@/services/notifications.service';
import { resolveNotificationRoute } from '@/utils/notification-routing';
import { EmptyState, ScreenHeader, SkeletonBlock } from '@/components/ui';
import { CONTRIBUTION_FAB_STACK_SPACE } from '@/utils/contribution-fab';
import { getCategoryColor, getCategoryLucideIcon, getCategoryTextColor } from '@/constants/categories';
import {
  MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL,
  MOMENTS_LOCAUX_ORGANIZER_AVATAR_URL,
} from '@/constants/branding';

type FilterMode = 'all' | 'unread';

type InboxSection = {
  title: string | null;
  data: AppNotification[];
};

const AVATAR_SIZE = 56;
const BADGE_SIZE = 22;
const UNREAD_FILL = 'rgba(124, 181, 24, 0.16)';

const GENERIC_TITLES = new Set([
  'Événement à venir',
  'Nouvel événement près de chez vous',
  'Invitation privée',
]);

const SUPPORTING_COPY: Partial<Record<AppNotificationType, string>> = {
  event_soon: 'commence bientôt',
  event_nearby_new: 'près de chez vous',
  event_nearby_live: 'a lieu près de vous',
  event_published: 'vient d’être publié',
  followed_creator_published: 'a publié un événement',
  social_follow: 'vous suit désormais',
  social_like: 'a aimé un moment',
  event_refused: 'n’a pas été retenu',
  event_request_changes: 'demande des modifications',
  media_approved: 'média accepté',
  media_rejected: 'média refusé',
};

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

const getFollowerNameFromNotification = (item: AppNotification): string | null => {
  const data = asRecord(item.data);
  const candidates = [
    data.followerName,
    data.follower_name,
    data.actorName,
    data.actor_name,
    data.displayName,
    data.display_name,
    data.username,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
};

const formatNotificationText = (item: AppNotification) => {
  const followerName = getFollowerNameFromNotification(item);
  const safeFollowerName = followerName || 'Quelqu’un';
  const title = item.title?.includes('%s') ? item.title.replace(/%s/g, safeFollowerName) : item.title;
  let body = item.body;

  if (body?.includes('%s')) {
    body = body.replace(/%s/g, safeFollowerName);
  }

  if (item.type === 'social_follow' && !body) {
    body = `${safeFollowerName} vous suit désormais.`;
  }

  return { title, body };
};

const formatRelative = (value: string) => {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const delta = Date.now() - t;
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return 'à l’instant';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} j`;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(new Date(value));
};

const typeIcon = (type: AppNotificationType): LucideIcon => {
  if (type === 'social_follow' || type === 'social_like') return UserPlus;
  if (type === 'event_published' || type === 'event_refused' || type === 'event_request_changes') {
    return CalendarCheck2;
  }
  if (type === 'event_nearby_new' || type === 'event_nearby_live' || type === 'event_soon') {
    return MapPin;
  }
  if (type === 'media_approved' || type === 'media_rejected') {
    return ImageIcon;
  }
  if (type === 'warning_received' || type === 'user_banned') {
    return ShieldAlert;
  }
  if (type === 'contest_entry_refused' || type === 'contest_results') {
    return Trophy;
  }
  if (type === 'moderation_escalation') {
    return MessageSquareWarning;
  }
  return Bell;
};

const buildVisualCopy = (item: AppNotification, visual?: NotificationVisual) => {
  const formatted = formatNotificationText(item);
  const followerName = visual?.actorName || getFollowerNameFromNotification(item);
  const headline =
    visual?.eventTitle ||
    (item.type === 'social_follow' ? followerName || formatted.title : null) ||
    (formatted.body && GENERIC_TITLES.has(formatted.title) ? formatted.body : formatted.title);

  const supporting =
    SUPPORTING_COPY[item.type] ||
    (formatted.body && formatted.body !== headline ? formatted.body : null) ||
    (formatted.title !== headline && !GENERIC_TITLES.has(formatted.title) ? formatted.title : null);

  return { headline, supporting };
};

function NotificationAvatar({
  uri,
  categorySlug,
  type,
}: {
  uri: string | null;
  categorySlug: string | null;
  type: AppNotificationType;
}) {
  const [failed, setFailed] = useState(false);
  const source = !uri || failed ? MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL : { uri };
  const BadgeIcon = categorySlug ? getCategoryLucideIcon(categorySlug) : typeIcon(type);
  const badgeColor = categorySlug ? getCategoryColor(categorySlug) : colors.brand.secondary;
  const badgeIconColor = categorySlug ? getCategoryTextColor(categorySlug) : colors.brand.onAccent;

  return (
    <View style={styles.avatarWrap}>
      <Image
        source={source}
        defaultSource={MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL}
        onError={() => setFailed(true)}
        style={styles.avatar}
        accessibilityIgnoresInvertColors
      />
      <View style={[styles.typeBadge, { backgroundColor: badgeColor }]}>
        <BadgeIcon size={12} color={badgeIconColor} strokeWidth={2.4} />
      </View>
    </View>
  );
}

export default function NotificationsInboxScreen() {
  const router = useRouter();
  const { profile, user, session, isLoading: authLoading } = useAuth();
  const authInitialized = useAuthStore((state) => state.initialized);
  const userId = profile?.id || user?.id || session?.user?.id || null;
  const isGuest = authInitialized && !authLoading && !userId;
  const [mode, setMode] = useState<FilterMode>('all');
  const cached = userId ? peekInboxCache(userId, mode === 'unread') : null;
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<AppNotification[]>(cached?.items ?? []);
  const [visuals, setVisuals] = useState<Record<string, NotificationVisual>>(cached?.visuals ?? {});
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const applyInbox = useCallback((next: { items: AppNotification[]; visuals: Record<string, NotificationVisual> }) => {
    setItems(next.items);
    setVisuals(next.visuals);
  }, []);

  const loadInbox = useCallback(async (options?: { force?: boolean; silent?: boolean }) => {
    if (!userId) {
      if (!isGuest) {
        setError(null);
        setLoading(true);
        return;
      }
      setItems([]);
      setVisuals({});
      setError('Connectez-vous pour consulter vos notifications.');
      setLoading(false);
      return;
    }
    const unreadOnly = mode === 'unread';
    const existing = peekInboxCache(userId, unreadOnly);
    if (existing) applyInbox(existing);
    if (!existing?.items.length && !options?.silent) {
      setItems([]);
      setVisuals({});
      setLoading(true);
    }

    try {
      const entry = await NotificationsService.loadInbox({
        userId,
        unreadOnly,
        force: options?.force,
      });
      applyInbox(entry);
      setError(null);
    } catch (err) {
      if (!existing?.items.length) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    } finally {
      setLoading(false);
    }
  }, [applyInbox, isGuest, mode, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        if (!isGuest) {
          setError(null);
          setLoading(true);
          return;
        }
        void loadInbox();
        return;
      }
      const unreadOnly = mode === 'unread';
      if (hasFreshInboxCache(userId, unreadOnly)) {
        const fresh = peekInboxCache(userId, unreadOnly);
        if (fresh) applyInbox(fresh);
        setLoading(false);
        return;
      }
      const stale = peekInboxCache(userId, unreadOnly);
      void loadInbox({ silent: Boolean(stale?.items.length) });
    }, [applyInbox, isGuest, loadInbox, mode, userId])
  );

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = NotificationsService.subscribeToMyNotifications(userId, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void loadInbox({ force: true, silent: true });
      }, 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      stop();
    };
  }, [loadInbox, userId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInbox({ force: true, silent: true });
    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    await NotificationsService.markAllAsRead();
    await loadInbox({ force: true, silent: true });
  };

  const handleOpen = async (item: AppNotification) => {
    if (!item.read) {
      try {
        await NotificationsService.markAsRead(item.id);
      } catch { }
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, read: true } : row)));
    }

    if (item.type === 'moderation_escalation') {
      Alert.alert('Signalement reçu', 'Cette notification est prise en charge depuis l’espace admin web.');
    }

    const { href } = resolveNotificationRoute(item.type, item.data);
    router.push(href as any);
  };

  const sections = useMemo<InboxSection[]>(() => {
    if (mode === 'unread') return [{ title: null, data: items }];
    const unread = items.filter((item) => !item.read);
    const read = items.filter((item) => item.read);
    const next: InboxSection[] = [];
    if (unread.length) next.push({ title: 'Nouveau', data: unread });
    if (read.length) next.push({ title: 'Plus tôt', data: read });
    return next;
  }, [items, mode]);

  const renderItem = ({ item }: { item: AppNotification }) => {
    const visual = visuals[item.id];
    const copy = buildVisualCopy(item, visual);
    const relative = formatRelative(item.created_at);
    const accessibilityLabel = [
      copy.headline,
      copy.supporting,
      relative,
      item.read ? undefined : 'non lu',
    ]
      .filter(Boolean)
      .join(', ');

    return (
      <TouchableOpacity
        style={[styles.itemRow, item.read ? styles.itemRead : styles.itemUnread]}
        onPress={() => handleOpen(item)}
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <NotificationAvatar
          uri={visual?.avatarUrl ?? MOMENTS_LOCAUX_ORGANIZER_AVATAR_URL}
          categorySlug={visual?.categorySlug ?? null}
          type={item.type}
        />
        <View style={styles.itemCopy}>
          <Text style={styles.itemText}>
            <Text style={styles.itemHeadline}>{copy.headline}</Text>
            {copy.supporting ? <Text style={styles.itemSupporting}>{` ${copy.supporting}`}</Text> : null}
            {relative ? <Text style={styles.itemDate}>{` · ${relative}`}</Text> : null}
          </Text>
        </View>
        {!item.read ? <View style={styles.unreadDot} /> : <View style={styles.unreadDotSpacer} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <ScreenHeader
        title="Notifications"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }
          router.navigate('/(tabs)');
        }}
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

      {(loading && items.length === 0) || (!userId && !isGuest) ? (
        <View style={styles.listContent} accessibilityLabel="Chargement des notifications" accessibilityRole="progressbar">
          {Array.from({ length: 8 }).map((_, index) => (
            <View key={index} style={[styles.itemRow, index < 3 ? styles.itemUnread : styles.itemRead]}>
              <SkeletonBlock height={AVATAR_SIZE} width={AVATAR_SIZE} radius={borderRadius.full} />
              <View style={styles.itemCopy}>
                <SkeletonBlock height={14} width="86%" />
                <SkeletonBlock height={12} width="48%" />
              </View>
              <SkeletonBlock height={10} width={10} radius={borderRadius.full} />
            </View>
          ))}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          initialNumToRender={12}
          windowSize={8}
          maxToRenderPerBatch={12}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brand.secondary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={Bell}
              title={
                isGuest
                  ? 'Connexion requise'
                  : error
                    ? 'Une erreur est survenue'
                    : mode === 'unread'
                      ? 'Aucune notification non lue'
                      : 'Aucune notification'
              }
              subtitle={
                isGuest
                  ? 'Connectez-vous pour consulter vos notifications.'
                  : error || 'Vous serez notifié ici des nouveautés et de vos activités.'
              }
            />
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
    backgroundColor: colors.brand.surfaceMuted,
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
    backgroundColor: colors.brand.surfaceMuted,
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
    color: colors.brand.onAccent,
  },
  listContent: {
    paddingBottom: spacing.xxl + CONTRIBUTION_FAB_STACK_SPACE,
    flexGrow: 1,
  },
  sectionTitle: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: 'transparent',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  itemUnread: {
    backgroundColor: UNREAD_FILL,
  },
  itemRead: {
    backgroundColor: 'transparent',
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.brand.surfaceMuted,
  },
  typeBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.brand.page,
  },
  itemCopy: {
    flex: 1,
    gap: 6,
  },
  itemText: {
    ...typography.bodySmall,
    color: colors.brand.text,
  },
  itemHeadline: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  itemSupporting: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '400',
  },
  itemDate: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '400',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
  },
  unreadDotSpacer: {
    width: 10,
    height: 10,
  },
});
