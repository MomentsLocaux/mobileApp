import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Users, UserPlus } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { useAuth } from '../../hooks';
import { CommunityService } from '../../services/community.service';
import type { CommunityMember } from '../../types/community';
import { AppBackground, DiscoveryLoadingState, EmptyState } from '@/components/ui';
import { haptics } from '@/utils/haptics';
import { features } from '@/config/features';
import { MOMENTS_LOCAUX_ORGANIZER_NAME } from '@/constants/branding';

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
      // Peer discovery is global by default (city filter was opt-in on main).
      // Hard-filtering by profile.city emptied the list for most users.
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

  const onRefresh = async () => {
    setRefreshing(true);
    await load(query);
    setRefreshing(false);
  };

  const renderMemberItem = ({ item }: { item: CommunityMember }) => {
    const isFollowing = followingSet.has(item.user_id);
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
            {isFollowing ? ' · Suivi' : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followingBtn]}
          disabled={followPendingId === item.user_id}
          onPress={() => toggleFollow(item.user_id, isFollowing)}
          accessibilityRole="button"
          accessibilityLabel={isFollowing ? 'Ne plus suivre' : 'Suivre'}
          hitSlop={8}
        >
          <Text style={[styles.followText, isFollowing && styles.followingText]}>
            {isFollowing ? 'Suivi' : 'Suivre'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
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

        <View style={styles.searchRow}>
          <Search size={18} color={colors.brand.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un prénom ou pseudo"
            placeholderTextColor={colors.brand.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Rechercher un membre"
          />
        </View>

        {loadingMembers && !refreshing ? (
          <DiscoveryLoadingState
            icon={Users}
            title="Nous recherchons les membres de la communauté"
            subtitle="Encore un instant, nous préparons les profils à découvrir."
          />
        ) : (
          <FlatList
            data={sortedMembers}
            keyExtractor={(item) => item.user_id}
            renderItem={renderMemberItem}
            ListHeaderComponent={
              <View style={styles.listHeaderBlock}>
                <Text style={styles.countLabel}>
                  {followingIds.length > 0
                    ? `${followingIds.length} suivi${followingIds.length > 1 ? 's' : ''} · ${sortedMembers.length} résultat${sortedMembers.length > 1 ? 's' : ''}`
                    : `${sortedMembers.length} MEMBRE${sortedMembers.length === 1 ? '' : 'S'}`}
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
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
                  title={query.trim() ? 'Aucun résultat' : 'Aucun membre pour le moment'}
                  subtitle={
                    query.trim()
                      ? 'Essayez un autre nom, ou invitez vos proches à rejoindre l’app.'
                      : 'Recherchez un prénom ou parcourez les membres pour les suivre.'
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
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.brand.text,
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.brand.text,
    paddingVertical: spacing.sm,
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
    backgroundColor: 'rgba(124, 181, 24, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24, 0.28)',
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
  followText: {
    ...typography.bodySmall,
    color: colors.brand.primary,
    fontWeight: '800',
  },
  followingText: {
    color: colors.brand.text,
  },
});
