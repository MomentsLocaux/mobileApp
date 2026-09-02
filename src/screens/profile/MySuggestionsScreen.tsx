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
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { AppBackground, ScreenHeader } from '@/components/ui';
import { FilterChipRow } from '@/components/filters/FilterChipRow';
import {
  loadMySuggestionHistory,
  peekMySuggestionHistory,
} from '@/services/suggestion-history.service';
import { EVENT_CORRECTION_DAILY_QUOTA } from '@/types/event-correction';
import { countTodayCorrectionProposals, formatCorrectionQuotaLabel } from '@/utils/event-correction';
import { haptics } from '@/utils/haptics';
import {
  SUGGESTION_FILTER_OPTIONS,
  filterSuggestionHistory,
  labelForSuggestionKind,
  type SuggestionFilter,
  type SuggestionHistoryItem,
  type SuggestionStatusTone,
} from '@/utils/suggestion-history';

const toneColors = (tone: SuggestionStatusTone) => {
  if (tone === 'pending') {
    return { text: colors.warning[700], background: colors.warning[0] };
  }
  if (tone === 'success') {
    return { text: colors.success[700], background: colors.success[0] };
  }
  if (tone === 'danger') {
    return { text: colors.error[700], background: colors.error[0] };
  }
  if (tone === 'info') {
    return { text: colors.info[700], background: colors.info[0] };
  }
  return { text: colors.brand.textSecondary, background: colors.brand.surfaceMuted };
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

export default function MySuggestionsScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const isGuest = !session;
  const cached = profile?.id ? peekMySuggestionHistory(profile.id) : null;
  const [items, setItems] = useState<SuggestionHistoryItem[]>(() => cached?.items ?? []);
  const [filter, setFilter] = useState<SuggestionFilter>('all');
  const [loading, setLoading] = useState(() => !cached);
  const [refreshing, setRefreshing] = useState(false);
  const [partialError, setPartialError] = useState(() => cached?.failed ?? false);

  const loadItems = useCallback(
    async (mode: 'focus' | 'refresh' = 'focus') => {
      if (!profile?.id) {
        setItems([]);
        setPartialError(false);
        setLoading(false);
        return;
      }

      const existing = peekMySuggestionHistory(profile.id);
      if (existing) {
        setItems(existing.items);
        setPartialError(existing.failed);
        setLoading(false);
      } else if (mode !== 'refresh') {
        setLoading(true);
      }

      try {
        const result = await loadMySuggestionHistory(profile.id, { force: mode === 'refresh' });
        setItems(result.items);
        setPartialError(result.failed);
      } catch (error) {
        console.warn('load my suggestions', error);
        if (!peekMySuggestionHistory(profile.id)) {
          setItems([]);
        }
        setPartialError(true);
      } finally {
        setLoading(false);
      }
    },
    [profile?.id],
  );

  useFocusEffect(
    useCallback(() => {
      void loadItems('focus');
    }, [loadItems]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadItems('refresh');
    setRefreshing(false);
  }, [loadItems]);

  const visibleItems = useMemo(
    () => filterSuggestionHistory(items, filter),
    [filter, items],
  );
  const quotaUsedToday = useMemo(() => countTodayCorrectionProposals(items), [items]);
  const quotaLabel = formatCorrectionQuotaLabel(quotaUsedToday);
  const quotaReached = quotaUsedToday >= EVENT_CORRECTION_DAILY_QUOTA;

  if (isGuest) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppBackground />
        <GuestGateModal
          visible
          title="Mes suggestions"
          onClose={() => router.replace('/(tabs)/map')}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </SafeAreaView>
    );
  }

  const openItem = (item: SuggestionHistoryItem) => {
    if (!item.href) return;
    haptics.selection();
    router.push(item.href as any);
  };

  return (
    <View style={styles.safe}>
      <AppBackground />
      <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
        <ScreenHeader title="Mes suggestions" onBack={() => router.back()} />

        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand.secondary}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <Text style={styles.intro}>
                L’historique de tes propositions : événements, corrections, doublons et retours.
              </Text>
              <Text
                style={[styles.quotaLabel, quotaReached && styles.quotaLabelReached]}
                accessibilityLabel={quotaLabel}
              >
                Corrections et doublons : {quotaLabel}
                {quotaReached ? ' — limite atteinte' : ''}
              </Text>
              {partialError ? (
                <Text style={styles.partialError}>
                  Certaines contributions n’ont pas pu être chargées. Tire pour actualiser.
                </Text>
              ) : null}
              <FilterChipRow
                options={SUGGESTION_FILTER_OPTIONS}
                value={filter}
                onChange={(next) => setFilter(next ?? 'all')}
                accessibilityLabel="Filtrer les suggestions"
              />
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.skeletonList} accessibilityLabel="Chargement des suggestions">
                <View style={styles.skelCard} />
                <View style={styles.skelCard} />
                <View style={styles.skelCard} />
              </View>
            ) : (
              <View style={styles.centerState}>
                <Text style={styles.centerText}>
                  {filter === 'all'
                    ? 'Aucune suggestion pour le moment.'
                    : 'Rien dans cette catégorie pour le moment.'}
                </Text>
              </View>
            )
          }
            renderItem={({ item }) => {
              const statusColors = toneColors(item.tone);
              const tappable = Boolean(item.href);
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => openItem(item)}
                  activeOpacity={tappable ? 0.85 : 1}
                  disabled={!tappable}
                  accessibilityRole={tappable ? 'button' : 'text'}
                  accessibilityLabel={`${labelForSuggestionKind(item.kind)}, ${item.title}, ${item.statusLabel}`}
                >
                  <View style={styles.kindRow}>
                    <Text style={styles.kindLabel}>{labelForSuggestionKind(item.kind)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColors.background }]}>
                      <Text style={[styles.statusText, { color: statusColors.text }]}>
                        {item.statusLabel}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text style={styles.metaText} numberOfLines={2}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                  {item.reviewNote ? (
                    <View
                      style={[
                        styles.noteBox,
                        item.tone === 'danger' ? styles.noteBoxDanger : styles.noteBoxMuted,
                      ]}
                    >
                      <Text
                        style={[
                          styles.noteLabel,
                          item.tone === 'danger' ? styles.noteLabelDanger : styles.noteLabelMuted,
                        ]}
                      >
                        Retour de modération
                      </Text>
                      <Text style={styles.noteText}>{item.reviewNote}</Text>
                    </View>
                  ) : null}
                  {item.createdAt ? (
                    <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  skeletonList: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  skelCard: {
    height: 88,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surfaceMuted,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  headerBlock: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  intro: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  quotaLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  quotaLabelReached: {
    color: colors.warning[700],
  },
  partialError: {
    ...typography.caption,
    color: colors.warning[700],
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.08)',
    backgroundColor: colors.brand.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kindLabel: {
    flex: 1,
    ...typography.caption,
    fontWeight: '700',
    color: colors.brand.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardTitle: {
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
  metaText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  dateText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  noteBox: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: 4,
    borderWidth: 1,
  },
  noteBoxDanger: {
    backgroundColor: colors.error[0],
    borderColor: 'rgba(230, 57, 70, 0.2)',
  },
  noteBoxMuted: {
    backgroundColor: colors.brand.surfaceMuted,
    borderColor: 'rgba(26, 51, 41, 0.08)',
  },
  noteLabel: {
    ...typography.caption,
    fontWeight: '700',
  },
  noteLabelDanger: {
    color: colors.error[700],
  },
  noteLabelMuted: {
    color: colors.brand.textSecondary,
  },
  noteText: {
    ...typography.bodySmall,
    color: colors.brand.text,
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
