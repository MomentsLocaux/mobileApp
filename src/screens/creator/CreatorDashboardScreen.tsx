import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, Users } from 'lucide-react-native';
import { Button, Card, AppBackground } from '@/components/ui';
import { CreatorEngagementChart, CreatorKpiRow, CreatorTopEventsList } from '@/components/creator';
import type { EngagementRange } from '@/components/creator/CreatorEngagementChart';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { useCreatorDashboard } from '@/hooks/useCreatorDashboard';
import type { EventEngagementStats } from '@/types/creator.types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function buildRangeSeries(
  eventStats: EventEngagementStats[],
  range: EngagementRange,
  engagementScore: number,
) {
  const now = Date.now();
  const config =
    range === '7D'
      ? { days: 7, points: 7 }
      : range === '30D'
        ? { days: 30, points: 10 }
        : { days: 90, points: 12 };

  const bucketDays = Math.ceil(config.days / config.points);
  const values: number[] = new Array(config.points).fill(0);

  for (const row of eventStats) {
    const baseDate = row.updated_at || row.event?.starts_at;
    if (!baseDate) continue;

    const parsed = new Date(baseDate).getTime();
    if (Number.isNaN(parsed)) continue;

    const diffDays = Math.floor((now - parsed) / DAY_MS);
    if (diffDays < 0 || diffDays > config.days) continue;

    const fromEnd = Math.floor(diffDays / bucketDays);
    const bucketIndex = Math.max(0, config.points - 1 - fromEnd);

    const weighted =
      row.engagement_score ||
      Math.round(row.likes_count * 2 + row.comments_count * 3 + row.views_count * 0.3 + row.checkins_count * 4);

    values[bucketIndex] += weighted;
  }

  const hasSignal = values.some((value) => value > 0);
  if (!hasSignal && engagementScore > 0) {
    values[values.length - 1] = engagementScore;
  }

  return values.map((value, index) => {
    const offsetDays = Math.max(0, (config.points - 1 - index) * bucketDays);
    return {
      label: offsetDays === 0 ? 'Auj.' : `J-${offsetDays}`,
      value,
    };
  });
}

