import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card } from '@/components/ui';
import { CreatorKpiRow, CreatorTopEventsList } from '@/components/creator';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { useCreatorDashboard } from '@/hooks/useCreatorDashboard';

export default function CreatorDashboardScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const isGuest = !session;

  const { stats, eventStats, loading, error, refresh } = useCreatorDashboard(profile?.id);
  const [refreshing, setRefreshing] = useState(false);

  const topEvents = useMemo(() => eventStats.slice(0, 10), [eventStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (isGuest) {
    return (
      <View style={styles.container}>
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Dashboard</Text>
        <Button title="Communauté" size="sm" variant="outline" onPress={() => router.push('/creator/fans' as any)} />
      </View>

      <CreatorKpiRow stats={stats} />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary[600]} />
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

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top événements</Text>
        <Text style={styles.sectionSubtitle}>Classés par score d'engagement</Text>
      </View>

      <CreatorTopEventsList
        events={topEvents}
        onOpenEvent={(eventId) => router.push(`/events/${eventId}` as any)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  errorCard: {
    borderRadius: borderRadius.lg,
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
  sectionHeader: {
    marginTop: spacing.sm,
    gap: 2,
  },
  sectionTitle: {
    ...typography.h5,
    color: colors.neutral[900],
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.neutral[600],
  },
});
