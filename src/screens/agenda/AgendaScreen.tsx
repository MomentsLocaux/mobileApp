import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass } from 'lucide-react-native';
import { AppBackground, BrandIcon, DiscoveryLoadingState, EmptyState, SlidingSegmentedControl, UserAvatar } from '@/components/ui';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { AgendaBucketRow } from '@/components/agenda/AgendaBucketRow';
import { AgendaEmptyIllustration } from '@/components/agenda/AgendaEmptyIllustration';
import { AgendaEventRow } from '@/components/agenda/AgendaEventRow';
import { AgendaLikedRangeModal } from '@/components/agenda/AgendaLikedRangeModal';
import { AgendaMonthGrid } from '@/components/agenda/AgendaMonthGrid';
import { AgendaCountLabel } from '@/components/agenda/AgendaWeekStrip';
import { FavoritesMapView } from '@/components/favorites/FavoritesMapView';
import { NavigationOptionsSheet } from '@/components/search/NavigationOptionsSheet';
import { features } from '@/config/features';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { useEventPublishSurfaces } from '@/hooks/useEventPublishSurfaces';
import { AgendaService } from '@/services/agenda.service';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useEventPreviewStore } from '@/store/eventPreviewStore';
import { useLikesStore } from '@/store/likesStore';
import type { CommunityMember } from '@/types/community';
import type { EventWithCreator } from '@/types/database';
import { isEventHearted, syncHeartStores, toggleEventHeart } from '@/utils/event-heart';
import { sharePublishedEvent } from '@/utils/event-share';
import { withUpdatedLikeCount } from '@/utils/likes-count';
import { prefetchEventMedia } from '@/utils/prefetch-event-media';
import { CONTRIBUTION_FAB_STACK_SPACE } from '@/utils/contribution-fab';
import {
  AGENDA_BUCKET_COPY,
  buildMonthGrid,
  countAgendaDayActivities,
  eventOverlapsLocalRange,
  filterAgendaBucketEvents,
  groupAgendaEventsByDay,
  isSameLocalDay,
  likedEventsInRange,
  shiftMonth,
  toLocalDateKey,
  type AgendaBucketId,
  visibleAgendaBuckets,
} from '@/utils/agenda';

type Props = {
  presentation?: 'tab' | 'modal';
};

type HubTab = 'agenda' | 'following';

const HUB_TABS = [
  { value: 'agenda' as const, label: 'Agenda' },
  { value: 'following' as const, label: 'Suivis' },
];

