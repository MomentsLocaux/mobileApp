import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, ChevronDown, Heart, MapPin, Search, Users } from 'lucide-react-native';

import { AppBackground } from '@/components/ui';
import { getCategoryLabel } from '@/constants/categories';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { supabase } from '@/lib/supabase/client';
import { EventsService } from '@/services/events.service';
import { SocialService } from '@/services/social.service';
import { CommunityService } from '@/services/community.service';
import { useFavoritesStore } from '@/store/favoritesStore';
import type { EventWithCreator } from '@/types/database';
import type { CommunityMember } from '@/types/community';

type FavoriteRow = {
  event_id: string;
  created_at: string;
};

type Tab = 'events' | 'creators';
type SortDirection = 'asc' | 'desc';

const formatDateChip = (iso?: string | null) => {
  if (!iso) return 'DATE';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'DATE';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long' }).format(date).toUpperCase();
};

const eventSortValue = (event: EventWithCreator) => {
  const ts = new Date(event.starts_at || event.created_at || 0).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user, session, isLoading } = useAuth();
  const { favorites, replaceFavorites, clearFavorites, toggleFavorite } = useFavoritesStore();

  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [query, setQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [creatorFavorites, setCreatorFavorites] = useState<CommunityMember[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    const followerId = user?.id || session?.user?.id || profile?.id;
    const favoritesOwnerId = profile?.id || followerId;
    if (!session || !followerId || !favoritesOwnerId) {
      replaceFavorites([]);
      setCreatorFavorites([]);
      setInitialLoading(false);
      return;
    }

    try {
      const { data: favoritesData, error: favoritesError } = await supabase
        .from('favorites')
        .select('event_id, created_at')
        .eq('profile_id', favoritesOwnerId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (favoritesError) throw favoritesError;

      const favoriteRows = (favoritesData || []) as FavoriteRow[];
      const eventIds = favoriteRows.map((row) => row.event_id).filter(Boolean);

      if (!eventIds.length) {
        replaceFavorites([]);
      } else {
        const events = await EventsService.getEventsByIds(eventIds);
        const byId = new Map(events.map((event) => [event.id, event]));
        const ordered = eventIds.map((id) => byId.get(id)).filter(Boolean) as EventWithCreator[];
        replaceFavorites(ordered);
      }

      const { data: followsData, error: followsError } = await supabase
        .from('follows')
        .select('following, created_at, profile:profiles!follows_following_fkey(id, display_name, avatar_url, cover_url, city, bio)')
        .eq('follower', followerId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (followsError) throw followsError;

      const followRows = (followsData || []) as any[];
      const followedIds = followRows.map((row) => row.following).filter(Boolean);
      let statsByUserId = new Map<string, { events_created_count: number; followers_count: number; lumo_total: number; following_count: number }>();

      if (followedIds.length > 0) {
        const { data: statsData, error: statsError } = await supabase
          .from('community_profile_stats')
          .select('user_id, events_created_count, followers_count, lumo_total, following_count')
          .in('user_id', followedIds);

        if (statsError) throw statsError;

        statsByUserId = new Map(
          ((statsData || []) as any[]).map((row) => [
            row.user_id,
            {
              events_created_count: Number(row.events_created_count || 0),
              followers_count: Number(row.followers_count || 0),
              lumo_total: Number(row.lumo_total || 0),
              following_count: Number(row.following_count || 0),
            },
          ]),
        );
      }

      const creators = followRows
        .map((row) => {
          const p = row.profile;
          if (!p?.id) return null;
          const stats = statsByUserId.get(p.id);
          return {
            user_id: p.id,
            display_name: p.display_name || 'Profil',
            avatar_url: p.avatar_url || null,
            cover_url: p.cover_url || null,
            city: p.city || null,
            bio: p.bio || null,
            events_created_count: stats?.events_created_count ?? 0,
            lumo_total: stats?.lumo_total ?? 0,
            followers_count: stats?.followers_count ?? 0,
            following_count: stats?.following_count ?? 0,
          } as CommunityMember;
        })
        .filter(Boolean) as CommunityMember[];

      setCreatorFavorites(creators);
    } catch (error) {
      console.warn('load favorites error', error);
      Alert.alert('Erreur', 'Impossible de charger vos favoris pour le moment.');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, replaceFavorites, session, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites]),
  );

  useEffect(() => {
    if (session && (user?.id || session?.user?.id || profile?.id)) {
      loadFavorites();
    }
  }, [loadFavorites, profile?.id, session, user?.id]);

  const queryValue = query.trim().toLowerCase();

  const filteredEvents = useMemo(() => {
    const base = favorites.filter((event) => {
      if (!queryValue) return true;
      const haystack = [
        event.title,
        event.category,
        event.city,
        event.address,
        event.creator?.display_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(queryValue);
    });

    const sorted = [...base].sort((a, b) => {
      const av = eventSortValue(a);
      const bv = eventSortValue(b);
      return sortDirection === 'desc' ? bv - av : av - bv;
    });

    return sorted;
  }, [favorites, queryValue, sortDirection]);

  const filteredCreators = useMemo(() => {
    return creatorFavorites.filter((creator) => {
      if (!queryValue) return true;
      const haystack = [creator.display_name, creator.city, creator.bio].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(queryValue);
    });
  }, [creatorFavorites, queryValue]);

  const favoritesSet = useMemo(() => new Set(favorites.map((event) => event.id)), [favorites]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadFavorites();
  };

  const handleToggleFavorite = async (event: EventWithCreator) => {
    if (!profile?.id) return;
    try {
      const nowFavorited = await SocialService.toggleFavorite(profile.id, event.id);
      const wasFavorited = favoritesSet.has(event.id);
      if (nowFavorited !== wasFavorited) {
        toggleFavorite(event);
      }
    } catch (error) {
      console.warn('favorites screen toggle favorite error', error);
      Alert.alert('Erreur', "Impossible d'enregistrer le favori pour le moment.");
    }
  };

  const handleUnfollowCreator = async (creatorId: string) => {
    try {
      await CommunityService.unfollow(creatorId);
      setCreatorFavorites((prev) => prev.filter((creator) => creator.user_id !== creatorId));
    } catch (error) {
      console.warn('favorites screen unfollow creator error', error);
      Alert.alert('Erreur', "Impossible de retirer ce créateur de vos favoris.");
    }
  };

  const handleClearAll = async () => {
    if (!profile?.id) return;

    Alert.alert('Vider les favoris', 'Supprimer tous vos événements favoris ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Vider',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('favorites').delete().eq('profile_id', profile.id);
            if (error) throw error;
            clearFavorites();
          } catch (clearError) {
            console.warn('clear favorites error', clearError);
            Alert.alert('Erreur', 'Impossible de vider les favoris pour le moment.');
          }
        },
      },
    ]);
  };

  if (isLoading || initialLoading) {
    return (
      <View style={styles.centeredContainer}>
        <AppBackground />
        <ActivityIndicator size="large" color={colors.brand.secondary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centeredContainer}>
        <AppBackground />
        <Text style={styles.emptyTitle}>Connexion requise</Text>
        <Text style={styles.emptySubtitle}>Connectez-vous pour accéder à vos favoris.</Text>
      </View>
    );
  }

  const eventsCountLabel = `${filteredEvents.length} ÉVÉNEMENTS ENREGISTRÉS`;
  const creatorsCountLabel = `${filteredCreators.length} CRÉATEURS ENREGISTRÉS`;

  return (
    <View style={styles.container}>
      <AppBackground />

      <View style={[styles.content, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Mes Favoris</Text>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/notifications' as any)}
            activeOpacity={0.85}
          >
            <Bell size={18} color={colors.brand.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Search size={20} color={colors.brand.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher vos pépites enregistrées..."
            placeholderTextColor={colors.brand.textSecondary}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentButton, activeTab === 'events' && styles.segmentButtonActive]}
            onPress={() => setActiveTab('events')}
            activeOpacity={0.85}
          >
            <Text style={[styles.segmentText, activeTab === 'events' && styles.segmentTextActive]}>Événements</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, activeTab === 'creators' && styles.segmentButtonActive]}
            onPress={() => setActiveTab('creators')}
            activeOpacity={0.85}
          >
            <Text style={[styles.segmentText, activeTab === 'creators' && styles.segmentTextActive]}>Créateurs</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{activeTab === 'events' ? eventsCountLabel : creatorsCountLabel}</Text>
          {activeTab === 'events' ? (
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              activeOpacity={0.85}
            >
              <Text style={styles.sortText}>Trier par Date</Text>
              <ChevronDown
                size={14}
                color={colors.brand.secondary}
                style={{ transform: [{ rotate: sortDirection === 'desc' ? '0deg' : '180deg' }] }}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.sortButton} onPress={handleClearAll} activeOpacity={0.85}>
              <Text style={styles.sortText}>Vider événements</Text>
            </TouchableOpacity>
          )}
        </View>

        {activeTab === 'events' ? (
          <FlatList
            data={filteredEvents}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand.secondary} />
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>Aucun événement favori</Text>
                <Text style={styles.emptySubtitle}>Ajoutez des événements en favoris pour les retrouver ici.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const location = item.city || item.venue_name || item.address || 'Lieu à confirmer';
              const categoryLabel = getCategoryLabel(item.category || '').toUpperCase();
              const dateLabel = formatDateChip(item.starts_at);

              return (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.eventCard}
                  onPress={() => router.push(`/events/${item.id}` as any)}
                >
                  <View style={styles.eventMediaWrap}>
                    <ImageBackground
                      source={item.cover_url ? { uri: item.cover_url } : undefined}
                      resizeMode="cover"
                      style={styles.eventMedia}
                      imageStyle={styles.eventMediaImage}
                    >
                      <View style={styles.eventOverlay} />

                      <TouchableOpacity
                        style={styles.favoriteFab}
                        activeOpacity={0.85}
                        onPress={() => handleToggleFavorite(item)}
                      >
                        <Heart size={20} color={colors.brand.secondary} fill={colors.brand.secondary} />
                      </TouchableOpacity>

                      <View style={styles.badgesRow}>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>{categoryLabel}</Text>
                        </View>
                        <View style={styles.dateBadge}>
                          <Text style={styles.dateBadgeText}>{dateLabel}</Text>
                        </View>
                      </View>
                    </ImageBackground>
                  </View>

                  <View style={styles.eventBody}>
                    <Text style={styles.eventTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={styles.locationRow}>
                      <MapPin size={14} color={colors.brand.textSecondary} />
                      <Text style={styles.locationText} numberOfLines={1}>
                        {location}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        ) : (
          <FlatList
            data={filteredCreators}
            keyExtractor={(item) => item.user_id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand.secondary} />
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>Aucun créateur favori</Text>
                <Text style={styles.emptySubtitle}>Suivez des créateurs pour les retrouver ici.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.creatorCard}
                activeOpacity={0.9}
                onPress={() => router.push(`/community/${item.user_id}` as any)}
              >
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>{(item.display_name || '?').slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}

                <View style={styles.creatorBody}>
                  <Text style={styles.creatorName} numberOfLines={1}>
                    {item.display_name}
                  </Text>
                  <Text style={styles.creatorMeta} numberOfLines={1}>
                    {item.city || 'Ville inconnue'}
                  </Text>
                  <View style={styles.creatorStatsRow}>
                    <View style={styles.creatorStatPill}>
                      <Users size={12} color={colors.brand.textSecondary} />
                      <Text style={styles.creatorStatText}>{item.followers_count || 0}</Text>
                    </View>
                    <View style={styles.creatorStatPill}>
                      <Text style={styles.creatorStatText}>{item.events_created_count || 0} événements</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.favoriteFabSmall}
                  activeOpacity={0.85}
                  onPress={() => handleUnfollowCreator(item.user_id)}
                >
                  <Heart size={18} color={colors.brand.secondary} fill={colors.brand.secondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090607',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    backgroundColor: '#090607',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h2,
    color: colors.brand.text,
    fontWeight: '800',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  searchBox: {
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.brand.text,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: borderRadius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  segmentButton: {
    flex: 1,
    borderRadius: borderRadius.full,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: colors.brand.secondary,
  },
  segmentText: {
    ...typography.h6,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#06242c',
  },
  listHeader: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listTitle: {
    ...typography.h6,
    color: '#9eb0c4',
    letterSpacing: 1,
    fontWeight: '800',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    ...typography.subtitle,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  eventCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  eventMediaWrap: {
    height: 252,
  },
  eventMedia: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#21343c',
  },
  eventMediaImage: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  eventOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  favoriteFab: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 22, 28, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  categoryBadge: {
    backgroundColor: colors.brand.secondary,
    borderRadius: borderRadius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  categoryBadgeText: {
    ...typography.label,
    color: '#06242c',
    fontWeight: '800',
  },
  dateBadge: {
    backgroundColor: 'rgba(27,32,40,0.75)',
    borderRadius: borderRadius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  dateBadgeText: {
    ...typography.label,
    color: colors.brand.text,
    fontWeight: '800',
  },
  eventBody: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  eventTitle: {
    ...typography.h3,
    color: colors.brand.text,
    fontWeight: '800',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    ...typography.body,
    color: '#a7b2c4',
    flex: 1,
  },
  creatorCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: borderRadius.full,
  },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  avatarFallbackText: {
    ...typography.h5,
    color: colors.brand.text,
    fontWeight: '800',
  },
  creatorBody: {
    flex: 1,
    gap: 4,
  },
  creatorName: {
    ...typography.h5,
    color: colors.brand.text,
    fontWeight: '800',
  },
  creatorMeta: {
    ...typography.subtitle,
    color: colors.brand.textSecondary,
  },
  creatorStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  creatorStatPill: {
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creatorStatText: {
    ...typography.caption,
    color: '#c4ccda',
    fontWeight: '700',
  },
  favoriteFabSmall: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 22, 28, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.h5,
    color: colors.brand.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
});
