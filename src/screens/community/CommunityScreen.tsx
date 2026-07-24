import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Users } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { useAuth } from '../../hooks';
import { CommunityService } from '../../services/community.service';
import type { CommunityMember } from '../../types/community';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';
import { AppBackground, EmptyState, SkeletonBlock } from '@/components/ui';
import { haptics } from '@/utils/haptics';

type SortKey = 'followers' | 'events' | 'lumo';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'followers', label: 'Abonnés' },
  { key: 'events', label: 'Événements' },
  ...(GAMIFICATION_ENABLED ? [{ key: 'lumo' as const, label: 'Engagement' }] : []),
];

export default function CommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user, session } = useAuth();
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [sort, setSort] = useState<SortKey>('followers');
  const [cityOnly, setCityOnly] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followPendingId, setFollowPendingId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  const currentUserId = user?.id || session?.user?.id || profile?.id;
  const profileCity = profile?.city?.trim() || null;
  const cityFilter = cityOnly && profileCity ? profileCity : null;

  const loadMembers = useCallback(async () => {
    try {
      setLoadingMembers(true);
      if (currentUserId) {
        const ids = await CommunityService.getFollowingIds(currentUserId);
        setFollowingIds(ids);
      } else {
        setFollowingIds([]);
      }
      const data = await CommunityService.listMembers({
        city: cityFilter,
        sort,
        limit: 50,
      });
      setMembers(data);
    } catch (e) {
      console.warn('loadMembers error', e);
      Alert.alert('Erreur', 'Impossible de charger les membres');
    } finally {
      setLoadingMembers(false);
    }
  }, [cityFilter, sort, currentUserId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const toggleFollow = async (memberId: string, current: boolean) => {
    if (!currentUserId) {
      Alert.alert('Connexion requise', 'Connectez-vous pour suivre des membres.');
      return;
    }
    haptics.light();
    setFollowPendingId(memberId);
    try {
      if (current) {
        await CommunityService.unfollow(memberId);
      } else {
        await CommunityService.follow(memberId);
        haptics.success();
      }
      await loadMembers();
    } catch (e) {
      console.warn('follow/unfollow error', e);
      Alert.alert('Erreur', 'Action impossible pour le moment');
    } finally {
      setFollowPendingId(null);
    }
  };

  const followingSet = useMemo(() => new Set(followingIds), [followingIds]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMembers();
    setRefreshing(false);
  };

  const renderMemberItem = ({ item }: { item: CommunityMember }) => {
    const isFollowing = followingSet.has(item.user_id);
    const isSelf = item.user_id === currentUserId;
    const initial = (item.display_name || '?').slice(0, 1).toUpperCase();

    return (
      <TouchableOpacity
        style={styles.memberCard}
        activeOpacity={0.88}
        onPress={() => router.push(`/community/${item.user_id}` as any)}
        accessibilityRole="button"
        accessibilityLabel={`Profil de ${item.display_name}`}
      >
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>{initial}</Text>
          </View>
        )}

        <View style={styles.memberBody}>
          <Text style={styles.name} numberOfLines={1}>
            {item.display_name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.city || 'Ville non renseignée'}
            {item.is_ambassadeur ? ' · Ambassadeur' : ''}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Users size={12} color={colors.brand.textSecondary} />
              <Text style={styles.statText}>{item.followers_count || 0}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statText}>{item.events_created_count || 0} événements</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followingBtn, isSelf && styles.selfBtn]}
          disabled={isSelf || followPendingId === item.user_id}
          onPress={() => toggleFollow(item.user_id, isFollowing)}
          accessibilityRole="button"
          accessibilityLabel={isSelf ? 'Votre profil' : isFollowing ? 'Ne plus suivre' : 'Suivre'}
          hitSlop={8}
        >
          <Text style={[styles.followText, isFollowing && styles.followingText, isSelf && styles.selfText]}>
            {isSelf ? 'Vous' : isFollowing ? 'Suivi' : 'Suivre'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View style={styles.listHeaderBlock}>
      <Text style={styles.countLabel}>
        {loadingMembers ? 'Chargement…' : `${members.length} MEMBRE${members.length === 1 ? '' : 'S'}`}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <AppBackground />

      <View style={[styles.content, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Communauté</Text>
          <Text style={styles.subtitle}>Découvrez et suivez les créateurs près de chez vous</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = sort === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  haptics.selection();
                  setSort(opt.key);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
          {profileCity ? (
            <TouchableOpacity
              style={[styles.chip, cityOnly && styles.chipActive]}
              onPress={() => {
                haptics.selection();
                setCityOnly((v) => !v);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: cityOnly }}
            >
              <MapPin size={14} color={cityOnly ? colors.brand.primary : colors.brand.textSecondary} />
              <Text style={[styles.chipText, cityOnly && styles.chipTextActive]}>{profileCity}</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        {loadingMembers && !refreshing ? (
          <MembersListSkeleton />
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.user_id}
            renderItem={renderMemberItem}
            ListHeaderComponent={listHeader}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.secondary} />
            }
            ListEmptyComponent={
              <EmptyState
                icon={Users}
                title="Aucun membre pour le moment"
                subtitle={
                  cityFilter
                    ? `Personne à ${cityFilter} pour ce tri. Essayez sans filtre ville.`
                    : 'Revenez bientôt — de nouveaux profils apparaissent au fil des publications.'
                }
                ctaLabel={cityFilter ? 'Voir partout' : undefined}
                onCtaPress={cityFilter ? () => setCityOnly(false) : undefined}
              />
            }
          />
        )}
      </View>
    </View>
  );
}

function MembersListSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={index} style={styles.memberCard}>
          <SkeletonBlock height={56} width={56} radius={28} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBlock height={14} width="55%" />
            <SkeletonBlock height={11} width="40%" />
            <SkeletonBlock height={22} width="70%" radius={borderRadius.full} />
          </View>
          <SkeletonBlock height={36} width={72} radius={borderRadius.full} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 40,
  },
  chipActive: {
    backgroundColor: colors.brand.secondary,
    borderColor: colors.brand.secondary,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.brand.primary,
  },
  listHeaderBlock: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  countLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: spacing.xl * 2,
    flexGrow: 1,
  },
  skeletonWrap: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43, 191, 227, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(43, 191, 227, 0.28)',
  },
  avatarFallbackText: {
    ...typography.h5,
    color: colors.brand.secondary,
  },
  memberBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  name: {
    ...typography.body,
    fontWeight: '700',
    color: colors.brand.text,
  },
  meta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  followBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
    minHeight: 40,
    justifyContent: 'center',
  },
  followingBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  selfBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  followText: {
    ...typography.bodySmall,
    color: colors.brand.primary,
    fontWeight: '800',
  },
  followingText: {
    color: colors.brand.text,
  },
  selfText: {
    color: colors.brand.textSecondary,
  },
});
