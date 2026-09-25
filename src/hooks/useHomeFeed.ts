import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { features } from '@/config/features';
import { DISCOVERY_DEFAULT_RADIUS_KM, DISCOVERY_MAX_RADIUS_KM } from '@/constants/filters';
import { useAuth, useLocation } from '@/hooks';
import { AgendaService } from '@/services/agenda.service';
import { PreferencesService } from '@/services/preferences.service';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';
import { NotificationsService } from '@/services/notifications.service';
import { useDiscoveryFiltersStore, useFavoritesStore, useLikesStore, useMapTransferStore } from '@/store';
import { useDiscoverySnapshotStore } from '@/store/discoverySnapshotStore';
import { useEventPreviewStore } from '@/store/eventPreviewStore';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import type { EventWithCreator } from '@/types/database';
import { toLocalDateKey } from '@/utils/agenda';
import { listMapViewportForMap } from '@/utils/bbox-event-fetch';
import { formatDistanceLabel } from '@/utils/event-card-display';
import { ensureEventHearted, removeEventHeart, syncHeartStores } from '@/utils/event-heart';
import { filterEvents } from '@/utils/filter-events';
import {
  buildHomeHero, countHomeSlotEvents, defaultHomeTimeSlot, eventMatchesHomeSlot, filtersForHomeTimeSlot,
  focusForHomeEvents, hasSaturdayPlan, homeDistanceKm, homeEventReason, isHomeEventEligible,
  nextHomeTimeSlot, rankHomeEvents, selectLocalPulse, selectNextAgendaEvent,
  selectSocialSignal, uniqueHomeEvents, type HomeTimeSlot,
} from '@/utils/home-feed';
import { eventMatchesDatePreset } from '@/utils/event-date-windows';
import { prefetchEventMedia } from '@/utils/prefetch-event-media';
import { getBoundsFromRadiusKm } from '@/utils/search-helpers';

const HOME_POOL_LIMIT = 120;
const EMPTY_CONTENT = { categories: [], subcategories: [], tags: [], query: '' };
type Center = { latitude: number; longitude: number };
type Pool = { key: string; events: EventWithCreator[]; complete: boolean; fetchedAt: number };
const zoneKey = (center: Center | null, radius: number) => center
  ? `${center.latitude.toFixed(3)}:${center.longitude.toFixed(3)}:${radius}` : '';
const readSnapshot = (): Pool => {
  const snapshot = useDiscoverySnapshotStore.getState().home;
  return {
    key: zoneKey(snapshot?.center ?? null, snapshot?.radiusKm ?? DISCOVERY_DEFAULT_RADIUS_KM),
    events: snapshot ? useEventPreviewStore.getState().getCachedEvents(snapshot.eventIds) : [],
    complete: false, fetchedAt: 0,
  };
};

