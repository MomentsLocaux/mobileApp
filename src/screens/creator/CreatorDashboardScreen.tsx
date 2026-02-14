import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutAnimation,
  Platform,
  RefreshControl,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, Users } from 'lucide-react-native';
import { CreatorEngagementChart, CreatorKpiRow, CreatorTopEventsList } from '@/components/creator';
import type { EngagementRange } from '@/components/creator/CreatorEngagementChart';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import {
  Badge,
  Button,
  Card,
  ScreenLayout,
  Typography,
  colors,
  radius,
  spacing,
} from '@/components/ui/v2';
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
      <View style={styles.guestContainer}>
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
    <ScreenLayout
      header={
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Typography variant="sectionTitle" color={colors.textPrimary} weight="700">
              Creator Dashboard
            </Typography>
            <Typography variant="body" color={colors.textSecondary}>
              Performance et communauté en temps réel.
            </Typography>
          </View>

          <View style={styles.headerActions}>
            <Button
              title="Fans"
              size="sm"
              variant="secondary"
              onPress={() => router.push('/creator/fans' as any)}
              accessibilityRole="button"
            />
            <Button
              title="Quitter"
              size="sm"
              variant="secondary"
              onPress={handleExitCreator}
              accessibilityRole="button"
              accessibilityLabel="Quitter l'espace créateur"
            />
          </View>
        </View>
      }
      contentContainerStyle={styles.content}
      scrollViewProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />,
      }}
    >
      <LinearGradient colors={[colors.accent, colors.primary]} style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Typography variant="subsection" color={colors.textPrimary} weight="700">
                  {(profile?.display_name || 'C').charAt(0).toUpperCase()}
                </Typography>
              </View>
            )}

            <View style={styles.levelBadge}>
              <Typography variant="caption" color={colors.background} weight="700">
                Lv {creatorLevel}
              </Typography>
            </View>
          </View>

          <View style={styles.heroTextWrap}>
            <Badge label="Analytics" style={styles.heroAnalyticsBadge} />
            <Typography variant="subsection" color={colors.textPrimary} weight="700">
              {profile?.display_name || 'Créateur'}
            </Typography>
            <Typography variant="caption" color="rgba(255,255,255,0.9)">
              Vue consolidée des KPIs, événements et engagement.
            </Typography>
          </View>
        </View>

        <View style={styles.heroMetrics}>
          <View style={styles.heroMetricItem}>
            <Typography variant="subsection" color={colors.textPrimary} weight="700">
              {stats?.total_events ?? 0}
            </Typography>
            <Typography variant="caption" color="rgba(255,255,255,0.88)">
              Événements
            </Typography>
          </View>

          <View style={styles.heroMetricItem}>
            <Typography variant="subsection" color={colors.textPrimary} weight="700">
              {stats?.total_followers ?? 0}
            </Typography>
            <Typography variant="caption" color="rgba(255,255,255,0.88)">
              Followers
            </Typography>
          </View>

          <View style={styles.heroMetricItem}>
            <Typography variant="subsection" color={colors.textPrimary} weight="700">
              {stats?.engagement_score ?? 0}
            </Typography>
            <Typography variant="caption" color="rgba(255,255,255,0.88)">
              Score
            </Typography>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.sectionHeader}>
        <Typography variant="subsection" color={colors.textPrimary} weight="700">
          KPIs
        </Typography>
        <Typography variant="caption" color={colors.textSecondary}>
          Balayez horizontalement pour explorer
        </Typography>
      </View>
      <CreatorKpiRow stats={stats} />

      <CreatorEngagementChart
        dataByRange={chartDataByRange}
        activeRange={activeRange}
        onRangeChange={handleRangeChange}
      />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Typography variant="body" color={colors.textSecondary}>
            Chargement des statistiques...
          </Typography>
        </View>
      ) : null}

      {error ? (
        <Card padding="md" style={styles.errorCard}>
          <Typography variant="body" color={colors.danger} weight="700">
            Impossible de charger les statistiques.
          </Typography>
          <Typography variant="body" color={colors.textSecondary}>
            {error}
          </Typography>
          <Button title="Réessayer" size="sm" onPress={() => refresh()} accessibilityRole="button" />
        </Card>
      ) : null}

      <View style={styles.topEventsHeader}>
        <View style={styles.sectionHeader}>
          <Typography variant="subsection" color={colors.textPrimary} weight="700">
            Top événements
          </Typography>
          <Typography variant="caption" color={colors.textSecondary}>
            Classés par score d'engagement
          </Typography>
        </View>

        <Button
          title="Communauté"
          size="sm"
          variant="secondary"
          onPress={() => router.push('/creator/fans' as any)}
          accessibilityRole="button"
        />
      </View>

      <CreatorTopEventsList
        events={topEvents}
        onOpenEvent={(eventId) => router.push(`/events/${eventId}` as any)}
      />

      <Card padding="md" style={styles.ctaCard} onPress={() => router.push('/creator/fans' as any)}>
        <View style={styles.ctaIconWrap}>
          <Users size={16} color={colors.primary} />
        </View>

        <View style={styles.ctaTextWrap}>
          <Typography variant="body" color={colors.textPrimary} weight="700">
            Communauté & Rewards
          </Typography>
          <Typography variant="caption" color={colors.textSecondary}>
            Analysez vos fans et lancez des actions rapides depuis un hub dédié.
          </Typography>
        </View>

        <ArrowUpRight size={16} color={colors.primary} />
      </Card>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  guestContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hero: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    padding: spacing.lg,
    gap: spacing.lg,
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
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  levelBadge: {
    position: 'absolute',
    right: -8,
    bottom: -6,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 4,
    backgroundColor: colors.textPrimary,
  },
  heroTextWrap: {
    flex: 1,
    gap: 4,
  },
  heroAnalyticsBadge: {
    backgroundColor: 'rgba(15, 23, 25, 0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroMetricItem: {
    flex: 1,
    borderRadius: radius.element,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  sectionHeader: {
    gap: 2,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  errorCard: {
    gap: spacing.sm,
    borderColor: 'rgba(255, 90, 102, 0.4)',
  },
  topEventsHeader: {
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
    borderRadius: radius.element,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43, 191, 227, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(43, 191, 227, 0.35)',
  },
  ctaTextWrap: {
    flex: 1,
    gap: 2,
  },
});
