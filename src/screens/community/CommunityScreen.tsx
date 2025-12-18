import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { useAuth } from '../../hooks';
import { CommunityService } from '../../services/community.service';
import type { CommunityMember, LeaderboardEntry } from '../../types/community';

type TabKey = 'leaderboard' | 'members';

const SORT_OPTIONS: { key: 'followers' | 'events' | 'lumo'; label: string }[] = [
  { key: 'followers', label: 'Followers' },
  { key: 'events', label: 'Événements' },
  { key: 'lumo', label: 'Lumo' },
];

export default function CommunityScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const [tab, setTab] = useState<TabKey>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);
  const [period, setPeriod] = useState<'monthly' | 'global'>('monthly');
  const [periodPickerVisible, setPeriodPickerVisible] = useState(false);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<'followers' | 'events' | 'lumo'>('followers');
  const [sortPickerVisible, setSortPickerVisible] = useState(false);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const currentUserId = user?.id;
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  const loadLeaderboard = useCallback(async () => {
    try {
      setLoadingBoard(true);
      const data = await CommunityService.listLeaderboard({ period, city: period === 'monthly' ? cityFilter : null });
      setLeaderboard(data);
      if (currentUserId) {
        const mine = await CommunityService.getMyLeaderboardEntry({
          period,
          city: period === 'monthly' ? cityFilter : null,
          userId: currentUserId,
        });
        setMyEntry(mine);
      } else {
        setMyEntry(null);
      }
    } catch (e) {
      console.warn('loadLeaderboard error', e);
      Alert.alert('Erreur', 'Impossible de charger le classement');
    } finally {
      setLoadingBoard(false);
    }
  }, [period, cityFilter, currentUserId]);

  const loadMembers = useCallback(async () => {
    try {
      setLoadingMembers(true);
      let ids: string[] = [];
      if (currentUserId) {
        ids = await CommunityService.getFollowingIds(currentUserId);
        setFollowingIds(ids);
      } else {
        setFollowingIds([]);
      }
      const data = await CommunityService.listMembers({ city: cityFilter, sort, limit: 50 });
      const annotated = data.map((m) => ({
        ...m,
        is_following: currentUserId ? ids.includes(m.user_id) : false,
      }));
      setMembers(annotated);
    } catch (e) {
      console.warn('loadMembers error', e);
      Alert.alert('Erreur', 'Impossible de charger les membres');
    } finally {
      setLoadingMembers(false);
    }
  }, [cityFilter, sort, currentUserId]);

  useEffect(() => {
    if (tab === 'leaderboard') {
      loadLeaderboard();
    } else {
      loadMembers();
    }
  }, [tab, loadLeaderboard, loadMembers]);

  const toggleFollow = async (memberId: string, current: boolean) => {
    if (!currentUserId) {
      Alert.alert('Connexion requise', 'Connectez-vous pour suivre des membres.');
      return;
    }
    // optimistic update
    setMembers((prev) =>
      prev.map((m) => (m.user_id === memberId ? { ...m, is_following: !current, followers_count: m.followers_count + (current ? -1 : 1) } : m))
    );
    try {
      if (current) {
        await CommunityService.unfollow(memberId);
      } else {
        await CommunityService.follow(memberId);
      }
    } catch (e) {
      console.warn('follow/unfollow error', e);
      // revert
      setMembers((prev) =>
        prev.map((m) => (m.user_id === memberId ? { ...m, is_following: current, followers_count: m.followers_count + (current ? 1 : -1) } : m))
      );
      Alert.alert('Erreur', 'Action impossible pour le moment');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (tab === 'leaderboard') {
      await loadLeaderboard();
    } else {
      await loadMembers();
    }
    setRefreshing(false);
  };

  const renderLeaderboardItem = ({ item }: { item: LeaderboardEntry }) => (
    <View style={styles.cardRow}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{item.rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.display_name}</Text>
        {item.city ? <Text style={styles.meta}>{item.city}</Text> : null}
      </View>
      <Text style={styles.score}>{Math.round(item.score)}</Text>
    </View>
  );

  const renderMemberItem = ({ item }: { item: CommunityMember }) => (
    <TouchableOpacity style={styles.gridCard} onPress={() => router.push(`/community/${item.user_id}` as any)}>
      {item.cover_url ? (
        <Image source={{ uri: item.cover_url }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, { backgroundColor: colors.neutral[200] }]} />
      )}
      <View style={styles.gridFooter}>
        <View style={styles.gridInfo}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.neutral[300] }]} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {item.display_name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.followers_count} followers
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.followBtn, item.is_following && styles.followingBtn]}
          disabled={!!item.is_following}
          onPress={() => {
            if (!item.is_following) toggleFollow(item.user_id, false);
          }}
        >
          <Text style={[styles.followText, item.is_following && styles.followingText]}>
            {item.is_following ? 'Suivi' : 'Suivre'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TabButton label="Classements" active={tab === 'leaderboard'} onPress={() => setTab('leaderboard')} />
        <TabButton label="Membres" active={tab === 'members'} onPress={() => setTab('members')} />
      </View>

      {tab === 'leaderboard' && (
        <View style={styles.section}>
          <View style={styles.filtersRow}>
            <TouchableOpacity style={styles.filterButton} onPress={() => setPeriodPickerVisible(true)}>
              <Text style={styles.filterButtonText}>Filtrer par : {period === 'monthly' ? 'Mensuel' : 'Global'}</Text>
            </TouchableOpacity>
          </View>
          {loadingBoard ? (
            <ActivityIndicator color={colors.primary[600]} />
          ) : (
            <FlatList
              data={leaderboard}
              keyExtractor={(item) => `${item.period}-${item.user_id}-${item.rank}`}
              renderItem={renderLeaderboardItem}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[600]} />}
              ListFooterComponent={
                myEntry && myEntry.rank > 10 ? (
                  <View style={styles.cardRow}>
                    <View style={styles.rankBadgeMuted}>
                      <Text style={styles.rankText}>{myEntry.rank}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{myEntry.display_name}</Text>
                      {myEntry.city ? <Text style={styles.meta}>{myEntry.city}</Text> : null}
                    </View>
                    <Text style={styles.score}>{Math.round(myEntry.score)}</Text>
                  </View>
                ) : null
              }
            />
          )}
          {periodPickerVisible && (
            <View style={styles.modalOverlay}>
              <TouchableOpacity style={styles.modalBackdrop} onPress={() => setPeriodPickerVisible(false)} />
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Filtrer par</Text>
                {[
                  { key: 'monthly', label: 'Mensuel' },
                  { key: 'global', label: 'Global' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.optionRow, period === opt.key && styles.optionRowActive]}
                    onPress={() => {
                      setPeriod(opt.key as 'monthly' | 'global');
                      setPeriodPickerVisible(false);
                      loadLeaderboard();
                    }}
                  >
                    <Text style={[styles.optionText, period === opt.key && styles.optionTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {tab === 'members' && (
        <View style={styles.section}>
          <View style={styles.filtersRow}>
            <TouchableOpacity style={styles.filterButton} onPress={() => setSortPickerVisible(true)}>
              <Text style={styles.filterButtonText}>Filtrer par : {SORT_OPTIONS.find((o) => o.key === sort)?.label}</Text>
            </TouchableOpacity>
          </View>
          {loadingMembers ? (
            <ActivityIndicator color={colors.primary[600]} />
          ) : (
            <FlatList
              data={members}
              keyExtractor={(item) => item.user_id}
              renderItem={renderMemberItem}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              contentContainerStyle={styles.gridContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[600]} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.meta}>Aucun membre</Text>
                </View>
              }
            />
          )}
          {sortPickerVisible && (
            <View style={styles.modalOverlay}>
              <TouchableOpacity style={styles.modalBackdrop} onPress={() => setSortPickerVisible(false)} />
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Filtrer par</Text>
                {SORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.optionRow, sort === opt.key && styles.optionRowActive]}
                    onPress={() => {
                      setSort(opt.key);
                      setSortPickerVisible(false);
                      loadMembers();
                    }}
                  >
                    <Text style={[styles.optionText, sort === opt.key && styles.optionTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    alignItems: 'center',
  },
  tabButtonActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  tabText: {
    ...typography.body,
    color: colors.neutral[700],
  },
  tabTextActive: {
    color: colors.primary[700],
    fontWeight: '700',
  },
  section: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  pillActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  pillText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
  },
  pillTextActive: {
    color: colors.primary[700],
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing.md,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[100],
  },
  rankBadgeMuted: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[200],
  },
  rankText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary[700],
  },
  name: {
    ...typography.body,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  meta: {
    ...typography.caption,
    color: colors.neutral[600],
  },
  score: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary[700],
  },
  followBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
  },
  followingBtn: {
    backgroundColor: colors.neutral[200],
  },
  followText: {
    ...typography.bodySmall,
    color: colors.neutral[0],
    fontWeight: '700',
  },
  followingText: {
    color: colors.neutral[800],
  },
  empty: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  gridContent: {
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  columnWrapper: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridCard: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cover: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  gridFooter: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  gridInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  filterButtonText: {
    ...typography.bodySmall,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalCard: {
    backgroundColor: colors.neutral[0],
    padding: spacing.lg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.h4,
    color: colors.neutral[900],
  },
  optionRow: {
    paddingVertical: spacing.sm,
  },
  optionRowActive: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
  },
  optionText: {
    ...typography.body,
    color: colors.neutral[800],
  },
  optionTextActive: {
    color: colors.primary[700],
    fontWeight: '700',
  },
});