export default function AgendaScreen({ presentation = 'tab' }: Props) {
  const router = useRouter();
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  const appliedDayRef = useRef<string | null>(null);
  const insets = useSafeAreaInsets();
  const { profile, user, session, isLoading } = useAuth();
  const publishSurfaces = useEventPublishSurfaces();
  const replaceFavorites = useFavoritesStore((state) => state.replaceFavorites);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const favorites = useFavoritesStore((state) => state.favorites);
  const { likedEventIds, toggleLike } = useLikesStore();
  const isModal = presentation === 'modal';

  const [hubTab, setHubTab] = useState<HubTab>('agenda');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [likedModalOpen, setLikedModalOpen] = useState(false);
  const [now] = useState(() => new Date());
  const dayKey = typeof dayParam === 'string' ? dayParam : undefined;
  useEffect(() => {
    if (!dayKey || appliedDayRef.current === dayKey) return;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
    if (!match) return;
    const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(parsed.getTime())) return;
    appliedDayRef.current = dayKey;
    setAnchor(parsed);
    setSelectedDay(parsed);
  }, [dayKey]);
  const [selectedBucket, setSelectedBucket] = useState<AgendaBucketId | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [interestedEvents, setInterestedEvents] = useState<EventWithCreator[]>([]);
  const [participatingEvents, setParticipatingEvents] = useState<EventWithCreator[]>([]);
  const [organizingEvents, setOrganizingEvents] = useState<EventWithCreator[]>([]);
  const [followedMembers, setFollowedMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [navEvent, setNavEvent] = useState<EventWithCreator | null>(null);
  const [mapPreviewEvent, setMapPreviewEvent] = useState<EventWithCreator | null>(null);
  const [statsByEventId, setStatsByEventId] = useState<Record<string, EventCardStats>>({});
  const [pendingHeartIds, setPendingHeartIds] = useState<Set<string>>(() => new Set());
  const pendingHeartRef = useRef(new Set<string>());

  const ownerId = profile?.id || user?.id || session?.user?.id || null;
  const flags = useMemo(
    () => ({ checkin: features.checkin, eventCreate: features.eventCreate }),
    [],
  );
  const buckets = useMemo(() => visibleAgendaBuckets(flags), [flags]);
  const monthDays = useMemo(() => buildMonthGrid(anchor), [anchor]);

  const membership = useMemo(
    () => ({
      interestedIds: interestedEvents.map((event) => event.id),
      participatingIds: participatingEvents.map((event) => event.id),
      organizingIds: organizingEvents.map((event) => event.id),
    }),
    [interestedEvents, organizingEvents, participatingEvents],
  );

  const allEvents = useMemo(() => {
    const byId = new Map<string, EventWithCreator>();
    for (const event of [...interestedEvents, ...participatingEvents, ...organizingEvents]) {
      byId.set(event.id, event);
    }
    return Array.from(byId.values());
  }, [interestedEvents, organizingEvents, participatingEvents]);

  const load = useCallback(async () => {
    if (!session || !ownerId) {
      replaceFavorites([]);
      setInterestedEvents([]);
      setParticipatingEvents([]);
      setOrganizingEvents([]);
      setFollowedMembers([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [interestedIds, participatingIds, organizing, follows] = await Promise.all([
        AgendaService.listInterestedEventIds(ownerId),
        flags.checkin ? AgendaService.listParticipatingEventIds(ownerId) : Promise.resolve([] as string[]),
        flags.eventCreate ? AgendaService.listOrganizingEvents(ownerId) : Promise.resolve([] as EventWithCreator[]),
        AgendaService.listFollowedMembers(ownerId).catch(() => []),
      ]);
      const neededIds = Array.from(new Set([...interestedIds, ...participatingIds, ...organizing.map((event) => event.id)]));
      const fetched = await AgendaService.getEventsByIds(neededIds);
      const byId = new Map(fetched.map((event) => [event.id, event]));
      for (const event of organizing) {
        if (!byId.has(event.id)) byId.set(event.id, event);
      }
      const interested = interestedIds.map((id) => byId.get(id)).filter(Boolean) as EventWithCreator[];
      const participating = participatingIds.map((id) => byId.get(id)).filter(Boolean) as EventWithCreator[];
      setInterestedEvents(interested);
      setParticipatingEvents(participating);
      setOrganizingEvents(organizing);
      replaceFavorites(interested);
      setFollowedMembers(
        follows.map((row) => ({
          user_id: row.user_id,
          display_name: row.display_name,
          avatar_url: row.avatar_url,
          city: row.city,
          events_created_count: 0,
          followers_count: 0,
        })),
      );
    } catch (error) {
      console.warn('load agenda', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [flags.checkin, flags.eventCreate, ownerId, replaceFavorites, session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!isLoading && session && ownerId && loading) {
      void load();
    }
  }, [isLoading, load, loading, ownerId, session]);

  const dayCount = useMemo(
    () => countAgendaDayActivities(allEvents, selectedDay, membership, flags, now),
    [allEvents, flags, membership, now, selectedDay],
  );
  const markedKeys = useMemo(() => {
    const marked = new Set<string>();
    for (const day of monthDays) {
      if (interestedEvents.some((event) => eventOverlapsLocalRange(event, day, day))) marked.add(toLocalDateKey(day));
    }
    return marked;
  }, [interestedEvents, monthDays]);
  const likedRangeEvents = useMemo(
    () => (rangeStart ? likedEventsInRange(interestedEvents, rangeStart, rangeEnd ?? rangeStart) : []),
    [interestedEvents, rangeEnd, rangeStart],
  );

  const bucketCounts = useMemo(() => {
    const counts = {} as Record<AgendaBucketId, number>;
    for (const bucket of buckets) {
      counts[bucket] = filterAgendaBucketEvents(allEvents, bucket, membership, {
        day: bucket === 'past' ? null : selectedDay,
        now,
      }).length;
    }
    return counts;
  }, [allEvents, buckets, membership, now, selectedDay]);

  const bucketEvents = useMemo(() => {
    if (!selectedBucket) return [];
    return filterAgendaBucketEvents(allEvents, selectedBucket, membership, {
      day: selectedBucket === 'past' ? null : selectedDay,
      now,
    });
  }, [allEvents, membership, now, selectedBucket, selectedDay]);

  const groupedBucketEvents = useMemo(() => groupAgendaEventsByDay(bucketEvents), [bucketEvents]);
  const likesSet = useMemo(() => new Set(likedEventIds), [likedEventIds]);
  const favoritesSet = useMemo(() => new Set(favorites.map((event) => event.id)), [favorites]);
  const bucketEventIdsKey = useMemo(() => bucketEvents.map((event) => event.id).join(','), [bucketEvents]);

  useEffect(() => {
    let cancelled = false;
    const eventIds = bucketEventIdsKey ? bucketEventIdsKey.split(',') : [];
    if (!eventIds.length) {
      setStatsByEventId({});
      return;
    }
    void EventCardStatsService.getStatsForEvents(eventIds, ownerId)
      .then((stats) => {
        if (!cancelled) setStatsByEventId(stats);
      })
      .catch(() => {
        if (!cancelled) setStatsByEventId({});
      });
    return () => {
      cancelled = true;
    };
  }, [bucketEventIdsKey, ownerId]);

  const openEvent = useCallback((event: EventWithCreator) => {
    useEventPreviewStore.getState().prepareEventDetail(event);
    prefetchEventMedia(event);
    router.push(`/events/${event.id}` as any);
  }, [router]);

  const handleShareEvent = useCallback(async (event: EventWithCreator) => {
    try {
      await sharePublishedEvent(event);
    } catch {
      Alert.alert('Erreur', 'Impossible d’ouvrir le partage pour le moment.');
    }
  }, []);

  const handleToggleHeart = useCallback(
    async (event: EventWithCreator) => {
      if (!ownerId || pendingHeartRef.current.has(event.id)) return;
      pendingHeartRef.current.add(event.id);
      setPendingHeartIds(new Set(pendingHeartRef.current));
      const before = {
        isLiked: likesSet.has(event.id),
        isFavorite: favoritesSet.has(event.id),
      };
      try {
        const after = await toggleEventHeart(ownerId, event, before);
        syncHeartStores(event, before, after, { toggleLike, toggleFavorite });
        const hearted = isEventHearted(after.isLiked, after.isFavorite);
        const patch = (list: EventWithCreator[]) =>
          withUpdatedLikeCount(list, event.id, before.isLiked, after.isLiked);
        setInterestedEvents((prev) => {
          const next = patch(prev);
          if (hearted) {
            if (next.some((item) => item.id === event.id)) return next;
            return [event, ...next];
          }
          return next.filter((item) => item.id !== event.id);
        });
        setParticipatingEvents(patch);
        setOrganizingEvents(patch);
        const self = {
          id: ownerId,
          display_name: profile?.display_name || 'Moi',
          avatar_url: profile?.avatar_url || null,
          is_followed: false,
        };
        setStatsByEventId((prev) => ({
          ...prev,
          [event.id]: EventCardStatsService.applyLikeToggle(
            event.id,
            before.isLiked,
            after.isLiked,
            self,
            ownerId,
            prev[event.id] ?? {
              viewsCount: 0,
              friendsGoingCount: 0,
              likesCount: event.likes_count ?? 0,
              likers: [],
            },
          ),
        }));
      } catch (error) {
        console.warn('toggle agenda heart', error);
      } finally {
        pendingHeartRef.current.delete(event.id);
        setPendingHeartIds(new Set(pendingHeartRef.current));
      }
    },
    [
      favoritesSet,
      likesSet,
      ownerId,
      profile?.avatar_url,
      profile?.display_name,
      toggleFavorite,
      toggleLike,
    ],
  );

  const handleCreate = () => {
    if (!features.eventCreate) return;
    router.push(publishSurfaces.routes.eventFormStepper as any);
  };

  const closeModal = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/map' as any);
  };

  if (isLoading || (loading && session)) {
    return (
      <View style={styles.centered}>
        <AppBackground />
        <DiscoveryLoadingState
          title="Nous préparons votre agenda"
          subtitle="Tes moments notés arrivent…"
        />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <AppBackground />
        <GuestGateModal
          visible
          title="Accéder à votre agenda"
          onClose={() => router.replace('/(tabs)/map' as any)}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </View>
    );
  }

  const emptyHub = buckets.every((bucket) => (bucketCounts[bucket] || 0) === 0);

  return (
    <View style={styles.container}>
      <AppBackground />
      <View style={[styles.content, { paddingTop: isModal ? spacing.md : insets.top + spacing.xs }]}>
        <View style={styles.headerRow}>
          {isModal ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={closeModal}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <BrandIcon name="close" size={20} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButtonGhost} />
          )}
          <Text style={styles.title}>Mon agenda</Text>
          <View style={styles.iconButtonGhost} />
        </View>

        {!isModal ? (
          <SlidingSegmentedControl
            value={hubTab}
            options={HUB_TABS}
            onChange={setHubTab}
            accessibilityLabel="Agenda ou personnes suivies"
          />
        ) : null}

        {hubTab === 'following' && !isModal ? (
          <ScrollView
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void load();
                }}
                tintColor={colors.brand.secondary}
              />
            }
          >
            {followedMembers.length === 0 ? (
              <EmptyState
                icon={Compass}
                title="Aucun profil suivi"
                subtitle="Suivez des membres depuis la communauté pour les retrouver ici."
                ctaLabel="Découvrir la communauté"
                onCtaPress={() => router.push('/(tabs)/community' as any)}
              />
            ) : (
              followedMembers.map((member) => (
                <TouchableOpacity
                  key={member.user_id}
                  style={styles.memberCard}
                  onPress={() => router.push(`/community/${member.user_id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={member.display_name}
                >
                  <UserAvatar uri={member.avatar_url} name={member.display_name} size={52} />
                  <View style={styles.memberBody}>
                    <Text style={styles.memberName}>{member.display_name}</Text>
                    <Text style={styles.memberMeta}>{member.city || 'Membre'}</Text>
                  </View>
                  <BrandIcon name="users" size={18} color={colors.brand.textSecondary} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        ) : (
          <View style={styles.agendaBody}>
            <AgendaMonthGrid
              days={monthDays}
              month={anchor}
              today={now}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              markedKeys={markedKeys}
              onSelect={(day) => {
                setSelectedDay(day);
                setSelectedBucket(null);
                setShowMap(false);
                const extending = rangeStart && !rangeEnd && !isSameLocalDay(rangeStart, day);
                if (extending && rangeStart) {
                  const forward = rangeStart.getTime() <= day.getTime();
                  setRangeStart(forward ? rangeStart : day);
                  setRangeEnd(forward ? day : rangeStart);
                } else if (rangeStart && rangeEnd && !isSameLocalDay(rangeStart, rangeEnd)) {
                  setRangeStart(day);
                  setRangeEnd(null);
                } else {
                  setRangeStart(day);
                  setRangeEnd(null);
                }
                setLikedModalOpen(true);
              }}
              onShiftMonth={(delta) => setAnchor(shiftMonth(anchor, delta))}
            />
            <ScrollView
              style={styles.agendaScroll}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    void load();
                  }}
                  tintColor={colors.brand.secondary}
                />
              }
            >
            <AgendaCountLabel count={dayCount} />

            {buckets.map((bucket) => (
              <View key={bucket}>
                <AgendaBucketRow
                  bucket={bucket}
                  title={AGENDA_BUCKET_COPY[bucket].title}
                  count={bucketCounts[bucket] || 0}
                  expanded={selectedBucket === bucket}
                  onPress={() => {
                    setSelectedBucket((current) => (current === bucket ? null : bucket));
                    setShowMap(false);
                  }}
                />
                {selectedBucket === bucket ? (
                  <View style={styles.bucketDetail}>
                    {bucket === 'interested' ? (
                      <View style={styles.mapToggleRow}>
                        <TouchableOpacity
                          style={[styles.mapToggle, !showMap && styles.mapToggleActive]}
                          onPress={() => setShowMap(false)}
                        >
                          <Text style={[styles.mapToggleText, !showMap && styles.mapToggleTextActive]}>Liste</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.mapToggle, showMap && styles.mapToggleActive]}
                          onPress={() => setShowMap(true)}
                        >
                          <Text style={[styles.mapToggleText, showMap && styles.mapToggleTextActive]}>Carte</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    {bucketEvents.length === 0 ? (
                      <EmptyState
                        title={AGENDA_BUCKET_COPY[bucket].emptyTitle}
                        subtitle={AGENDA_BUCKET_COPY[bucket].emptySubtitle}
                        ctaLabel="Découvrir les activités"
                        onCtaPress={() => router.push('/(tabs)/map' as any)}
                      />
                    ) : showMap && bucket === 'interested' ? (
                      <View style={styles.mapWrap}>
                        <FavoritesMapView
                          events={bucketEvents}
                          selectedEvent={mapPreviewEvent}
                          currentUserId={profile?.id}
                          isHearted={
                            mapPreviewEvent
                              ? likesSet.has(mapPreviewEvent.id) || favoritesSet.has(mapPreviewEvent.id)
                              : false
                          }
                          onSelectEvent={(event) => {
                            setMapPreviewEvent(event);
                            prefetchEventMedia(event);
                          }}
                          onClearSelection={() => setMapPreviewEvent(null)}
                          onOpenDetails={openEvent}
                          onNavigate={setNavEvent}
                          onToggleHeart={handleToggleHeart}
                        />
                      </View>
                    ) : (
                      groupedBucketEvents.map((group) => (
                        <View key={group.key} style={styles.dayGroup}>
                          <Text accessibilityRole="header" style={styles.dayLabel}>
                            {group.label}
                          </Text>
                          {group.events.map((event) => (
                            <AgendaEventRow
                              key={event.id}
                              event={event}
                              stats={statsByEventId[event.id]}
                              liked={likesSet.has(event.id) || favoritesSet.has(event.id)}
                              pending={pendingHeartIds.has(event.id)}
                              onOpen={openEvent}
                              onToggleHeart={handleToggleHeart}
                              onShare={handleShareEvent}
                            />
                          ))}
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            ))}
            {emptyHub ? (
              <View style={styles.emptyHub}>
                <AgendaEmptyIllustration />
                <Text style={styles.emptyTitle}>Aucune activité</Text>
                <Text style={styles.emptySubtitle}>
                  Elles apparaîtront ici dès que tu notes un moment, ou que tu y participes.
                </Text>
                <TouchableOpacity
                  style={styles.cta}
                  onPress={() => router.push('/(tabs)/map' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Découvrir les activités"
                >
                  <Text style={styles.ctaText}>Découvrir les activités</Text>
                </TouchableOpacity>
                {features.eventCreate ? (
                  <TouchableOpacity
                    style={styles.secondaryCta}
                    onPress={handleCreate}
                    accessibilityRole="button"
                    accessibilityLabel="Créer une activité"
                  >
                    <Text style={styles.secondaryCtaText}>Créer une activité</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
          </View>
        )}
      </View>
      <AgendaLikedRangeModal
        visible={likedModalOpen}
        start={rangeStart}
        end={rangeEnd}
        events={likedRangeEvents}
        statsByEventId={statsByEventId}
        likedIds={new Set([...likesSet, ...favoritesSet])}
        pendingIds={pendingHeartIds}
        onClose={() => setLikedModalOpen(false)}
        onOpen={(event) => {
          setLikedModalOpen(false);
          openEvent(event);
        }}
        onToggleHeart={handleToggleHeart}
        onShare={handleShareEvent}
      />
      <NavigationOptionsSheet event={navEvent} visible={!!navEvent} onClose={() => setNavEvent(null)} />
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
    gap: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h4,
    flex: 1,
    textAlign: 'center',
    color: colors.brand.text,
    fontWeight: '800',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.10)',
  },
  iconButtonGhost: {
    width: 40,
    height: 40,
  },
  agendaBody: {
    flex: 1,
  },
  agendaScroll: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxxl + CONTRIBUTION_FAB_STACK_SPACE,
    gap: spacing.md,
  },
  bucketDetail: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  dayGroup: {
    gap: 0,
  },
  dayLabel: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.brand.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'capitalize',
  },
  emptyHub: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.brand.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  cta: {
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    ...typography.bodySmall,
    color: colors.brand.onAccent,
    fontWeight: '800',
  },
  secondaryCta: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  secondaryCtaText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  mapToggleRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.brand.surfaceMuted,
    borderRadius: borderRadius.full,
    padding: 2,
    gap: 2,
  },
  mapToggle: {
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapToggleActive: {
    backgroundColor: colors.brand.secondary,
  },
  mapToggleText: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  mapToggleTextActive: {
    color: colors.brand.onAccent,
  },
  mapWrap: {
    height: 360,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  memberBody: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  memberMeta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
});