export default function CreatorDashboardScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const isGuest = !session;
  const handleExitCreator = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/map' as any);
  };

  const { stats, eventStats, loading, error, refresh } = useCreatorDashboard(profile?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [activeRange, setActiveRange] = useState<EngagementRange>('7D');

  const topEvents = useMemo(() => eventStats.slice(0, 10), [eventStats]);

  const chartDataByRange = useMemo(
    () => ({
      '7D': buildRangeSeries(eventStats, '7D', Number(stats?.engagement_score ?? 0)),
      '30D': buildRangeSeries(eventStats, '30D', Number(stats?.engagement_score ?? 0)),
      '90D': buildRangeSeries(eventStats, '90D', Number(stats?.engagement_score ?? 0)),
    }),
    [eventStats, stats?.engagement_score],
  );

  const creatorLevel = useMemo(() => {
    const score = Number(stats?.engagement_score ?? 0);
    return Math.max(1, Math.floor(score / 100) + 1);
  }, [stats?.engagement_score]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleRangeChange = (range: EngagementRange) => {
    LayoutAnimation.configureNext({
      duration: 180,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    setActiveRange(range);
  };

  if (isGuest) {
    return (
      <View style={styles.container}>
        <AppBackground opacity={0.9} />
        <GuestGateModal
          visible
          title="Dashboard créateur"
          onClose={() => router.replace('/(tabs)/map')}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />}
    >
      <AppBackground />
      <View style={styles.topActions}>
        <Button
          title="Quitter"
          size="sm"
          variant="secondary"
          onPress={handleExitCreator}
          accessibilityRole="button"
          accessibilityLabel="Quitter l'espace créateur"
        />
      </View>

      <LinearGradient colors={[colors.primary[700], colors.primary[600]]} style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{(profile?.display_name || 'C').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Lv {creatorLevel}</Text>
            </View>
          </View>

          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Creator Dashboard</Text>
            <Text style={styles.heroSubtitle} numberOfLines={2}>
              {profile?.display_name || 'Créateur'} · Performance et communauté en temps réel.
            </Text>
          </View>
        </View>

        <View style={styles.heroMetrics}>
          <View style={styles.heroMetricItem}>
            <Text style={styles.heroMetricValue}>{stats?.total_events ?? 0}</Text>
            <Text style={styles.heroMetricLabel}>Événements</Text>
          </View>
          <View style={styles.heroMetricItem}>
            <Text style={styles.heroMetricValue}>{stats?.total_followers ?? 0}</Text>
            <Text style={styles.heroMetricLabel}>Followers</Text>
          </View>
          <View style={styles.heroMetricItem}>
            <Text style={styles.heroMetricValue}>{stats?.engagement_score ?? 0}</Text>
            <Text style={styles.heroMetricLabel}>Score</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>KPIs</Text>
        <Text style={styles.sectionSubtitle}>Balayez horizontalement pour explorer</Text>
      </View>
      <CreatorKpiRow stats={stats} />

      <CreatorEngagementChart
        dataByRange={chartDataByRange}
        activeRange={activeRange}
        onRangeChange={handleRangeChange}
      />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.brand.primary} />
          <Text style={styles.loadingText}>Chargement des statistiques…</Text>
        </View>
      ) : null}

      {error ? (
        <Card padding="md" style={styles.errorCard}>
          <Text style={styles.errorTitle}>Impossible de charger les statistiques.</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Réessayer" size="sm" onPress={() => refresh()} />
        </Card>
      ) : null}

      <View style={styles.topEventsHeader}>
        <View>
          <Text style={styles.sectionTitle}>Top événements</Text>
          <Text style={styles.sectionSubtitle}>Classés par score d'engagement</Text>
        </View>
        <Button
          title="Communauté"
          size="sm"
          variant="secondary"
          onPress={() => router.push('/creator/fans' as any)}
        />
      </View>

      <CreatorTopEventsList
        events={topEvents}
        onOpenEvent={(eventId) => router.push(`/events/${eventId}` as any)}
      />

      <Card padding="md" elevation="sm" style={styles.ctaCard}>
        <View style={styles.ctaIconWrap}>
          <Users size={16} color={colors.brand.secondary} />
        </View>
        <View style={styles.ctaTextWrap}>
          <Text style={styles.ctaTitle}>Communauté & Récompenses</Text>
          <Text style={styles.ctaBody}>Analysez vos fans et lancez des actions rapides depuis un hub dédié.</Text>
        </View>
        <Button
          title="Ouvrir"
          size="sm"
          onPress={() => router.push('/creator/fans' as any)}
          style={styles.ctaButton}
          accessibilityLabel="Ouvrir la communauté créateur"
          accessibilityRole="button"
        />
        <ArrowUpRight size={16} color={colors.brand.secondary} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  hero: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarWrap: {
    position: 'relative',
    width: 64,
    height: 64,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.brand.secondary,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  avatarInitial: {
    ...typography.h4,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  levelBadge: {
    position: 'absolute',
    right: -8,
    bottom: -6,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 4,
    backgroundColor: colors.brand.secondary,
  },
  levelText: {
    ...typography.caption,
    color: colors.brand.surface,
    fontWeight: '700',
  },
  heroTextWrap: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    ...typography.h5,
    color: colors.brand.secondary,
  },
  heroSubtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  heroMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroMetricItem: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroMetricValue: {
    ...typography.h6,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  heroMetricLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.88)',
  },
  sectionHeader: {
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.h5,
    color: colors.brand.text,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: colors.error[500],
    backgroundColor: colors.error[50],
    gap: spacing.sm,
  },
  errorTitle: {
    ...typography.body,
    color: colors.error[700],
    fontWeight: '700',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error[700],
  },
  topEventsHeader: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ctaIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ctaTextWrap: {
    flex: 1,
    gap: 2,
  },
  ctaTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  ctaBody: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  ctaButton: {
    minWidth: 92,
  },
});
