import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Calendar, MapPin, Eye } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { EventsService } from '@/services/events.service';
import type { EventWithCreator } from '@/types/database';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { AppBackground } from '@/components/ui';

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
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.brand.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes évènements</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={colors.brand.secondary} />
            <Text style={styles.centerText}>Chargement…</Text>
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
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() =>
                    router.push(
                      (isEditable ? `/events/create/step-1?edit=${item.id}` : `/events/${item.id}`) as any
                    )
                  }
                  activeOpacity={0.85}
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
    // backgroundColor: colors.neutral[50], // Removed for global background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.h5,
    color: colors.brand.text,
  },
  headerSpacer: {
    width: 36,
    height: 36,
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

