import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui';
import { CreatorFanItem } from '@/components/creator';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { useCreatorFans } from '@/hooks/useCreatorFans';

export default function CreatorFansScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const isGuest = !session;

  const { fans, loading, error, refresh } = useCreatorFans(profile?.id, 30);

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  if (isGuest) {
    return (
      <View style={styles.container}>
        <GuestGateModal
          visible
          title="Communauté créateur"
          onClose={() => router.replace('/(tabs)/map')}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Top fans</Text>
        <Button
          title="Dashboard"
          size="sm"
          variant="outline"
          onPress={() => router.push('/creator/dashboard' as any)}
        />
      </View>

      {loading && !fans.length ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Chargement de la communauté…</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={fans}
        keyExtractor={(item) => item.fan_id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Aucun fan actif pour l'instant.</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => <CreatorFanItem fan={item} rank={index + 1} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error[700],
    marginBottom: spacing.sm,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  emptyBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
});
