import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserPlus, Users } from 'lucide-react-native';
import {
  AppBackground,
  EmptyState,
  ScreenHeader,
  SlidingSegmentedControl,
  screenHeaderStyles,
} from '@/components/ui';
import { colors, spacing, typography } from '@/constants/theme';
import { features } from '@/config/features';
import { CommunityMemberCard, CommunitySearchField } from '@/components/community/CommunityMemberCard';
import { CommunityService, type FollowListMember } from '@/services/community.service';
import { useAuth } from '@/hooks';
import { haptics } from '@/utils/haptics';
import {
  countPendingFollowBacks,
  filterFollowListMembers,
  followActionLabel,
  formatFollowCircleHint,
  formatFollowCircleSummary,
  formatMemberLocation,
  formatMutualCaption,
  sortFollowListMembers,
  type FollowTab,
} from '@/utils/community-follows';

const OWN_TAB_OPTIONS = [
  { value: 'followers' as const, label: 'Ceux qui me suivent' },
  { value: 'following' as const, label: 'Ceux que je suis' },
];

const OTHER_TAB_OPTIONS = [
  { value: 'followers' as const, label: 'Abonnés' },
  { value: 'following' as const, label: 'Abonnements' },
];

export default function CommunityFollowsScreen() {
  if (!features.socialPeers) {
    return <Redirect href="/(tabs)/map" />;
  }

  return <CommunityFollowsContent />;
}

function CommunityFollowsContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user, session } = useAuth();
  const params = useLocalSearchParams<{ userId?: string; tab?: string }>();
  const userId = typeof params.userId === 'string' ? params.userId : '';
  const currentUserId = user?.id || session?.user?.id || profile?.id;
  const isOwnList = !!currentUserId && currentUserId === userId;
  const [tab, setTab] = useState<FollowTab>(params.tab === 'following' ? 'following' : 'followers');
  const [followers, setFollowers] = useState<FollowListMember[]>([]);
  const [following, setFollowing] = useState<FollowListMember[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followPendingId, setFollowPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (params.tab === 'following' || params.tab === 'followers') {
      setTab(params.tab);
    }
  }, [params.tab]);

  const load = useCallback(async () => {
    if (!userId) {
      setFollowers([]);
      setFollowing([]);
      setFollowingIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [followersRows, followingRows, ids] = await Promise.all([
        CommunityService.listFollows(userId, 'followers'),
        CommunityService.listFollows(userId, 'following'),
        currentUserId ? CommunityService.getFollowingIds(currentUserId) : Promise.resolve<string[]>([]),
      ]);
      setFollowers(followersRows);
      setFollowing(followingRows);
      setFollowingIds(ids);
    } catch (error) {
      console.warn('list follows', error);
      setFollowers([]);
      setFollowing([]);
      setFollowingIds([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onChangeTab = (next: FollowTab) => {
    setTab(next);
    setQuery('');
    router.setParams({ userId, tab: next });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const followingSet = useMemo(() => new Set(followingIds), [followingIds]);
  const followerIds = useMemo(() => new Set(followers.map((row) => row.user_id)), [followers]);
  const members = tab === 'followers' ? followers : following;
  const visibleMembers = useMemo(
    () =>
      sortFollowListMembers(filterFollowListMembers(members, query), {
        tab,
        followingIds,
      }),
    [followingIds, members, query, tab],
  );
  const pendingFollowBacks = useMemo(
    () => countPendingFollowBacks(followers, followingIds),
    [followers, followingIds],
  );
  const filtered = query.trim().length > 0;
  const summary = formatFollowCircleSummary({
    isOwnList,
    tab,
    total: members.length,
    visible: visibleMembers.length,
    filtered,
  });
  const hint = filtered
    ? null
    : formatFollowCircleHint({
        isOwnList,
        tab,
        pendingFollowBacks,
        total: members.length,
      });

  const toggleFollow = async (member: FollowListMember, isFollowing: boolean) => {
    if (!currentUserId) {
      Alert.alert('Connexion requise', 'Connectez-vous pour suivre des membres.');
      return;
    }
    haptics.light();
    setFollowPendingId(member.user_id);
    try {
      if (isFollowing) {
        await CommunityService.unfollow(member.user_id);
        setFollowingIds((prev) => prev.filter((id) => id !== member.user_id));
        if (isOwnList) {
          setFollowing((prev) => prev.filter((row) => row.user_id !== member.user_id));
        }
      } else {
        await CommunityService.follow(member.user_id);
        haptics.success();
        setFollowingIds((prev) => (prev.includes(member.user_id) ? prev : [...prev, member.user_id]));
        if (isOwnList) {
          setFollowing((prev) =>
            prev.some((row) => row.user_id === member.user_id) ? prev : [...prev, member],
          );
        }
      }
    } catch (error) {
      console.warn('follow/unfollow error', error);
      Alert.alert('Erreur', 'Action impossible pour le moment');
    } finally {
      setFollowPendingId(null);
    }
  };

  const goToMembers = () => router.push('/(tabs)/community' as any);
  const goToInvite = () => router.push('/profile/invite' as any);

  const emptyState = (() => {
    if (filtered) {
      return {
        title: 'Aucun résultat',
        subtitle: 'Essayez un autre nom ou une ville dans votre cercle.',
        ctaLabel: undefined,
        onCtaPress: undefined,
        secondaryCtaLabel: undefined,
        onSecondaryCtaPress: undefined,
      };
    }
    if (tab === 'followers') {
      return {
        title: isOwnList ? 'Personne ne vous suit encore' : 'Aucun abonné',
        subtitle: isOwnList
          ? 'Invitez un proche — c’est le plus simple pour faire grandir votre cercle.'
          : 'Quand des membres suivront ce profil, ils apparaîtront ici.',
        ctaLabel: isOwnList ? 'Inviter un ami' : undefined,
        onCtaPress: isOwnList ? goToInvite : undefined,
        secondaryCtaLabel: isOwnList ? 'Découvrir des membres' : undefined,
        onSecondaryCtaPress: isOwnList ? goToMembers : undefined,
      };
    }
    return {
      title: isOwnList ? 'Vous ne suivez personne' : 'Aucun abonnement',
      subtitle: isOwnList
        ? 'Découvrez des membres pour voir leurs coups de cœur près de chez vous.'
        : 'Les personnes suivies par ce profil apparaîtront ici.',
      ctaLabel: isOwnList ? 'Découvrir des membres' : undefined,
      onCtaPress: isOwnList ? goToMembers : undefined,
      secondaryCtaLabel: isOwnList ? 'Inviter un ami' : undefined,
      onSecondaryCtaPress: isOwnList ? goToInvite : undefined,
    };
  })();

  const renderMember = ({ item }: { item: FollowListMember }) => {
    const isFollowing = followingSet.has(item.user_id);
    const actionLabel = followActionLabel({ isFollowing, tab, isOwnList });
    const mutual = formatMutualCaption({
      isOwnList,
      tab,
      theyFollowYou: followerIds.has(item.user_id),
    });

    return (
      <CommunityMemberCard
        displayName={item.display_name}
        avatarUrl={item.avatar_url}
        locationLabel={formatMemberLocation(item.city)}
        caption={mutual}
        followLabel={actionLabel}
        isFollowing={isFollowing}
        pending={followPendingId === item.user_id}
        showFollow={item.user_id !== currentUserId}
        onPressProfile={() => router.push(`/community/${item.user_id}` as any)}
        onPressFollow={() => void toggleFollow(item, isFollowing)}
      />
    );
  };

  return (
    <View style={styles.container}>
      <AppBackground />
      <ScreenHeader
        title={isOwnList ? 'Ma communauté' : tab === 'followers' ? 'Abonnés' : 'Abonnements'}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/community' as any))}
        right={
          isOwnList ? (
            <TouchableOpacity
              style={screenHeaderStyles.iconButton}
              onPress={goToInvite}
              accessibilityRole="button"
              accessibilityLabel="Inviter un ami"
            >
              <UserPlus size={18} color={colors.brand.text} />
            </TouchableOpacity>
          ) : undefined
        }
      />
      <View style={styles.toolbar}>
        <SlidingSegmentedControl
          value={tab}
          options={isOwnList ? OWN_TAB_OPTIONS : OTHER_TAB_OPTIONS}
          onChange={onChangeTab}
          compact={isOwnList}
          accessibilityLabel={isOwnList ? 'Direction de votre cercle' : 'Abonnés ou abonnements'}
        />
        {members.length > 0 || filtered ? <Text style={styles.summary}>{summary}</Text> : null}
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        {members.length > 0 ? (
          <CommunitySearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Nom ou ville"
            accessibilityLabel="Rechercher dans le cercle"
          />
        ) : null}
      </View>
      {loading && followers.length === 0 && following.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand.secondary} />
        </View>
      ) : (
        <FlatList
          data={visibleMembers}
          keyExtractor={(item) => item.user_id}
          renderItem={renderMember}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.secondary} />
          }
          contentContainerStyle={[
            styles.list,
            { paddingBottom: spacing.xxl + insets.bottom },
            visibleMembers.length === 0 ? styles.listEmpty : null,
          ]}
          ListEmptyComponent={
            <EmptyState
              icon={Users}
              title={emptyState.title}
              subtitle={emptyState.subtitle}
              ctaLabel={emptyState.ctaLabel}
              onCtaPress={emptyState.onCtaPress}
              secondaryCtaLabel={emptyState.secondaryCtaLabel}
              onSecondaryCtaPress={emptyState.onSecondaryCtaPress}
            />
          }
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
  toolbar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  summary: {
    ...typography.body,
    fontWeight: '700',
    color: colors.brand.text,
  },
  hint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    lineHeight: 18,
    marginTop: -2,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
  },
  listEmpty: {
    flexGrow: 1,
  },
});
