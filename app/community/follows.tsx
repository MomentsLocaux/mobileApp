import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground, EmptyState, ScreenHeader } from '@/components/ui';
import { Users } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { CommunityService, type FollowListMember } from '@/services/community.service';
import {
  getVisibleHomeLocations,
  type VisibleHomeLocation,
} from '@/services/home-location.service';
import { buildStaticMapUrl } from '@/utils/static-map-url';
import { useAuth } from '@/hooks';

type FollowTab = 'followers' | 'following';

export default function CommunityFollowsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ userId?: string; tab?: string }>();
  const userId = typeof params.userId === 'string' ? params.userId : '';
  const isOwnList = !!profile?.id && profile.id === userId;
  const initialTab: FollowTab = params.tab === 'following' ? 'following' : 'followers';
  const [tab, setTab] = useState<FollowTab>(initialTab);
  const [members, setMembers] = useState<FollowListMember[]>([]);
  const [locations, setLocations] = useState<Record<string, VisibleHomeLocation>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (direction: FollowTab) => {
      if (!userId) return;
      setLoading(true);
      try {
        const rows = await CommunityService.listFollows(userId, direction);
        setMembers(rows);
        const coords = await getVisibleHomeLocations(rows.map((row) => row.user_id));
        setLocations(coords);
      } catch (error) {
        console.warn('list follows', error);
        setMembers([]);
        setLocations({});
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      void load(tab);
    }, [load, tab]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(tab);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <AppBackground />
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          title={isOwnList ? 'Ma communauté' : tab === 'followers' ? 'Abonnés' : 'Abonnements'}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/community' as any))}
        />
      </View>
      <View style={styles.segmented}>
        <TouchableOpacity
          style={[styles.segment, tab === 'followers' && styles.segmentActive]}
          onPress={() => setTab('followers')}
        >
          <Text style={[styles.segmentText, tab === 'followers' && styles.segmentTextActive]}>
            {isOwnList ? 'Ceux qui me suivent' : 'Abonnés'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, tab === 'following' && styles.segmentActive]}
          onPress={() => setTab('following')}
        >
          <Text style={[styles.segmentText, tab === 'following' && styles.segmentTextActive]}>
            {isOwnList ? 'Ceux que je suis' : 'Abonnements'}
          </Text>
        </TouchableOpacity>
      </View>
      {loading && members.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand.secondary} />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.user_id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.secondary} />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon={Users}
              title={tab === 'followers' ? 'Aucun abonné' : 'Aucun abonnement'}
              subtitle={
                tab === 'followers'
                  ? isOwnList
                    ? 'Quand des membres vous suivront, ils apparaîtront ici.'
                    : 'Quand des membres suivront ce profil, ils apparaîtront ici.'
                  : isOwnList
                    ? 'Les personnes que vous suivez apparaîtront ici.'
                    : 'Les personnes suivies par ce profil apparaîtront ici.'
              }
            />
          }
          renderItem={({ item }) => {
            const initial = (item.display_name || '?').slice(0, 1).toUpperCase();
            const coords = locations[item.user_id];
            const mapUrl = coords ? buildStaticMapUrl(coords.lat, coords.lon) : null;
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => router.push(`/community/${item.user_id}` as any)}
                activeOpacity={0.85}
              >
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>{initial}</Text>
                  </View>
                )}
                <View style={styles.body}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.display_name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.city || 'Ville non renseignée'}
                  </Text>
                  {mapUrl ? (
                    <Image source={{ uri: mapUrl }} style={styles.map} />
                  ) : (
                    <Text style={styles.hiddenLocation}>Position non partagée</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: 4,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surfaceMuted,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
  },
  segmentActive: {
    backgroundColor: colors.brand.surface,
  },
  segmentText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: colors.brand.text,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surfaceMuted,
  },
  avatarFallbackText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.brand.text,
  },
  body: {
    flex: 1,
  },
  name: {
    ...typography.body,
    fontWeight: '700',
    color: colors.brand.text,
  },
  meta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  map: {
    marginTop: spacing.sm,
    width: '100%',
    height: 88,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.surfaceMuted,
  },
  hiddenLocation: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: spacing.xs,
  },
});
