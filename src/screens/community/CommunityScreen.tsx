import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, UserPlus } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { useAuth } from '../../hooks';
import { CommunityService } from '../../services/community.service';
import type { CommunityMember } from '../../types/community';
import { AppBackground, DiscoveryLoadingState, EmptyState } from '@/components/ui';
import { CommunityMemberCard, CommunitySearchField } from '@/components/community/CommunityMemberCard';
import { haptics } from '@/utils/haptics';
import { features } from '@/config/features';
import { MOMENTS_LOCAUX_ORGANIZER_NAME } from '@/constants/branding';
import { followActionLabel, formatMemberLocation } from '@/utils/community-follows';

/**
 * MVP peer social — find / follow members (not creator rankings).
 */
export default function CommunityScreen() {
  if (!features.socialPeers) {
    return <Redirect href="/(tabs)/map" />;
  }

  return <PeersMembersScreen />;
}

function PeersMembersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user, session } = useAuth();
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [followPendingId, setFollowPendingId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const searchSeq = useRef(0);

  const currentUserId = user?.id || session?.user?.id || profile?.id;

  const load = useCallback(async (search: string) => {
    const seq = ++searchSeq.current;
    try {
      setLoadingMembers(true);
      setLoadError(null);

      const trimmed = search.trim();
      const membersRequest = trimmed
        ? CommunityService.searchMembers({
            query: trimmed,
            limit: 40,
          })
        : CommunityService.listMembers({
            city: null,
            limit: 40,
          });

      const followingRequest = currentUserId
        ? CommunityService.getFollowingIds(currentUserId)
        : Promise.resolve<string[]>([]);
      const [membersResult, followingResult] = await Promise.allSettled([
        membersRequest,
        followingRequest,
      ]);

      if (seq !== searchSeq.current) return;

      if (followingResult.status === 'fulfilled') {
        setFollowingIds(followingResult.value);
      } else {
        console.warn('load following ids error', followingResult.reason);
        setFollowingIds([]);
      }

      if (membersResult.status === 'rejected') throw membersResult.reason;
      const data = membersResult.value;

      const filtered = (data || []).filter((m) => {
        if (!m.user_id || m.user_id === currentUserId) return false;
        const name = (m.display_name || '').trim();
        if (!name) return false;
        if (name.toLowerCase() === MOMENTS_LOCAUX_ORGANIZER_NAME.toLowerCase()) return false;
        return true;
      });
      setMembers(filtered);
    } catch (e) {
      console.warn('load peers error', e);
      if (seq === searchSeq.current) {
        setMembers([]);
        setLoadError('Impossible de charger les membres pour le moment.');
      }
    } finally {
      if (seq === searchSeq.current) setLoadingMembers(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load(query);
    }, 280);
    return () => clearTimeout(t);
  }, [load, query]);

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
        setFollowingIds((prev) => prev.filter((id) => id !== memberId));
      } else {
        await CommunityService.follow(memberId);
        haptics.success();
        setFollowingIds((prev) => (prev.includes(memberId) ? prev : [...prev, memberId]));
      }
    } catch (e) {
      console.warn('follow/unfollow error', e);
      Alert.alert('Erreur', 'Action impossible pour le moment');
    } finally {
      setFollowPendingId(null);
    }
  };

  const followingSet = useMemo(() => new Set(followingIds), [followingIds]);

  const sortedMembers = useMemo(() => {
    const profileCity = (profile?.city || '').trim().toLowerCase();
    return [...members].sort((a, b) => {
      const af = followingSet.has(a.user_id) ? 0 : 1;
      const bf = followingSet.has(b.user_id) ? 0 : 1;
      if (af !== bf) return af - bf;
      if (profileCity) {
        const ac = (a.city || '').trim().toLowerCase().includes(profileCity) ? 0 : 1;
        const bc = (b.city || '').trim().toLowerCase().includes(profileCity) ? 0 : 1;
        if (ac !== bc) return ac - bc;
      }
      const followersDelta = (b.followers_count || 0) - (a.followers_count || 0);
      if (followersDelta !== 0) return followersDelta;
      return (a.display_name || '').localeCompare(b.display_name || '', 'fr');
    });
  }, [members, followingSet, profile?.city]);

  const filtered = query.trim().length > 0;
  const summary = filtered
    ? sortedMembers.length === 0
      ? 'Aucun résultat'
      : sortedMembers.length === 1
        ? '1 résultat'
        : `${sortedMembers.length} résultats`
    : sortedMembers.length === 1
      ? '1 membre'
      : `${sortedMembers.length} membres`;

  const onRefresh = async () => {
    setRefreshing(true);
    await load(query);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <AppBackground />

      <View style={[styles.content, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title}>Membres</Text>
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={() => router.push('/profile/invite' as any)}
              accessibilityRole="button"
              accessibilityLabel="Inviter un ami"
            >
              <UserPlus size={16} color={colors.brand.secondary} />
              <Text style={styles.inviteButtonText}>Inviter un ami</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            Suivez des personnes de l’app pour voir quand elles aiment un moment près de chez vous.
          </Text>
        </View>

        <CommunitySearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Prénom, pseudo, ville ou zone"
          accessibilityLabel="Rechercher un membre par nom, ville ou zone"
        />

        {loadingMembers && !refreshing ? (
          <DiscoveryLoadingState
            title="Nous recherchons les membres de la communauté"
            subtitle="Encore un instant, nous préparons les profils à découvrir."
          />
        ) : (
          <FlatList
            data={sortedMembers}
            keyExtractor={(item) => item.user_id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isFollowing = followingSet.has(item.user_id);
              return (
                <CommunityMemberCard
                  displayName={item.display_name}
                  avatarUrl={item.avatar_url}
                  locationLabel={formatMemberLocation(item.city, item.region)}
                  followLabel={followActionLabel({
                    isFollowing,
                    tab: 'following',
                    isOwnList: false,
                  })}
                  isFollowing={isFollowing}
                  pending={followPendingId === item.user_id}
                  onPressProfile={() => router.push(`/community/${item.user_id}` as any)}
                  onPressFollow={() => void toggleFollow(item.user_id, isFollowing)}
                />
              );
            }}
            ListHeaderComponent={
              sortedMembers.length > 0 || filtered ? (
                <Text style={styles.summary}>{summary}</Text>
              ) : null
            }
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: spacing.xxl + insets.bottom },
              sortedMembers.length === 0 ? styles.listEmpty : null,
            ]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.secondary} />
            }
            ListEmptyComponent={
              loadError ? (
                <EmptyState
                  icon={Users}
                  title="Chargement impossible"
                  subtitle={loadError}
                  ctaLabel="Réessayer"
                  onCtaPress={() => void load(query)}
                />
              ) : (
                <EmptyState
                  icon={Users}
                  title={filtered ? 'Aucun résultat' : 'Aucun membre pour le moment'}
                  subtitle={
                    filtered
                      ? 'Essayez un autre nom, une ville ou une zone, ou invitez vos proches à rejoindre l’app.'
                      : 'Recherchez un prénom, une ville ou parcourez les membres pour les suivre.'
                  }
                  ctaLabel="Inviter des amis"
                  onCtaPress={() => router.push('/profile/invite' as any)}
                />
              )
            }
          />
        )}
      </View>
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
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    gap: spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
    fontWeight: '800',
    flexShrink: 1,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24, 0.45)',
    backgroundColor: 'rgba(124, 181, 24, 0.08)',
  },
  inviteButtonText: {
    ...typography.label,
    fontSize: 12,
    color: colors.brand.secondary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
  summary: {
    ...typography.body,
    fontWeight: '700',
    color: colors.brand.text,
    marginBottom: spacing.sm,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: spacing.xs,
  },
  listEmpty: {
    flexGrow: 1,
  },
});
