import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Trophy, ArrowLeft } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { AppBackground } from '@/components/ui';
import { ContestsService, type Contest } from '@/features/contests';

export default function ContestsHubScreen() {
  const router = useRouter();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await ContestsService.listVisible();
      setContests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les concours.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.wrapper}>
      <AppBackground />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <ArrowLeft size={20} color={colors.neutral[100]} />
        </TouchableOpacity>
        <Text style={styles.title}>Concours</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={contests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>{error || 'Aucun concours disponible pour le moment.'}</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/contests/${item.id}` as any)}
              accessibilityRole="button"
            >
              {item.cover_url ? (
                <Image source={{ uri: item.cover_url }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverFallback]}>
                  <Trophy size={28} color={colors.brand.primary} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {item.theme ? <Text style={styles.theme}>{item.theme}</Text> : null}
                <Text style={styles.meta}>
                  {item.status.toUpperCase()} · jusqu’au {new Date(item.end_at).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xl + spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { padding: spacing.xs },
  title: { ...typography.h2, color: colors.neutral[50] },
  list: { padding: spacing.lg, gap: spacing.md },
  empty: { ...typography.body, color: colors.neutral[400], textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.neutral[900],
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral[800],
  },
  cover: { width: '100%', height: 140, backgroundColor: colors.neutral[800] },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: spacing.md, gap: 4 },
  cardTitle: { ...typography.h3, color: colors.neutral[50] },
  theme: { ...typography.caption, color: colors.brand.primary },
  meta: { ...typography.caption, color: colors.neutral[400] },
});