export function useHomeFeed() {
  const router = useRouter();
  const { profile } = useAuth();
  const { currentLocation, isLoading: locationLoading, error: locationError, requestPermission } = useLocation();
  const place = useDiscoveryFiltersStore(state => state.place);
  const snapshot = useDiscoverySnapshotStore(state => state.home);
  const hydrated = useDiscoverySnapshotStore(state => state.hydrated);
  const taxonomy = useTaxonomyStore(state => state.categoriesMap);
  const [now, setNow] = useState(() => new Date());
  const [slot, setSlot] = useState<HomeTimeSlot>(() => defaultHomeTimeSlot());
  const [pool, setPool] = useState<Pool>(readSnapshot);
  const poolRef = useRef(pool); poolRef.current = pool;
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [privateData, setPrivateData] = useState<{ userId: string; agenda: EventWithCreator[]; interestedIds: string[]; themes: string[]; agendaLoaded: boolean }>({ userId: '', agenda: [], interestedIds: [], themes: [], agendaLoaded: false });
  const [socialData, setSocialData] = useState<{ userId: string; stats: Record<string, EventCardStats> }>({ userId: '', stats: {} });
  const [notificationData, setNotificationData] = useState({ userId: '', count: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [guestGate, setGuestGate] = useState<string | null>(null);
  const [pendingHearts, setPendingHearts] = useState<ReadonlySet<string>>(new Set());
  const pendingRef = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const userId = profile?.id ?? '';
  const userRef = useRef(userId); userRef.current = userId;
  const privateRequest = useRef(0);
  const agendaMutation = useRef(0);
  const requestRef = useRef(0);
  const inFlight = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const defaultSlotChosen = useRef(false);
  const manualSlot = useRef(false);

  const latitude = place.center?.latitude ?? currentLocation?.coords.latitude ?? snapshot?.center?.latitude;
  const longitude = place.center?.longitude ?? currentLocation?.coords.longitude ?? snapshot?.center?.longitude;
  const browseCenter = useMemo(() => latitude != null && longitude != null ? { latitude, longitude } : null, [latitude, longitude]);
  const browseRadiusKm = place.radiusKm ?? DISCOVERY_DEFAULT_RADIUS_KM;
  const key = zoneKey(browseCenter, browseRadiusKm);
  const currentKey = useRef(key); currentKey.current = key;
  const dayKey = toLocalDateKey(now);
  const poolEvents = useMemo(() => pool.key === key ? pool.events.filter(event => isHomeEventEligible(event, now)) : [], [key, now, pool]);
  const complete = pool.key === key && pool.complete;

  useEffect(() => {
    if (!hydrated || poolRef.current.fetchedAt) return;
    const restored = readSnapshot();
    if (restored.events.length) setPool(restored);
  }, [hydrated]);

  const loadPool = useCallback((force = false): Promise<void> => {
    if (!browseCenter || !hydrated) return Promise.resolve();
    if (inFlight.current?.key === key) return inFlight.current.promise;
    if (!force && poolRef.current.key === key && Date.now() - poolRef.current.fetchedAt < 45_000) return Promise.resolve();
    const request = ++requestRef.current;
    setPoolLoading(true); setPoolError(null);
    const promise = (async () => {
      try {
        const bounds = getBoundsFromRadiusKm(browseCenter.latitude, browseCenter.longitude, browseRadiusKm);
        const viewport = await listMapViewportForMap({ ...bounds, limit: HOME_POOL_LIMIT }, 'current');
        if (!mounted.current || request !== requestRef.current || currentKey.current !== key) return;
        const events = uniqueHomeEvents(filterEvents(viewport.events || [], {
          centerLat: browseCenter.latitude, centerLon: browseCenter.longitude, radiusKm: browseRadiusKm, includePast: false,
        })).filter(event => isHomeEventEligible(event, new Date()));
        useEventPreviewStore.getState().rememberEvents(events);
        useDiscoverySnapshotStore.getState().setHomeSnapshot({ queryKey: `contextual:${key}`, center: browseCenter, radiusKm: browseRadiusKm, eventIds: events.map(event => event.id), storedAt: Date.now() });
        setPool({ key, events, complete: viewport.events.length < HOME_POOL_LIMIT, fetchedAt: Date.now() });
      } catch {
        if (mounted.current && request === requestRef.current && currentKey.current === key) setPoolError('La mise à jour est indisponible. Tu peux réessayer.');
      } finally {
        if (request === requestRef.current) {
          inFlight.current = null;
          if (mounted.current) setPoolLoading(false);
        }
      }
    })();
    inFlight.current = { key, promise };
    return promise;
  }, [browseCenter, browseRadiusKm, hydrated, key]);

  useEffect(() => { void loadPool(); }, [loadPool, dayKey]);

  const loadPrivate = useCallback(async () => {
    const request = ++privateRequest.current;
    const mutation = agendaMutation.current;
    if (!userId) return;
    const stillCurrent = () => mounted.current && userRef.current === userId && request === privateRequest.current;
    // Optional sources fail independently; none gates the public feed.
    await Promise.allSettled([
      (async () => {
        const [interested, participating] = await Promise.all([
          AgendaService.listInterestedEventIds(userId),
          features.checkin ? AgendaService.listParticipatingEventIds(userId) : Promise.resolve([]),
        ]);
        const ids = [...new Set([...interested, ...participating])];
        const events = await AgendaService.getEventsByIds(ids);
        if (stillCurrent() && mutation === agendaMutation.current) setPrivateData(previous => ({ userId, themes: previous.userId === userId ? previous.themes : [], agenda: events, interestedIds: interested, agendaLoaded: true }));
      })(),
      PreferencesService.getMine(userId).then(preferences => {
        if (stillCurrent() && mutation === agendaMutation.current) setPrivateData(previous => ({ userId, agenda: previous.userId === userId ? previous.agenda : [], interestedIds: previous.userId === userId ? previous.interestedIds : [], agendaLoaded: previous.userId === userId && previous.agendaLoaded, themes: preferences.preferred_category_slugs }));
      }),
      NotificationsService.getUnreadCount().then(count => { if (stillCurrent()) setNotificationData({ userId, count }); }),
    ]);
  }, [userId]);

  const loadPoolOnFocus = useRef(loadPool);
  loadPoolOnFocus.current = loadPool;
  useFocusEffect(useCallback(() => {
    const tick = () => setNow(new Date()); tick();
    void loadPoolOnFocus.current(); void loadPrivate();
    const timer = setInterval(tick, 60_000);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') { tick(); void loadPoolOnFocus.current(); void loadPrivate(); }
    });
    return () => { clearInterval(timer); listener.remove(); };
  }, [loadPrivate]));

  const agendaEvents = useMemo(() => privateData.userId === userId && userId ? privateData.agenda : [], [privateData, userId]);
  const categorySlugs = useMemo(() => Object.fromEntries(Object.entries(taxonomy).map(([id, category]) => [id, category.slug])), [taxonomy]);
  const nextEvent = useMemo(() => selectNextAgendaEvent(agendaEvents, now), [agendaEvents, now]);
  const rankContext = useMemo(() => ({ now, slot, center: browseCenter, preferredCategorySlugs: privateData.userId === userId && userId ? privateData.themes : [], categorySlugs }), [now, slot, browseCenter, privateData, userId, categorySlugs]);
  const rankedEvents = useMemo(() => rankHomeEvents(poolEvents, { ...rankContext, excludeIds: nextEvent ? [nextEvent.id] : [] }), [poolEvents, rankContext, nextEvent]);
  const slotCount = useMemo(() => countHomeSlotEvents(poolEvents, slot, now), [poolEvents, slot, now]);
  const pulse = useMemo(() => selectLocalPulse(poolEvents, rankContext), [poolEvents, rankContext]);

  useEffect(() => {
    if ((!poolEvents.length && !pool.fetchedAt) || pool.key !== key || defaultSlotChosen.current || manualSlot.current) return;
    defaultSlotChosen.current = true;
    const preferred = defaultHomeTimeSlot(now);
    const useful = [preferred, 'now', 'tonight', 'tomorrow', 'weekend'] as HomeTimeSlot[];
    setSlot(useful.find(option => countHomeSlotEvents(poolEvents, option, now) > 0) ?? preferred);
  }, [pool.fetchedAt, pool.key, key, now, poolEvents]);

  const socialIds = useMemo(() => rankHomeEvents(poolEvents, { ...rankContext, slot: 'tomorrow' })
    .concat(rankHomeEvents(poolEvents, { ...rankContext, slot: 'weekend' }), rankedEvents)
    .map(event => event.id).filter((id, index, ids) => ids.indexOf(id) === index).slice(0, 9), [poolEvents, rankContext, rankedEvents]);
  const socialKey = socialIds.join(',');
  useEffect(() => {
    if (!userId || !features.socialPeers || !socialKey) return;
    let cancelled = false;
    void EventCardStatsService.getStatsForEvents(socialKey.split(','), userId).then(stats => {
      if (!cancelled) setSocialData({ userId, stats });
    }).catch(() => { if (!cancelled) setSocialData({ userId, stats: {} }); });
    return () => { cancelled = true; };
  }, [userId, socialKey]);
  const socialSignal = useMemo(() => userId && features.socialPeers && socialData.userId === userId
    ? selectSocialSignal(poolEvents.filter(event => event.id !== nextEvent?.id && !rankedEvents.some(card => card.id === event.id)), socialData.stats, now) : null,
  [userId, socialData, poolEvents, rankedEvents, nextEvent?.id, now]);
  const todayCount = poolEvents.filter(event => eventMatchesDatePreset(event, 'today', now)).length;
  const hero = buildHomeHero({ now, nearbyCount: poolEvents.length, todayCount, complete, isAuthenticated: Boolean(userId && privateData.userId === userId && privateData.agendaLoaded), hasSaturdayPlan: hasSaturdayPlan(agendaEvents, now) });
  const distanceLabelFor = useCallback((event: EventWithCreator) => browseCenter && Number.isFinite(event.latitude) && Number.isFinite(event.longitude)
    ? formatDistanceLabel(homeDistanceKm(browseCenter.latitude, browseCenter.longitude, event.latitude, event.longitude)) : null, [browseCenter]);
  const reasonFor = useCallback((event: EventWithCreator) => homeEventReason(event, rankContext), [rankContext]);
  const isHearted = useCallback((id: string) => Boolean(userId && privateData.userId === userId && privateData.interestedIds.includes(id)), [privateData, userId]);

  const openEvent = useCallback((event: EventWithCreator) => {
    useEventPreviewStore.getState().prepareEventDetail(event); prefetchEventMedia(event);
    router.push(`/map-event/${event.id}?origin=home-list` as never);
  }, [router]);
  useEffect(() => {
    const visible = [...rankedEvents, ...(nextEvent ? [nextEvent] : [])];
    useEventPreviewStore.getState().pinVisibleEvents('home', visible.map(event => event.id));
    visible.forEach(event => prefetchEventMedia(event));
  }, [rankedEvents, nextEvent]);

  const applySlotToMap = useCallback((target: HomeTimeSlot, options?: {
    camera?: { latitude: number; longitude: number; radiusKm: number };
    placeCenter?: Center;
    placeRadiusKm?: number;
    label?: string;
  }) => {
    const temporal = filtersForHomeTimeSlot(target);
    const center = options?.placeCenter ?? browseCenter;
    const radiusKm = options?.placeRadiusKm ?? browseRadiusKm;
    const camera = options?.camera ?? (center ? { ...center, radiusKm } : undefined);
    useDiscoveryFiltersStore.getState().applySearchCriteria({
      when: temporal.when, content: EMPTY_CONTENT,
      place: { center, radiusKm, label: options?.label || place.label || 'Autour de moi' },
    }, { status: temporal.status, applied: true });
    useMapTransferStore.getState().setHomeTransfer({ focus: camera });
    router.push({ pathname: '/(tabs)/map', params: { focus: '' } } as never);
  }, [browseCenter, browseRadiusKm, place.label, router]);
  const openSearch = useCallback(() => {
    useMapTransferStore.getState().setHomeTransfer({ openSearch: true });
    router.push('/(tabs)/map' as never);
  }, [router]);
  const openProposals = useCallback(() => {
    if (!userId) { setGuestGate('Créer vos propositions'); return; }
    router.push('/(tabs)/proposals' as never);
  }, [router, userId]);
  const openAgenda = useCallback(() => {
    router.push({ pathname: '/(tabs)/favorites', params: { day: nextEvent ? toLocalDateKey(new Date(nextEvent.starts_at)) : toLocalDateKey(now) } } as never);
  }, [nextEvent, now, router]);
  const toggleHeart = useCallback(async (event: EventWithCreator) => {
    if (!userId) { setGuestGate('Connecte-toi pour enregistrer un moment'); return; }
    if (pendingRef.current.has(event.id)) return;
    pendingRef.current.add(event.id); setPendingHearts(new Set(pendingRef.current));
    const before = { isLiked: useLikesStore.getState().isLiked(event.id), isFavorite: useFavoritesStore.getState().isFavorite(event.id) };
    try {
      // Agenda membership belongs to this account; persisted global heart stores may be stale.
      const after = isHearted(event.id)
        ? await removeEventHeart(userId, event.id)
        : await ensureEventHearted(userId, event, { isLiked: false, isFavorite: false });
      if (!mounted.current || userRef.current !== userId) return;
      syncHeartStores(event, before, after, { toggleLike: useLikesStore.getState().toggleLike, toggleFavorite: useFavoritesStore.getState().toggleFavorite });
      agendaMutation.current += 1;
      setPrivateData(previous => {
        const owned = previous.userId === userId ? previous : { userId, agenda: [], interestedIds: [], themes: [], agendaLoaded: false };
        const active = after.isLiked || after.isFavorite;
        return { ...owned,
          interestedIds: active ? [...new Set([...owned.interestedIds, event.id])] : owned.interestedIds.filter(id => id !== event.id),
          agenda: active ? uniqueHomeEvents([...owned.agenda, event]) : owned.agenda.filter(item => item.id !== event.id),
        };
      });
    } catch {
      if (mounted.current && userRef.current === userId) Alert.alert('Enregistrement impossible', 'Réessaie dans un instant.');
    } finally {
      pendingRef.current.delete(event.id);
      if (mounted.current) setPendingHearts(new Set(pendingRef.current));
    }
  }, [userId, isHearted]);
  const refresh = useCallback(async () => {
    setRefreshing(true); setNow(new Date());
    try { await Promise.all([loadPool(true), loadPrivate()]); }
    finally { if (mounted.current) setRefreshing(false); }
  }, [loadPool, loadPrivate]);
  const protectedNavigate = (path: '/notifications' | '/(tabs)/profile') => {
    if (!userId) { setGuestGate('Connecte-toi pour retrouver ton espace'); return; }
    router.push(path as never);
  };
  return {
    profile, greeting: profile?.display_name?.trim() ? `Bonjour ${profile.display_name.trim().split(/\s+/)[0]}` : 'Bonjour',
    showLumia: features.lumiaChat, unreadNotifications: notificationData.userId === userId ? notificationData.count : 0,
    openSearch, openProfile: () => protectedNavigate('/(tabs)/profile'), openNotifications: () => protectedNavigate('/notifications'),
    openProposals,
    slot, setSlot: (value: HomeTimeSlot) => { manualSlot.current = true; setSlot(value); },
    rankedEvents, slotCount, complete, hero, pulse, socialSignal, nextEvent, reasonFor, pendingHearts,
    poolLoading: poolLoading || !hydrated, poolError, poolEvents, refreshing, browseCenter, browseRadiusKm, locationLoading, locationError, requestPermission,
    zoneLabel: place.label || (snapshot?.center && !currentLocation ? 'Dernière zone consultée' : 'Position actuelle'),
    canWiden: browseRadiusKm < DISCOVERY_MAX_RADIUS_KM,
    distanceLabelFor, isHearted, openEvent,
    openMapForSlot: () => {
      const events = poolEvents.filter((event) => eventMatchesHomeSlot(event, slot, now));
      const camera = browseCenter
        ? focusForHomeEvents(events, { ...browseCenter, radiusKm: browseRadiusKm })
        : undefined;
      applySlotToMap(slot, { camera });
    },
    openPulse: () => {
      if (!pulse) return;
      const city = pulse.city.trim().toLocaleLowerCase('fr');
      const events = poolEvents.filter((event) => {
        const raw = event.city?.trim().split(',')[0]?.trim().toLocaleLowerCase('fr');
        return raw === city && eventMatchesHomeSlot(event, pulse.slot, now);
      });
      const camera = focusForHomeEvents(events, { ...pulse.center, radiusKm: Math.min(pulse.radiusKm, 8) });
      applySlotToMap(pulse.slot, { camera, placeCenter: pulse.center, placeRadiusKm: camera.radiusKm, label: pulse.city });
    },
    openAgenda, toggleHeart, widen: () => useDiscoveryFiltersStore.getState().setRadiusKm(Math.min(browseRadiusKm + 20, DISCOVERY_MAX_RADIUS_KM)),
    showNextDays: () => { manualSlot.current = true; setSlot(nextHomeTimeSlot(slot) ?? 'tomorrow'); },
    refresh, guestGateOpen: Boolean(guestGate), guestGateTitle: guestGate ?? '', closeGuestGate: () => setGuestGate(null), retry: () => void loadPool(true),
  };
}
