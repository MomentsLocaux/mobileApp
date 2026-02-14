import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Calendar, MapPin } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground, Card, TopBar, colors, radius, spacing, typography } from '@/components/ui/v2';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { useAuth } from '@/hooks';
import { EventsService } from '@/services/events.service';
import type { EventWithCreator } from '@/types/database';

type StatusMeta = {
  label: string;
  textColor: string;
  backgroundColor: string;
};

const getModerationStatusMeta = (status: string | null | undefined): StatusMeta => {
  if (status === 'draft') {
    return {
      label: 'Brouillon',
      textColor: colors.textSecondary,
      backgroundColor: 'rgba(148, 163, 184, 0.18)',
    };
  }
  if (status === 'pending') {
    return {
      label: 'En validation',
      textColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.18)',
    };
  }
  if (status === 'published') {
    return {
      label: 'Publié',
      textColor: colors.success,
      backgroundColor: 'rgba(52, 199, 89, 0.18)',
    };
  }
  if (status === 'refused') {
    return {
      label: 'Refusé',
      textColor: colors.danger,
      backgroundColor: 'rgba(255, 90, 102, 0.18)',
    };
  }
  if (status === 'archived') {
    return {
      label: 'Archivé',
      textColor: colors.textMuted,
      backgroundColor: 'rgba(107, 124, 133, 0.18)',
    };
  }
  return {
    label: status || 'Inconnu',
    textColor: colors.textSecondary,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
  };
};

const getTemporalLabel = (startsAt?: string | null, endsAt?: string | null) => {
  const now = new Date();
  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  if (end && !Number.isNaN(end.getTime()) && end < now) return 'Passé';
  if (start > now) return 'À venir';
  return 'En cours';
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function MyEventsScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const isGuest = !session;
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!profile?.id) {
      setEvents([]);
      return;
    }
    setLoading(true);
    try {
      const data = await EventsService.listEventsByCreator(profile.id);
      setEvents(data);
    } catch (error) {
      console.warn('load my events', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bDate - aDate;
    });
  }, [events]);

  if (isGuest) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppBackground opacity={0.18} />
        <GuestGateModal
          visible
          title="Mes évènements"
          onClose={() => router.replace('/(tabs)/map')}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AppBackground opacity={0.18} />
      <View style={styles.topBarWrap}>
        <TopBar title="Mes évènements" onBack={() => router.back()} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.centerText}>Chargement...</Text>
        </View>
      ) : (
        <FlatList
          data={sortedEvents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.centerText}>Aucun évènement créé.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusMeta = getModerationStatusMeta(item.status);
            const temporalLabel = getTemporalLabel(item.starts_at, item.ends_at);
            const isEditable = item.status === 'draft' || item.status === 'refused';

            return (
              <Card
                padding="md"
                onPress={() =>
                  router.push(
                    (isEditable ? `/events/create/step-1?edit=${item.id}` : `/events/${item.id}`) as any
                  )
                }
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title || 'Sans titre'}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusMeta.backgroundColor }]}>
                    <Text style={[styles.statusText, { color: statusMeta.textColor }]}>{statusMeta.label}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <MapPin size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {item.city || item.address || 'Lieu inconnu'}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Calendar size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>
                    {formatDate(item.starts_at)}
                    {temporalLabel ? ` · ${temporalLabel}` : ''}
                  </Text>
                </View>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBarWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  card: {
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  centerText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
