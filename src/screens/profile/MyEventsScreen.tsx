import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Calendar, MapPin } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { EventsService } from '@/services/events.service';
import type { EventWithCreator } from '@/types/database';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { AppBackground, EventCardSkeleton, ScreenHeader } from '@/components/ui';

type StatusMeta = {
  label: string;
  textColor: string;
  backgroundColor: string;
};

const getModerationStatusMeta = (status: string | null | undefined): StatusMeta => {
  if (status === 'draft') {
    return {
      label: 'Brouillon',
      textColor: colors.neutral[300],
      backgroundColor: 'rgba(255,255,255,0.1)',
    };
  }
  if (status === 'pending') {
    return {
      label: 'En validation',
      textColor: '#FCD34D', // warning-300
      backgroundColor: 'rgba(251, 191, 36, 0.15)', // warning-500 @ 15%
    };
  }
  if (status === 'published') {
    return {
      label: 'Publié',
      textColor: '#6EE7B7', // success-300
      backgroundColor: 'rgba(52, 211, 153, 0.15)', // success-500 @ 15%
    };
  }
  if (status === 'refused') {
    return {
      label: 'Refusé',
      textColor: '#FCA5A5', // error-300
      backgroundColor: 'rgba(239, 68, 68, 0.15)', // error-500 @ 15%
    };
  }
  if (status === 'archived') {
    return {
      label: 'Archivé',
      textColor: colors.neutral[400],
      backgroundColor: 'rgba(255,255,255,0.05)',
    };
  }
  return {
    label: status || 'Inconnu',
    textColor: colors.neutral[300],
    backgroundColor: 'rgba(255,255,255,0.1)',
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
        <AppBackground />
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
    <View style={styles.safe}>
      <AppBackground />
      <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
        <ScreenHeader title="Mes évènements" onBack={() => router.back()} />

        {loading && !refreshing ? (
          <View style={styles.skeletonWrap}>
            <EventCardSkeleton count={2} />
          </View>
        ) : (
          <FlatList
            data={sortedEvents}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.secondary} />}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Text style={styles.centerText}>Aucun évènement créé.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const statusMeta = getModerationStatusMeta(item.status);
              const temporalLabel = getTemporalLabel(item.starts_at, item.ends_at);
              const isEditable = item.status === 'draft' || item.status === 'refused';
              const isRefused = item.status === 'refused';
              const refusalReason = item.refusal_reason?.trim() || null;
              const editHref = `/events/create/step-1?edit=${item.id}`;

              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() =>
                    router.push((isEditable ? editHref : `/events/${item.id}`) as any)
                  }
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title || 'Sans titre'}, ${statusMeta.label}`}
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
                    <MapPin size={14} color={colors.brand.textSecondary} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {item.city || item.address || 'Lieu inconnu'}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Calendar size={14} color={colors.brand.textSecondary} />
                    <Text style={styles.metaText}>
                      {formatDate(item.starts_at)}
                      {temporalLabel ? ` · ${temporalLabel}` : ''}
                    </Text>
                  </View>

                  {isRefused ? (
                    <View style={styles.refusalBox}>
                      <Text style={styles.refusalLabel}>Motif du refus</Text>
                      <Text style={styles.refusalText}>
                        {refusalReason || 'Motif non précisé. Corrigez votre événement puis resoumettez-le.'}
                      </Text>
                      <TouchableOpacity
                        style={styles.resubmitBtn}
                        onPress={() => router.push(editHref as any)}
                        accessibilityRole="button"
                        accessibilityLabel="Modifier et resoumettre"
                      >
                        <Text style={styles.resubmitText}>Modifier et resoumettre</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  skeletonWrap: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.brand.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: borderRadius.full,
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
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    flex: 1,
  },
  refusalBox: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    gap: spacing.xs,
  },
  refusalLabel: {
    ...typography.caption,
    color: '#FCA5A5',
    fontWeight: '700',
  },
  refusalText: {
    ...typography.bodySmall,
    color: colors.brand.text,
  },
  resubmitBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
    minHeight: 40,
    justifyContent: 'center',
  },
  resubmitText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: '800',
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  centerText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
});
