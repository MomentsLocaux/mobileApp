import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  PixelRatio,
  StatusBar,
  useWindowDimensions,
  AppState,
  BackHandler,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronRight, Edit, Trash2 } from 'lucide-react-native';
import {
  Button,
  AppBackground,
  screenHeaderStyles,
  MotionReveal,
  FloatingPressable,
  EventDetailSkeleton,
  PushButton,
  UserAvatar,
  BrandIcon,
} from '../../components/ui';
import { AdCard } from '@/components/ads/AdCard';
import { features } from '@/config/features';
import { sharePublishedEvent } from '@/utils/event-share';
import {
  EVENT_CALENDAR_LABEL,
  presentAddToDeviceCalendar,
} from '@/utils/event-calendar';
import {
  MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL,
} from '@/constants/branding';
import {
  isEventOrganizerOwner,
  isPlatformOrganizerEvent,
  publicOrganizerMeta,
  publicOrganizerName,
  shouldUseCreatorOrganizerAvatar,
} from '@/utils/event-organizer';
import { isCommunitySuggestedEvent } from '@/utils/suggestion-history';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/utils/haptics';
import { EventsService } from '../../services/events.service';
import { useAuth } from '../../hooks';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getCategoryLabel } from '../../constants/categories';
import { formatResolvedEventTagLabel, getEventPriceLabel, getVisibleEventTags, isMeaningfulPriceLabel } from '../../utils/event-card-display';
import type { EventMediaSubmission, EventWithCreator } from '../../types/database';
import { useComments } from '@/hooks/useComments';
import { useLocationStore } from '@/store';
import { PlaceMediaGallery, type MediaImage, type PlaceMediaGalleryHandle } from '@/components/events/PlaceMediaGallery';
import { EventHeartButton } from '@/components/events/EventHeartButton';
import type { BrandIconName } from '@/components/ui/BrandIcon';
import { EventDetailSection } from '@/components/events/EventDetailSection';
import { EventNearbySection, type EventNearbySectionHandle } from '@/components/events/EventNearbySection';
import { EventWeatherSection } from '@/components/events/EventWeatherSection';
import { EventMiniatureCarousel } from '@/components/events/EventMiniatureCarousel';
import { EventEchoesPreview } from '@/components/events/EventEchoesPreview';
import { supabase } from '@/lib/supabase/client';
import { useFavoritesStore } from '@/store/favoritesStore';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { NavigationOptionsSheet } from '@/components/search/NavigationOptionsSheet';
import { EventPhotoContributionModal } from '@/components/events/EventPhotoContributionModal';
import { EventLikersSheet } from '@/components/events/EventLikersSheet';
import { EventMediaSubmissionsService } from '@/services/event-media-submissions.service';
import { CommunityService } from '@/services/community.service';
import ReportReasonModal from '@/components/moderation/ReportReasonModal';
import { EventCorrectionSheet } from '@/components/events/EventCorrectionSheet';
import { EventPlatformOrganizerSheet } from '@/components/events/EventPlatformOrganizerSheet';
import { ReportService } from '@/services/report.service';
import type { ReportReasonCode } from '@/constants/report-reasons';
import Toast from 'react-native-toast-message';
import { useLikesStore } from '@/store/likesStore';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { useSimilarEvents } from '@/hooks/useSimilarEvents';
import { openDiffuseurContact } from '@/utils/open-website';
import { toggleEventHeart } from '@/utils/event-heart';
import { likesCountAfterHeartToggle } from '@/utils/likes-count';
import { getCommunityPhotoEligibility } from '@/utils/community-photo-eligibility';
import { getDistanceText } from '@/utils/sort-events';
import { formatEventCardRangeLine } from '@/utils/event-card-meta';
import { formatCityDistanceLine, formatPeerLikeLabel, formatPlaceDrawerLines } from '@/utils/event-detail-presentation';
import MapboxGL from '@rnmapbox/maps';
import { useMapDetailTransitionStore } from '@/store/mapDetailTransitionStore';
import {
  mergeCachedEvent,
  resolveSeededEventDetail,
  useEventPreviewStore,
} from '@/store/eventPreviewStore';
import { eventDetailSeedStillCurrent } from '@/store/eventCache';
import { prefetchEventMedia } from '@/utils/prefetch-event-media';
import {
  getMapDetailSlideOffset,
  shouldCompleteMapDetailDismiss,
} from '@/utils/map-detail-transition';

const DESCRIPTION_PREVIEW_LINES = 5;
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

const normalizeImageUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'none') return null;
  return trimmed;
};

const capitalizeFirst = (value: string) => {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

const formatDateLong = (value: string) =>
  capitalizeFirst(
    new Date(value).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  );

function isSameLocalDay(start?: string | null, end?: string | null): boolean {
  if (!start || !end) return false;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;
  return startDate.getFullYear() === endDate.getFullYear()
    && startDate.getMonth() === endDate.getMonth()
    && startDate.getDate() === endDate.getDate();
}

function PhotoGlyphButton({
  name,
  label,
  onPress,
  color,
  fillColor = 'transparent',
  washScroll,
  washEnd,
}: {
  name: BrandIconName;
  label: string;
  onPress: () => void;
  color?: string;
  fillColor?: string;
  washScroll?: SharedValue<number>;
  washEnd?: SharedValue<number>;
}) {
  const reported = Boolean(color);
  const lightStyle = useAnimatedStyle(() => {
    const end = Math.max(washEnd?.value ?? 1, 1);
    const tone = washScroll ? Math.min(Math.max(washScroll.value / end, 0), 1) : 0;
    return { opacity: reported ? 1 : 1 - tone };
  });
  const inkStyle = useAnimatedStyle(() => {
    const end = Math.max(washEnd?.value ?? 1, 1);
    const tone = washScroll ? Math.min(Math.max(washScroll.value / end, 0), 1) : 0;
    return { opacity: reported ? 0 : tone };
  });
  const shadowStyle = useAnimatedStyle(() => {
    const end = Math.max(washEnd?.value ?? 1, 1);
    const tone = washScroll ? Math.min(Math.max(washScroll.value / end, 0), 1) : 0;
    return { opacity: 0.55 * (1 - tone) };
  });
  const glyphColor = color ?? '#FFFFFF';
  const shadowFill = fillColor === 'transparent' ? 'transparent' : colors.brand.ink;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      activeOpacity={0.86}
      style={styles.photoGlyph}
    >
      <Animated.View pointerEvents="none" style={[styles.photoGlyphShadow, shadowStyle]}>
        <BrandIcon name={name} size={22} color={colors.brand.ink} fillColor={shadowFill} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.photoGlyphLayer, lightStyle]}>
        <BrandIcon name={name} size={22} color={glyphColor} fillColor={fillColor} />
      </Animated.View>
      {reported ? null : (
        <Animated.View pointerEvents="none" style={[styles.photoGlyphLayer, inkStyle]}>
          <BrandIcon name={name} size={22} color={colors.brand.ink} fillColor={fillColor} />
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

function EventDetailLocationMap({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const center = useMemo(
    () => [longitude, latitude] as [number, number],
    [latitude, longitude],
  );
  const applyCamera = useCallback(() => {
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel: 13,
      animationDuration: 0,
      animationMode: 'moveTo',
    });
  }, [center]);

  return (
    <View style={styles.locationMapBox}>
      <MapboxGL.MapView
        style={StyleSheet.absoluteFill}
        styleURL={MapboxGL.StyleURL.Dark}
        scrollEnabled
        zoomEnabled
        pitchEnabled
        rotateEnabled
        onDidFinishLoadingMap={applyCamera}
        onDidFinishLoadingStyle={applyCamera}
        onLayout={applyCamera}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: center, zoomLevel: 13 }}
          centerCoordinate={center}
          zoomLevel={13}
          animationMode="moveTo"
          animationDuration={0}
        />
        <MapboxGL.PointAnnotation id="event-location-preview" coordinate={center}>
          <View style={styles.locationMarker} />
        </MapboxGL.PointAnnotation>
      </MapboxGL.MapView>
    </View>
  );
}

export default function EventDetailScreen() {
  const { id, origin } = useLocalSearchParams<{ id: string; origin?: string }>();
  const router = useRouter();
  const windowDimensions = useWindowDimensions();
  const { profile, session, isLoading: authLoading } = useAuth();
  const { currentLocation } = useLocationStore();
  const insets = useSafeAreaInsets();
  const { comments } = useComments(id || '');
  const { isFavorite } = useFavoritesStore();
  const { isLiked } = useLikesStore();
  useTaxonomy();
  const tagsMap = useTaxonomyStore((s) => s.tagsMap);

  const transitionContext = useMapDetailTransitionStore((state) => state.context);
  const isListDetailOrigin = origin === 'home-list';
  const isMapTransitionOrigin =
    (origin === 'map-unit' || origin === 'map-sheet') &&
    transitionContext?.origin === origin;
  const canSwipeDismiss = isMapTransitionOrigin || isListDetailOrigin;
  const seededEvent = resolveSeededEventDetail({
    eventId: id,
    origin,
    mapEventId: transitionContext?.eventId,
    mapOrigin: transitionContext?.origin,
    mapEvent: transitionContext?.event ?? null,
  });
  const [event, setEvent] = useState<EventWithCreator | null>(seededEvent);
  const [loading, setLoading] = useState(!seededEvent);
  const reduceMotion = useReduceMotion();
  const canAnimateMapSurface =
    !reduceMotion && isMapTransitionOrigin && Boolean(seededEvent);
  const canAnimateListSurface = !reduceMotion && isListDetailOrigin;
  const canAnimateSurface = canAnimateMapSurface || canAnimateListSurface;
  const surfaceProgress = useSharedValue(canAnimateSurface ? 0 : 1);
  const [scrollAtTop, setScrollAtTop] = useState(true);
  const [sheetCoversPhoto, setSheetCoversPhoto] = useState(false);
  const [photoWashed, setPhotoWashed] = useState(false);
  const [addPhotoGone, setAddPhotoGone] = useState(false);
  const [entryMotionComplete, setEntryMotionComplete] = useState(
    !canAnimateSurface,
  );
  const dismissingRef = useRef(false);
  const mountedRef = useRef(true);
  const leaveRequestedAtRef = useRef(0);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissCommitted = useSharedValue(0);
  const seededIdRef = useRef(id);
  const galleryRef = useRef<PlaceMediaGalleryHandle>(null);
  const scrollY = useSharedValue(0);
  const scrollOffsetRef = useRef(0);
  const nearbySectionRef = useRef<EventNearbySectionHandle>(null);
  const photoHeight = Math.round(windowDimensions.height * 0.56);
  // Visible photo before the drawer. Shorter than the photo layer so the title
  // and the first facts show on open. Wash, banner contact and the add-photo
  // control still key off this peek, not off photoHeight.
  const photoPeek = Math.round(windowDimensions.height * 0.38);
  const titleFontSize = windowDimensions.width < 360 ? 24 : 27;
  const titleLineHeight = titleFontSize + 7;
  const stackActions = windowDimensions.width < 360 || PixelRatio.getFontScale() > 1.2;
  const finishEntryMotion = useCallback(() => {
    requestAnimationFrame(() => {
      setEntryMotionComplete(true);
    });
  }, []);
  const [guestGate, setGuestGate] = useState({ visible: false, title: '' });
  const [navSheetVisible, setNavSheetVisible] = useState(false);
  const [platformOrganizerSheetVisible, setPlatformOrganizerSheetVisible] = useState(false);
  const [communityPhotos, setCommunityPhotos] = useState<EventMediaSubmission[]>([]);
  const [loadingCommunityPhotos, setLoadingCommunityPhotos] = useState(false);
  const [contribModalVisible, setContribModalVisible] = useState(false);
  const [likersSheetVisible, setLikersSheetVisible] = useState(false);
  const [peersEngaged, setPeersEngaged] = useState<
    Array<{ id: string; display_name: string; avatar_url: string | null }>
  >([]);
  const [eventStats, setEventStats] = useState({
    likes: 0,
    interests: 0,
    checkins: 0,
    views: 0,
  });
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [heartPending, setHeartPending] = useState(false);
  const heartPendingRef = useRef(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [locationExpanded, setLocationExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionCanExpand, setDescriptionCanExpand] = useState(false);
  const [eventReportVisible, setEventReportVisible] = useState(false);
  const [eventReported, setEventReported] = useState(false);
  const [eventCorrectionVisible, setEventCorrectionVisible] = useState(false);

  const isGuest = !session;
  const isOwner = isEventOrganizerOwner(profile?.id, event);
  const isPlatformOrganizer = isPlatformOrganizerEvent(event);
  const organizerName = publicOrganizerName(event);
  const organizerMeta = publicOrganizerMeta(event);
  const organizerUsesCreatorAvatar = shouldUseCreatorOrganizerAvatar(event);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'moderateur';
  const canEditEvent =
    features.eventCreate &&
    isOwner &&
    (event?.status === 'draft' || event?.status === 'refused');
  const canDeleteEvent =
    features.eventCreate &&
    isOwner &&
    (event?.status === 'draft' || event?.status === 'refused' || event?.status === 'pending');
  const isEventLiked = event ? isLiked(event.id) : false;
  const isEventFavorited = event ? isFavorite(event.id) : false;
  const isEventHearted = isEventLiked || isEventFavorited;
  const similarReady = Boolean(event) && !loading && entryMotionComplete;
  const { events: similarEvents, loading: similarLoading } = useSimilarEvents(event, {
    ready: similarReady,
  });

  const openGuestGate = (title: string) => setGuestGate({ visible: true, title });
  const closeGuestGate = () => setGuestGate({ visible: false, title: '' });

  const handleShowDebugEventId = useCallback(() => {
    if (!event?.id) return;
    Alert.alert('Event ID', event.id, [
      { text: 'Fermer', style: 'cancel' },
      {
        text: 'Copier',
        onPress: async () => {
          await Clipboard.setStringAsync(event.id);
          Toast.show({ type: 'success', text1: 'ID copié' });
        },
      },
    ]);
  }, [event?.id]);

  const trackEventView = useCallback(
    async (eventId: string) => {
      void import('@/services/analytics.service').then(({ AnalyticsService }) => {
        AnalyticsService.track('event_viewed', { event_id: eventId, source: 'detail' });
      });
      try {
        const today = new Date().toISOString().split('T')[0];
        const storageKey = `event_view_${eventId}_${today}`;
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const alreadyViewed = await AsyncStorage.getItem(storageKey);
        if (alreadyViewed) return;

        // RLS: authenticated inserts must set profile_id = auth.uid(); anon must use null.
        // Prefer session.user.id so we don't insert null while the session exists but profile is still loading.
        const viewerId = session?.user?.id ?? null;
        const { error } = await supabase.from('event_views').insert({
          event_id: eventId,
          profile_id: viewerId,
        });
        if (error) {
          console.warn('trackEventView insert failed', error.message);
          return;
        }

        await AsyncStorage.setItem(storageKey, 'true');

        const { data: statsData, error: statsError } = await supabase.rpc('get_event_public_stats', {
          event_ids: [eventId],
        });
        if (!statsError) {
          const row = Array.isArray(statsData) ? statsData[0] : null;
          if (row) {
            setEventStats({
              likes: Number(row?.likes_count || 0),
              interests: Number(row?.interests_count || 0),
              checkins: Number(row?.checkins_count || 0),
              views: Number(row?.views_count || 0),
            });
          } else {
            setEventStats((prev) => ({ ...prev, views: prev.views + 1 }));
          }
        } else {
          setEventStats((prev) => ({ ...prev, views: prev.views + 1 }));
        }
      } catch (err) {
        console.warn('trackEventView error', err);
      }
    },
    [session?.user?.id],
  );

  const loadCommunityPhotos = useCallback(async (eventId: string) => {
    setLoadingCommunityPhotos(true);
    try {
      const approved = await EventMediaSubmissionsService.listApproved(eventId);
      setCommunityPhotos(approved);
    } catch (err) {
      console.warn('load community photos', err);
    } finally {
      setLoadingCommunityPhotos(false);
    }
  }, []);

  const loadEventStats = useCallback(async (eventId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_event_public_stats', { event_ids: [eventId] });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;

      setEventStats({
        likes: Number(row?.likes_count || 0),
        interests: Number(row?.interests_count || 0),
        checkins: Number(row?.checkins_count || 0),
        views: Number(row?.views_count || 0),
      });
    } catch (error) {
      console.warn('load event stats', error);
    }
  }, []);

  const loadEventDetails = useCallback(async () => {
    if (!id) return;
    void loadEventStats(id);
    void loadCommunityPhotos(id);
    try {
      const data = await EventsService.getEventById(id);
      const enriched = data ? { ...data, is_favorited: isFavorite(data.id), is_liked: isLiked(data.id) } : null;
      if (enriched) {
        setEvent((current) => {
          const merged = mergeCachedEvent(current ?? undefined, enriched);
          if (current && eventDetailSeedStillCurrent(current, merged)) {
            return current;
          }
          return merged;
        });
        useEventPreviewStore.getState().rememberEvent(enriched);
      } else {
        setEvent((current) => (current?.id === id ? current : null));
      }
    } catch (error) {
      console.warn('loadEventDetails error', error);
      setEvent((current) => (current?.id === id ? current : null));
    } finally {
      setLoading(false);
    }
  }, [id, isFavorite, isLiked, loadCommunityPhotos, loadEventStats]);

  useEffect(() => {
    if (!id || seededIdRef.current === id) return;
    seededIdRef.current = id;
    const transition = useMapDetailTransitionStore.getState().context;
    const next = resolveSeededEventDetail({
      eventId: id,
      origin,
      mapEventId: transition?.eventId,
      mapOrigin: transition?.origin,
      mapEvent: transition?.event ?? null,
    });
    setEvent(next);
    setLoading(!next);
  }, [id, origin]);

  useEffect(() => {
    if (!id) return;
    useEventPreviewStore.getState().pinOpenedEvent(id);
    return () => {
      const current = useEventPreviewStore.getState().openedId;
      if (current === id) {
        useEventPreviewStore.getState().pinOpenedEvent(null);
      }
    };
  }, [id]);

  useEffect(() => {
    if (!event) return;
    prefetchEventMedia(event, { includeGallery: true, priority: 'visible' });
  }, [event]);

  useFocusEffect(
    useCallback(() => {
      loadEventDetails();
    }, [loadEventDetails]),
  );

  useEffect(() => {
    if (!id || authLoading) return;
    void trackEventView(id);
  }, [id, authLoading, trackEventView]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!features.socialPeers || !event?.id || !profile?.id || isGuest) {
        if (mounted) setPeersEngaged([]);
        return;
      }
      try {
        const peers = await CommunityService.listEventEngagedByFollowing(event.id, { limit: 6 });
        if (mounted) setPeersEngaged(peers);
      } catch (e) {
        console.warn('peers engaged', e);
        if (mounted) setPeersEngaged([]);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [
    event?.id,
    profile?.id,
    isGuest,
    isLiked,
    isFavorite,
  ]);

  const finishMapDismiss = useCallback(() => {
    if (!mountedRef.current) return;
    const now = Date.now();
    // Collapse the animation callback and the safety timer into one pop.
    // A later press can try again if this screen is still mounted.
    if (now - leaveRequestedAtRef.current < 800) return;
    leaveRequestedAtRef.current = now;
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (isMapTransitionOrigin && id) {
      useMapDetailTransitionStore.getState().markReturning(id);
    }
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace(isMapTransitionOrigin ? '/(tabs)/map' : '/(tabs)');
    }
  }, [id, isMapTransitionOrigin, router]);

  const cancelMapDismiss = useCallback(() => {
    if (dismissCommitted.value === 1) return;
    dismissingRef.current = false;
    surfaceProgress.value = withSpring(1, Motion.spring.sheet);
  }, [dismissCommitted, surfaceProgress]);

  const animateMapDismiss = useCallback(() => {
    // A second request must still leave. The first animation can be cancelled
    // when another swipe writes the same shared value, and its callback then
    // reports finished=false. Without this, the screen stays open and ignores
    // both the swipe and the close button.
    if (dismissingRef.current) {
      finishMapDismiss();
      return;
    }
    dismissingRef.current = true;
    dismissCommitted.value = 1;
    const duration = reduceMotion ? 120 : 280;
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      finishMapDismiss();
    }, duration + 160);
    surfaceProgress.value = withTiming(
      0,
      {
        duration,
        easing: Motion.easing.emphasized,
      },
      (finished) => {
        'worklet';
        // finished is false when a later gesture cancels the timing. Still leave:
        // keeping the lock set is what makes the close button and the swipe die.
        if (finished || dismissCommitted.value === 1) {
          runOnJS(finishMapDismiss)();
        }
      },
    );
  }, [dismissCommitted, finishMapDismiss, reduceMotion, surfaceProgress]);

  const startMapDismiss = useCallback(() => {
    dismissCommitted.value = 1;
    if (isMapTransitionOrigin && transitionContext?.eventId !== id) {
      finishMapDismiss();
      return;
    }
    if (isMapTransitionOrigin && id) {
      useMapDetailTransitionStore.getState().markReturning(id);
    }
    animateMapDismiss();
  }, [
    animateMapDismiss,
    dismissCommitted,
    finishMapDismiss,
    id,
    isMapTransitionOrigin,
    transitionContext?.eventId,
  ]);

  const handleDismissGestureRelease = useCallback(
    (translationY: number, velocityY: number) => {
      if (
        shouldCompleteMapDetailDismiss(
          translationY,
          velocityY,
          windowDimensions.height,
        )
      ) {
        startMapDismiss();
        return;
      }
      cancelMapDismiss();
    },
    [cancelMapDismiss, startMapDismiss, windowDimensions.height],
  );

  useEffect(() => {
    if (!canSwipeDismiss) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        startMapDismiss();
        return true;
      },
    );
    return () => subscription.remove();
  }, [canSwipeDismiss, startMapDismiss]);

  const detailScrollGesture = useMemo(() => Gesture.Native(), []);
  const mapDismissGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canSwipeDismiss && scrollAtTop)
        .activeOffsetY(10)
        .failOffsetX([-24, 24])
        .simultaneousWithExternalGesture(detailScrollGesture)
        .onUpdate((gesture) => {
          if (dismissCommitted.value === 1) return;
          const translationY = Math.max(0, gesture.translationY);
          surfaceProgress.value = 1 - Math.min(
            0.82,
            translationY / Math.max(1, windowDimensions.height * 0.7),
          );
        })
        .onEnd((gesture) => {
          const translationY = Math.max(0, gesture.translationY);
          const velocityY = Math.max(0, gesture.velocityY);
          if (
            shouldCompleteMapDetailDismiss(
              translationY,
              velocityY,
              windowDimensions.height,
            )
          ) {
            // Commit on the UI thread before JS runs, so a follow-up touch
            // cannot overwrite the close animation and drop its callback.
            dismissCommitted.value = 1;
          }
          runOnJS(handleDismissGestureRelease)(translationY, velocityY);
        })
        .onFinalize((_gesture, success) => {
          if (dismissCommitted.value === 1) return;
          if (!success) {
            surfaceProgress.value = withSpring(1, Motion.spring.sheet);
          }
        }),
    [
      canSwipeDismiss,
      detailScrollGesture,
      dismissCommitted,
      handleDismissGestureRelease,
      scrollAtTop,
      surfaceProgress,
      windowDimensions.height,
    ],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  useEffect(() => {
    dismissingRef.current = false;
    leaveRequestedAtRef.current = 0;
    dismissCommitted.value = 0;
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, [dismissCommitted, id]);

  useEffect(() => {
    if (!canSwipeDismiss) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') return;
      cancelAnimation(surfaceProgress);
      dismissingRef.current = false;
      surfaceProgress.value = 1;
    });
    return () => subscription.remove();
  }, [canSwipeDismiss, surfaceProgress]);

  const handleBack = () => {
    if (dismissingRef.current || dismissCommitted.value === 1) {
      finishMapDismiss();
      return;
    }
    if (canSwipeDismiss) {
      startMapDismiss();
      return;
    }
    finishMapDismiss();
  };

  const handlePressSimilarEvent = (item: EventWithCreator) => {
    useEventPreviewStore.getState().prepareEventDetail(item);
    prefetchEventMedia(item, { priority: 'visible' });
    router.push(`/events/${item.id}` as any);
  };

  const handleToggleHeart = async () => {
    if (isGuest) {
      openGuestGate('Aimer cet événement');
      return;
    }
    if (!profile || !event || heartPendingRef.current) return;
    heartPendingRef.current = true;
    setHeartPending(true);

    haptics.light();

    const before = {
      isLiked: isLiked(event.id),
      isFavorite: isFavorite(event.id),
    };

    try {
      const after = await toggleEventHeart(profile.id, event, before);

      setEvent((prev) =>
        prev
          ? {
              ...prev,
              is_liked: after.isLiked,
              is_favorited: after.isFavorite,
              likes_count: likesCountAfterHeartToggle(prev.likes_count, before.isLiked, after.isLiked),
            }
          : null
      );
      setEventStats((prev) => ({
        ...prev,
        likes: likesCountAfterHeartToggle(prev.likes, before.isLiked, after.isLiked),
      }));
      await loadEventStats(event.id);
    } catch (error) {
      await loadEventStats(event.id);
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
    } finally {
      heartPendingRef.current = false;
      setHeartPending(false);
    }
  };

  const handleOpenLikers = () => {
    if (isGuest) {
      openGuestGate('Voir qui a aimé');
      return;
    }
    setLikersSheetVisible(true);
  };

  const handleShare = async () => {
    if (isGuest) {
      openGuestGate('Partager cet événement');
      return;
    }
    if (!event) return;
    try {
      await sharePublishedEvent(event);
    } catch (err) {
      console.warn('share error', err);
    }
  };

  const handleOpenEventReport = () => {
    if (isGuest) {
      openGuestGate('Signaler cet événement');
      return;
    }
    if (!event?.id) return;
    setEventReportVisible(true);
  };

  const handleOpenEventCorrection = () => {
    if (isGuest) {
      openGuestGate('Proposer une correction');
      return;
    }
    if (!event?.id || event.status !== 'published') return;
    setEventCorrectionVisible(true);
  };

  const handleDeleteEvent = () => {
    if (!canDeleteEvent || !event?.id) return;
    Alert.alert(
      'Supprimer cet événement',
      'Cette action est définitive. L’événement disparaîtra de tes listes.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await EventsService.delete(event.id);
                router.replace('/profile/my-events' as any);
              } catch (error) {
                Alert.alert('Erreur', "Impossible de supprimer cet événement pour le moment.");
              }
            })();
          },
        },
      ],
    );
  };

  const handleReportEvent = async (reason: ReportReasonCode) => {
    if (!event?.id) return;
    try {
      await ReportService.event(event.id, { reason });
      setEventReported(true);
      Alert.alert('Signalement envoyé', "Merci, notre équipe de modération va examiner cet événement.");
    } catch (error) {
      Alert.alert('Erreur', "Impossible d'envoyer le signalement pour le moment.");
    } finally {
      setEventReportVisible(false);
    }
  };

  const handleAddPhoto = () => {
    const eligibility = getCommunityPhotoEligibility({
      authenticated: !isGuest,
      checkinEnabled: false,
      isOwner,
      isAdmin,
      hasCheckedIn: false,
    });

    if (eligibility.reason === 'sign_in') {
      openGuestGate('Ajouter une photo');
      return;
    }
    if (eligibility.reason === 'checkin_required') {
      Alert.alert('Check-in requis', 'Vous devez faire un check-in pour ajouter une photo.');
      return;
    }
    setContribModalVisible(true);
  };

  const handleGoToEchoes = () => {
    if (!event) return;
    router.push(`/events/echoes?id=${event.id}` as any);
  };

  const calendarPayload = () => {
    if (!event) return null;
    const locationLabel = [event.address, [event.postal_code, event.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return {
      id: event.id,
      title: event.title || 'Événement',
      description: event.description || '',
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      locationLabel,
    };
  };

  const handleClaimOrganizer = () => {
    setPlatformOrganizerSheetVisible(false);
    void openDiffuseurContact({
      name: profile?.display_name,
      email: profile?.email,
      eventTitle: event?.title,
    }).catch((error) => {
      console.warn('open organizer contact', error);
      Alert.alert('Contact', 'Impossible d’ouvrir le formulaire pour le moment.');
    });
  };

  const handleAddToCalendar = async () => {
    const payload = calendarPayload();
    if (!payload || calendarBusy) return;
    haptics.selection();
    setCalendarBusy(true);
    try {
      const outcome = await presentAddToDeviceCalendar(payload);
      if (outcome === 'saved') {
        Toast.show({ type: 'success', text1: 'C’est noté dans votre agenda' });
      } else if (outcome === 'opened') {
        Toast.show({ type: 'success', text1: 'Votre agenda est ouvert' });
      }
    } catch (error) {
      console.warn('add to calendar', error);
      Alert.alert('Agenda', 'Impossible d’ouvrir votre calendrier pour le moment.');
    } finally {
      setCalendarBusy(false);
    }
  };

  const openExternalUrl = async (value?: string | null) => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Lien invalide', "Impossible d'ouvrir ce lien.");
      return;
    }
    await Linking.openURL(url);
  };

  const openEmail = async (email?: string | null) => {
    const raw = typeof email === 'string' ? email.trim() : '';
    if (!raw) return;
    const url = `mailto:${raw}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Email indisponible', "Aucune application email n'est disponible.");
      return;
    }
    await Linking.openURL(url);
  };

  const openPhone = async (phone?: string | null) => {
    const raw = typeof phone === 'string' ? phone.trim() : '';
    if (!raw) return;
    const url = `tel:${raw}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Téléphone indisponible', "Impossible de lancer l'appel sur cet appareil.");
      return;
    }
    await Linking.openURL(url);
  };

  const cityLabel = useMemo(() => {
    if (!event || typeof event.city !== 'string') return '';
    return event.city.trim();
  }, [event]);

  const placeDrawerLines = useMemo(() => {
    if (!event) return [] as string[];
    return formatPlaceDrawerLines({
      venue: event.venue_name,
      address: event.address,
      postalCode: event.postal_code,
      city: event.city,
    });
  }, [event]);

  const eventCoordinates = useMemo(() => {
    if (!event) return null;
    const coordsArray =
      event.location && typeof event.location === 'object' && 'coordinates' in event.location
        ? event.location.coordinates
        : undefined;

    if (Array.isArray(coordsArray) && coordsArray.length === 2) {
      const lon = Number(coordsArray[0]);
      const lat = Number(coordsArray[1]);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { latitude: lat, longitude: lon };
    }

    if (typeof event.latitude === 'number' && typeof event.longitude === 'number') {
      return { latitude: event.latitude, longitude: event.longitude };
    }

    return null;
  }, [event]);

  const distanceLabel = useMemo(() => {
    if (!currentLocation || !eventCoordinates) return null;
    return getDistanceText(eventCoordinates.latitude, eventCoordinates.longitude, {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    });
  }, [currentLocation, eventCoordinates]);

  const startDateLabel = useMemo(() => {
    if (!event?.starts_at) return '';
    const end = event.ends_at ? new Date(event.ends_at) : null;
    const start = new Date(event.starts_at);
    const spansSeveralDays = Boolean(
      end
      && !Number.isNaN(end.getTime())
      && !Number.isNaN(start.getTime())
      && end.getTime() >= start.getTime()
      && !isSameLocalDay(event.starts_at, event.ends_at),
    );
    if (spansSeveralDays) {
      return formatEventCardRangeLine(event, 'compact', { includeTime: false });
    }
    return formatDateLong(event.starts_at);
  }, [event]);

  const placeSummary = useMemo(
    () => formatCityDistanceLine(cityLabel, distanceLabel),
    [cityLabel, distanceLabel],
  );

  const placeDrawerAvailable = placeDrawerLines.length > 0 || Boolean(eventCoordinates);
  const showPlaceRow = Boolean(placeSummary) || placeDrawerAvailable;

  const peerLikeLabel = useMemo(
    () => formatPeerLikeLabel(peersEngaged.map((peer) => peer.display_name)),
    [peersEngaged],
  );

  const knownPrice = useMemo(() => {
    if (!event) return '';
    const label = getEventPriceLabel({
      price: typeof event.price === 'number' ? event.price : null,
      is_free: event.is_free === true,
    });
    return isMeaningfulPriceLabel(label) ? label : '';
  }, [event]);

  const startDateTimeLabel = useMemo(() => {
    if (!event?.starts_at) return '';
    return `${formatDateLong(event.starts_at)} · ${formatTime(event.starts_at)}`;
  }, [event]);

  const visibleTags = useMemo(
    () => (event ? getVisibleEventTags(event.tags, tagsMap).slice(0, 6) : []),
    [event, tagsMap],
  );

  const endDateTimeLabel = useMemo(() => {
    if (!event?.ends_at) return '';
    const endDate = new Date(event.ends_at);
    if (Number.isNaN(endDate.getTime())) return '';
    return `${formatDateLong(event.ends_at)} · ${formatTime(event.ends_at)}`;
  }, [event]);

  const calendarDetailLines = useMemo(() => {
    if (!event) return [] as Array<{ title: string; value: string }>;
    const lines: Array<{ title: string; value: string }> = [];
    const weekLabels: Record<number, string> = {
      1: 'Lundi',
      2: 'Mardi',
      3: 'Mercredi',
      4: 'Jeudi',
      5: 'Vendredi',
      6: 'Samedi',
      7: 'Dimanche',
    };
    const formatDateOnly = (value: string) =>
      capitalizeFirst(
        new Date(`${value}T12:00:00.000Z`).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
      );
    const toSlotLabel = (slot: any) => {
      const opens = slot?.opens || slot?.start;
      const closes = slot?.closes || slot?.end;
      return opens && closes ? `${opens} - ${closes}` : null;
    };
    const addLine = (title: string, value: string) => lines.push({ title, value });

    const raw = event.operating_hours as any;
    if (Array.isArray(raw) && raw.length > 0) {
      raw.forEach((entry: any) => {
        if (entry?.kind === 'fixed') {
          const openDays = Array.isArray(entry.open_days)
            ? entry.open_days.map((d: number) => weekLabels[d]).filter(Boolean)
            : [];
          if (openDays.length) addLine('Jours d’ouverture', openDays.join(', '));
          const slots = Array.isArray(entry.slots) ? entry.slots.map(toSlotLabel).filter(Boolean) : [];
          slots.forEach((slot: string, index: number) => addLine(`Créneau ${index + 1}`, slot));
          return;
        }

        if (entry?.kind === 'single_day') {
          const dateLabel = entry.date ? formatDateOnly(entry.date) : null;
          const slots = Array.isArray(entry.slots) ? entry.slots.map(toSlotLabel).filter(Boolean) : [];
          if (dateLabel && slots.length) {
            addLine(dateLabel, slots.join(' • '));
            return;
          }
        }

        if (entry?.date) {
          const dateLabel = formatDateOnly(entry.date);
          const slots = Array.isArray(entry.slots) ? entry.slots.map(toSlotLabel).filter(Boolean) : [];
          if (slots.length) addLine(dateLabel, slots.join(' • '));
        }
      });
    } else if (raw && typeof raw === 'object') {
      Object.entries(raw as Record<string, any>)
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .forEach(([date, slotObj]) => {
          const slot = toSlotLabel(slotObj);
          if (slot) addLine(formatDateOnly(date), slot);
        });
    }

    if (!lines.length) {
      addLine('Début', startDateTimeLabel);
      if (endDateTimeLabel && !isSameLocalDay(event.starts_at, event.ends_at)) {
        addLine('Fin', endDateTimeLabel);
      }
    }
    return lines;
  }, [event, startDateTimeLabel, endDateTimeLabel]);

  const handleOpenNavigationOptions = useCallback(() => {
    if (!event) return;
    setNavSheetVisible(true);
  }, [event]);

  const mediaImages = useMemo<MediaImage[]>(() => {
    if (!event) return [];
    const media = (event.media || []).reduce<MediaImage[]>((acc, m, index) => {
        const uri = normalizeImageUrl(m.url);
        if (!uri) return acc;
        acc.push({
          id: m.id || `${uri}-${index}`,
          uri,
          authorId: (m as any).author_id,
          isUserGenerated: false,
        });
        return acc;
      }, []);

    const coverUri = normalizeImageUrl(event.cover_url);
    const cover = coverUri ? [{ id: `cover-${event.id}`, uri: coverUri, isUserGenerated: false }] : [];
    const merged = [...cover, ...media];
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (!item.uri || seen.has(item.uri)) return false;
      seen.add(item.uri);
      return true;
    });
  }, [event]);

  const communityMediaImages = useMemo<MediaImage[]>(() => {
    const seen = new Set<string>();
    return (communityPhotos || []).reduce<MediaImage[]>((acc, photo, index) => {
        const uri = normalizeImageUrl(photo.url);
        if (!uri) return acc;
        acc.push({
          id: photo.id || `community-${index}`,
          uri,
          authorId: photo.author_id,
          isUserGenerated: true,
        });
        return acc;
      }, [])
      .filter((item) => {
        if (!item.uri || seen.has(item.uri)) return false;
        seen.add(item.uri);
        return true;
      });
  }, [communityPhotos]);

  const practicalInfoRows = useMemo(() => {
    if (!event) return [] as Array<{ label: string; value: string; action?: () => void }>;
    const rows: Array<{ label: string; value: string; action?: () => void }> = [];
    if (knownPrice) {
      rows.push({ label: 'Tarif', value: knownPrice });
    }
    if (event.registration_required !== null && event.registration_required !== undefined) {
      rows.push({
        label: 'Inscription',
        value: event.registration_required ? 'Requise' : 'Non requise',
      });
    }
    if (typeof event.max_participants === 'number' && Number.isFinite(event.max_participants)) {
      rows.push({
        label: 'Participants max',
        value: `${event.max_participants}`,
      });
    }
    if (event.external_url) {
      rows.push({
        label: 'Lien externe',
        value: event.external_url,
        action: () => void openExternalUrl(event.external_url),
      });
    }
    if (event.contact_email) {
      rows.push({
        label: 'Email',
        value: event.contact_email,
        action: () => void openEmail(event.contact_email),
      });
    }
    if (event.contact_phone) {
      rows.push({
        label: 'Téléphone',
        value: event.contact_phone,
        action: () => void openPhone(event.contact_phone),
      });
    }
    return rows;
  }, [
    event,
    event?.contact_email,
    event?.contact_phone,
    event?.external_url,
    event?.max_participants,
    event?.registration_required,
    knownPrice,
  ]);

  useEffect(() => {
    if (loading || !event) {
      return;
    }
    if (entryMotionComplete) {
      surfaceProgress.value = 1;
      return;
    }
    if (reduceMotion || !canAnimateSurface) {
      surfaceProgress.value = 1;
      setEntryMotionComplete(true);
      return;
    }
    surfaceProgress.value = withTiming(
      1,
      {
        duration: 280,
        easing: Motion.easing.emphasized,
      },
      (finished) => {
        'worklet';
        if (finished) runOnJS(finishEntryMotion)();
      },
    );
  }, [
    canAnimateSurface,
    entryMotionComplete,
    event,
    finishEntryMotion,
    loading,
    reduceMotion,
    surfaceProgress,
  ]);

  const slideOffset = canAnimateMapSurface
    ? getMapDetailSlideOffset(windowDimensions.height)
    : windowDimensions.height;
  const screenStyle = useAnimatedStyle(() => {
    const progress = surfaceProgress.value;
    if (!canAnimateSurface) {
      return { opacity: progress };
    }

    if (canAnimateListSurface) {
      return {
        transform: [
          {
            translateY: interpolate(
              progress,
              [0, 1],
              [slideOffset, 0],
              Extrapolation.CLAMP,
            ),
          },
        ],
      };
    }

    return {
      opacity: interpolate(
        progress,
        [0, 0.18, 1],
        [0, 1, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: interpolate(
            progress,
            [0, 1],
            [slideOffset, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  }, [canAnimateListSurface, canAnimateSurface, slideOffset]);

  const photoParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, photoHeight],
          [0, -photoHeight * 0.18],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(scrollY.value, [0, photoHeight], [1, 1.05], Extrapolation.CLAMP),
      },
    ],
  }));

  const bannerHeight = insets.top + spacing.sm + 44;
  const drawerMeetsBanner = Math.max(photoPeek - bannerHeight, 1);
  const washEnd = useSharedValue(drawerMeetsBanner);
  useEffect(() => {
    washEnd.value = drawerMeetsBanner;
  }, [drawerMeetsBanner, washEnd]);
  const addPhotoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [40, 64], [1, 0], Extrapolation.CLAMP),
  }));
  const topBannerStyle = useAnimatedStyle(() => {
    const end = Math.max(washEnd.value, 1);
    return {
      opacity: interpolate(scrollY.value, [end - 1, end], [0, 1], Extrapolation.CLAMP),
    };
  });
  const photoWashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, Math.max(washEnd.value, 1)], [0, 1], Extrapolation.CLAMP),
  }));

  if (loading && !event) {
    return (
      <View style={{ flex: 1 }}>
        <AppBackground />
        <EventDetailSkeleton />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <AppBackground />
        <Text style={styles.errorTitle}>Événement introuvable</Text>
        <Button title="Retour" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
      </View>
    );
  }

  return (
    <>
      <Animated.View style={[styles.dismissableScreen, screenStyle]}>
        <GestureDetector gesture={mapDismissGesture}>
          <View style={styles.dismissGestureSurface}>
          <View
            style={[
              styles.detailSurfaceContent,
              {
                width: windowDimensions.width,
                height: windowDimensions.height,
              },
            ]}
          >
          <View pointerEvents="box-none" style={[styles.photoLayer, { height: photoHeight }]}>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, photoParallaxStyle]}>
              <PlaceMediaGallery
                ref={galleryRef}
                images={mediaImages}
                communityImages={communityMediaImages}
                heroHeight={photoHeight}
              />
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.photoWash, photoWashStyle]} />
          </View>
          <StatusBar barStyle={sheetCoversPhoto || photoWashed ? 'dark-content' : 'light-content'} />
          <GestureDetector gesture={detailScrollGesture}>
            <ScrollView
              style={styles.container}
              contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              bounces={!canSwipeDismiss}
              onScroll={(scrollEvent) => {
                const y = scrollEvent.nativeEvent.contentOffset.y;
                scrollOffsetRef.current = y;
                nearbySectionRef.current?.onScroll(y);
                scrollY.value = y;
                const nextAtTop = y <= 1;
                setScrollAtTop((current) => (current === nextAtTop ? current : nextAtTop));
                const covered = y >= drawerMeetsBanner;
                setSheetCoversPhoto((current) => (current === covered ? current : covered));
                const washed = y >= drawerMeetsBanner * 0.45;
                setPhotoWashed((current) => (current === washed ? current : washed));
                const addGone = y >= 48;
                setAddPhotoGone((current) => (current === addGone ? current : addGone));
              }}
            >
        <Pressable
          onPress={() => galleryRef.current?.openHero()}
          style={{ height: photoPeek }}
          accessibilityRole="imagebutton"
          accessibilityLabel="Voir les photos de l’événement"
        />
        <View style={styles.drawer}>
          <View style={styles.drawerHandle} />
          <View style={styles.content}>
          <MotionReveal delay={Motion.stagger.content} enabled={!seededEvent}>
          {getCategoryLabel(event.category || '', event.category_meta).trim() || __DEV__ ? (
          <View style={styles.introHead}>
            {getCategoryLabel(event.category || '', event.category_meta).trim() ? (
              <Text style={styles.categoryLabel} numberOfLines={1}>
                {getCategoryLabel(event.category || '', event.category_meta)}
              </Text>
            ) : (
              <View style={styles.metaRowSpacer} />
            )}
            {__DEV__ ? (
              <TouchableOpacity
                style={styles.debugIdButton}
                onPress={handleShowDebugEventId}
                accessibilityRole="button"
                accessibilityLabel="Afficher l'identifiant de l'événement"
              >
                <Text style={styles.debugIdText}>?</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          ) : null}
          <Text style={[styles.title, { fontSize: titleFontSize, lineHeight: titleLineHeight }]}>
            {event.title}
          </Text>
          {visibleTags.length ? (
            <View style={styles.tagRow}>
              {visibleTags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{formatResolvedEventTagLabel(tag, tagsMap)}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {startDateLabel ? (
            <TouchableOpacity
              style={[styles.factPress, stackActions && styles.factPressStacked]}
              onPress={() => setCalendarExpanded((prev) => !prev)}
              accessibilityRole="button"
              accessibilityState={{ expanded: calendarExpanded }}
              accessibilityLabel={
                calendarExpanded ? 'Masquer le détail des horaires' : 'Afficher le détail des horaires'
              }
            >
              <View style={styles.factCopy}>
                <Text style={styles.introDate}>{startDateLabel}</Text>
              </View>
              <View style={[styles.disclosure, stackActions && styles.disclosureStacked]}>
                <Text style={styles.disclosureText}>Détail des horaires</Text>
                <ChevronDown
                  size={16}
                  color={colors.brand.secondary}
                  style={{ transform: [{ rotate: calendarExpanded ? '180deg' : '0deg' }] }}
                />
              </View>
            </TouchableOpacity>
          ) : null}
          {calendarExpanded && startDateLabel ? (
            <View style={styles.calendarExpandedWrap}>
              {calendarDetailLines.map((line, index) => (
                <View key={`${line.title}-${line.value}-${index}`} style={styles.calendarExpandedRow}>
                  <Text style={styles.calendarExpandedTitle}>{line.title}</Text>
                  <Text style={styles.calendarExpandedValue}>{line.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {showPlaceRow ? (
            <TouchableOpacity
              style={[styles.factPress, stackActions && styles.factPressStacked]}
              disabled={!placeDrawerAvailable}
              activeOpacity={placeDrawerAvailable ? 0.7 : 1}
              onPress={() => setLocationExpanded((prev) => !prev)}
              accessibilityRole={placeDrawerAvailable ? 'button' : 'text'}
              accessibilityState={placeDrawerAvailable ? { expanded: locationExpanded } : undefined}
              accessibilityLabel={
                placeDrawerAvailable
                  ? locationExpanded
                    ? 'Masquer les informations du lieu'
                    : 'Afficher les informations du lieu'
                  : placeSummary
              }
            >
              <View style={styles.factCopy}>
                {placeSummary ? <Text style={styles.introPlace}>{placeSummary}</Text> : null}
              </View>
              {placeDrawerAvailable ? (
                <View style={[styles.disclosure, stackActions && styles.disclosureStacked]}>
                  <Text style={styles.disclosureText}>Plus d’info</Text>
                  <ChevronDown
                    size={16}
                    color={colors.brand.secondary}
                    style={{ transform: [{ rotate: locationExpanded ? '180deg' : '0deg' }] }}
                  />
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}
          {locationExpanded && placeDrawerAvailable ? (
            <View style={styles.locationExpandedWrap}>
              {placeDrawerLines.map((line) => (
                <Text key={line} style={styles.placeDetail}>{line}</Text>
              ))}
              {eventCoordinates ? (
                <EventDetailLocationMap
                  latitude={eventCoordinates.latitude}
                  longitude={eventCoordinates.longitude}
                />
              ) : null}
            </View>
          ) : null}
          {canEditEvent || canDeleteEvent ? (
          <View style={styles.socialRow}>
            {canEditEvent ? (
              <TouchableOpacity
                onPress={() => router.push(`/events/create?edit=${event.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel="Modifier l’événement"
                style={styles.iconAction}
                hitSlop={8}
              >
                <Edit size={18} color={colors.brand.secondary} />
              </TouchableOpacity>
            ) : null}
            {canDeleteEvent ? (
              <TouchableOpacity
                onPress={handleDeleteEvent}
                accessibilityRole="button"
                accessibilityLabel="Supprimer l’événement"
                style={styles.iconAction}
                hitSlop={8}
              >
                <Trash2 size={18} color={colors.error[500]} />
              </TouchableOpacity>
            ) : null}
          </View>
          ) : null}
          {features.socialPeers && peerLikeLabel ? (
            <View style={styles.peersBlock}>
              <View style={styles.peerAvatars}>
                {peersEngaged.slice(0, 3).map((peer, index) => (
                  <TouchableOpacity
                    key={peer.id}
                    style={[styles.peerAvatar, index > 0 && styles.peerAvatarOverlap]}
                    onPress={() => {
                      if (isGuest) {
                        openGuestGate('Voir un profil');
                        return;
                      }
                      router.push(`/community/${peer.id}` as any);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Profil de ${peer.display_name}`}
                  >
                    <UserAvatar uri={peer.avatar_url} name={peer.display_name} size={26} />
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                onPress={handleOpenLikers}
                accessibilityRole="button"
                accessibilityLabel={`${peerLikeLabel}. Voir qui a aimé`}
                style={styles.peerLabelButton}
              >
                <Text style={styles.peersTitle}>{peerLikeLabel}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          </MotionReveal>

          {event.description ? (
            <MotionReveal delay={Motion.stagger.content * 1.5} enabled={!seededEvent}>
              <View style={styles.descriptionBlock}>
                {!descriptionCanExpand && !descriptionExpanded ? (
                  <Text
                    style={[styles.description, styles.descriptionMeasure]}
                    onTextLayout={(e) => {
                      if (e.nativeEvent.lines.length > DESCRIPTION_PREVIEW_LINES) {
                        setDescriptionCanExpand(true);
                      }
                    }}
                  >
                    {event.description}
                  </Text>
                ) : null}
                <Text
                  style={styles.description}
                  numberOfLines={descriptionExpanded ? undefined : DESCRIPTION_PREVIEW_LINES}
                >
                  {event.description}
                </Text>
                {descriptionCanExpand || descriptionExpanded ? (
                  <TouchableOpacity
                    onPress={() => setDescriptionExpanded((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={descriptionExpanded ? 'Réduire la description' : 'Lire la suite de la description'}
                    hitSlop={8}
                    style={styles.descriptionToggle}
                  >
                    <Text style={styles.descriptionToggleText}>
                      {descriptionExpanded ? 'Voir moins' : 'Lire la suite'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </MotionReveal>
          ) : null}

          <View style={styles.actionRow}>
            <PushButton
              icon="calendar"
              iconSize={18}
              tone="secondary"
              label={calendarBusy ? 'Ouverture…' : EVENT_CALENDAR_LABEL}
              disabled={calendarBusy}
              onPress={() => void handleAddToCalendar()}
              accessibilityLabel={EVENT_CALENDAR_LABEL}
              style={[styles.actionButton, stackActions && styles.actionButtonStacked]}
            />
            <PushButton
              icon="navigation"
              iconSize={18}
              label="Itinéraire"
              onPress={handleOpenNavigationOptions}
              accessibilityLabel="Ouvrir l’itinéraire"
              style={[styles.actionButton, stackActions && styles.actionButtonStacked]}
            />
          </View>

          {practicalInfoRows.length > 0 ? (
            <MotionReveal delay={Motion.stagger.content * 3.5} enabled={!seededEvent}>
              <EventDetailSection title="Infos pratiques">
                <View style={styles.practicalRows}>
                  {practicalInfoRows.map((row) =>
                    row.action ? (
                      <TouchableOpacity key={`${row.label}-${row.value}`} style={styles.practicalRow} onPress={row.action} activeOpacity={0.8}>
                        <Text style={styles.practicalLabel}>{row.label}</Text>
                        <Text numberOfLines={1} style={[styles.practicalValue, styles.practicalValueLink]}>
                          {row.value}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View key={`${row.label}-${row.value}`} style={styles.practicalRow}>
                        <Text style={styles.practicalLabel}>{row.label}</Text>
                        <Text numberOfLines={1} style={styles.practicalValue}>
                          {row.value}
                        </Text>
                      </View>
                    ),
                  )}
                </View>
              </EventDetailSection>
            </MotionReveal>
          ) : null}

          {event && eventCoordinates ? (
            <View style={styles.weatherBlock}>
              <EventWeatherSection
                embedded
                latitude={eventCoordinates.latitude}
                longitude={eventCoordinates.longitude}
                startsAt={event.starts_at}
                endsAt={event.ends_at}
                placeName={typeof event.city === 'string' ? event.city.trim() : ''}
              />
            </View>
          ) : null}

          <EventNearbySection
            ref={nearbySectionRef}
            enabled={features.nearbyPlaces && event.status === 'published'}
            eventId={event.id}
            latitude={eventCoordinates?.latitude ?? null}
            longitude={eventCoordinates?.longitude ?? null}
            viewportHeight={windowDimensions.height}
            getScrollOffset={() => scrollOffsetRef.current}
          />

          <EventEchoesPreview comments={comments} onOpenAll={handleGoToEchoes} />

          {loadingCommunityPhotos ? <ActivityIndicator color={colors.brand.secondary} style={{ marginTop: spacing.md }} /> : null}

          {eventStats.views > 0 || (eventStats.likes > 0 && peersEngaged.length === 0) ? (
            <Text style={styles.quietLine}>
              {eventStats.views > 0
                ? `${eventStats.views > 999 ? `${(eventStats.views / 1000).toFixed(1)}k` : eventStats.views} ${eventStats.views > 1 ? 'vues' : 'vue'}`
                : ''}
              {eventStats.views > 0 && eventStats.likes > 0 && peersEngaged.length === 0 ? ' · ' : ''}
              {eventStats.likes > 0 && peersEngaged.length === 0 ? (
                <Text
                  style={styles.quietLink}
                  onPress={handleOpenLikers}
                  accessibilityRole="button"
                  accessibilityLabel={
                    eventStats.likes === 1
                      ? '1 personne a aimé. Voir qui'
                      : `${eventStats.likes} personnes ont aimé. Voir qui`
                  }
                >
                  {eventStats.likes === 1 ? '1 personne a aimé' : `${eventStats.likes} personnes ont aimé`}
                </Text>
              ) : null}
            </Text>
          ) : null}

          <EventDetailSection title={isPlatformOrganizer ? 'Provenance' : 'Organisateur'} style={styles.provenanceSection}>
            {isPlatformOrganizer ? (
              <TouchableOpacity
                style={styles.creatorMain}
                onPress={() => setPlatformOrganizerSheetVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${organizerMeta ? `${organizerMeta}. ` : ''}Fiche portée par ${organizerName}. En savoir plus.`}
              >
                <Image source={MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL} style={styles.creatorCardAvatar} />
                <View style={styles.creatorCardInfo}>
                  {organizerMeta ? <Text style={styles.creatorCardName}>{organizerMeta}</Text> : null}
                  <Text style={organizerMeta ? styles.creatorCardMeta : styles.creatorCardName}>{organizerName}</Text>
                </View>
                <ChevronRight size={18} color={colors.brand.textSecondary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.creatorMain}>
                {organizerUsesCreatorAvatar && event.creator?.avatar_url ? (
                  <UserAvatar uri={event.creator.avatar_url} name={organizerName} size={46} />
                ) : (
                  <Image source={MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL} style={styles.creatorCardAvatar} />
                )}
                <View style={styles.creatorCardInfo}>
                  <Text style={styles.creatorCardName}>{organizerName}</Text>
                </View>
              </View>
            )}
          </EventDetailSection>

          <AdCard slotId={`detail-${event.id}`} />

          <EventMiniatureCarousel
            title="Vous aimerez peut-être"
            events={similarEvents}
            loading={similarLoading}
            onPressEvent={handlePressSimilarEvent}
          />
        </View>
        </View>
            </ScrollView>
          </GestureDetector>
          <Animated.View
            pointerEvents="none"
            style={[styles.topBanner, { height: bannerHeight }, topBannerStyle]}
          />
        </View>
        </View>
        </GestureDetector>
          <View pointerEvents="box-none" style={styles.photoChrome}>
          <View pointerEvents="box-none" style={[styles.chrome, { paddingTop: insets.top + spacing.sm }]}>
            <View style={styles.chromeLeft} pointerEvents="box-none">
              <FloatingPressable
                style={styles.iconButton}
                onPress={handleBack}
                entranceDelay={0}
                accessibilityLabel="Fermer"
              >
                <BrandIcon name="close" size={18} />
              </FloatingPressable>
              {mediaImages.length > 1 ? (
                <View style={styles.photoCount} pointerEvents="none">
                  <Text style={styles.photoCountText}>{mediaImages.length} photos</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View pointerEvents="box-none" style={[styles.heroActions, { top: insets.top + spacing.sm }]}>
            <EventHeartButton
              appearance="overlay"
              active={isEventHearted}
              onPress={handleToggleHeart}
              hapticsEnabled={false}
              disabled={heartPending}
              count={eventStats.likes}
              compactCount
              washScroll={scrollY}
              washEnd={washEnd}
              accessibilityLabel={`${isEventHearted ? 'Ne plus aimer' : 'Aimer'} ${event.title}, ${eventStats.likes} j’aime`}
            />
            <PhotoGlyphButton
              name="share"
              label={`Partager ${event.title}`}
              onPress={() => void handleShare()}
              washScroll={scrollY}
              washEnd={washEnd}
            />
            {event.status === 'published' ? (
              <PhotoGlyphButton
                name="pen"
                label="Proposer une correction"
                onPress={handleOpenEventCorrection}
                washScroll={scrollY}
                washEnd={washEnd}
              />
            ) : null}
            <PhotoGlyphButton
              name="flag"
              label={eventReported ? 'Déjà signalé' : 'Signaler cet événement'}
              onPress={handleOpenEventReport}
              color={eventReported ? colors.error[500] : undefined}
              fillColor={eventReported ? colors.error[500] : 'transparent'}
              washScroll={scrollY}
              washEnd={washEnd}
            />
          </View>
          <View pointerEvents={addPhotoGone ? 'none' : 'box-none'} style={[styles.heroAddPhoto, { top: photoPeek - 56 }]}>
            <Animated.View style={addPhotoStyle} pointerEvents="box-none">
              <PhotoGlyphButton
                name="plus"
                label="Ajouter une photo"
                onPress={handleAddPhoto}
              />
            </Animated.View>
          </View>
          </View>
        </Animated.View>

      <NavigationOptionsSheet
        visible={navSheetVisible}
        event={event}
        onClose={() => setNavSheetVisible(false)}
        onOpenInAppMap={() => {
          setNavSheetVisible(false);
          router.push(`/(tabs)/map?focus=${event.id}` as any);
        }}
      />

      <EventPlatformOrganizerSheet
        visible={platformOrganizerSheetVisible}
        variant={isCommunitySuggestedEvent(event?.submission_source) ? 'community_suggest' : 'agenda'}
        showClaimCta={isPlatformOrganizer}
        onClose={() => setPlatformOrganizerSheetVisible(false)}
        onClaim={handleClaimOrganizer}
      />

      <GuestGateModal
        visible={guestGate.visible}
        title={guestGate.title}
        onClose={closeGuestGate}
        onSignUp={() => {
          closeGuestGate();
          router.push('/auth/register' as any);
        }}
        onSignIn={() => {
          closeGuestGate();
          router.push('/auth/login' as any);
        }}
      />

      <EventLikersSheet
        visible={likersSheetVisible}
        eventId={event?.id ?? null}
        onClose={() => setLikersSheetVisible(false)}
        onPressProfile={(userId) => {
          setLikersSheetVisible(false);
          if (!features.socialPeers) return;
          router.push(`/community/${userId}` as any);
        }}
      />

      {event && profile?.id ? (
        <EventPhotoContributionModal
          visible={contribModalVisible}
          eventId={event.id}
          userId={profile.id}
          eventTitle={event.title}
          onClose={() => setContribModalVisible(false)}
          onSubmitted={() => loadCommunityPhotos(event.id)}
        />
      ) : null}

      <ReportReasonModal
        visible={eventReportVisible}
        onClose={() => setEventReportVisible(false)}
        onSelect={handleReportEvent}
      />

      {event ? (
        <EventCorrectionSheet
          visible={eventCorrectionVisible}
          event={event}
          onClose={() => setEventCorrectionVisible(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  dismissableScreen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.brand.page,
  },
  dismissGestureSurface: {
    flex: 1,
  },
  detailSurfaceContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: colors.brand.page,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    backgroundColor: colors.brand.page,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorTitle: {
    ...typography.h4,
    color: colors.brand.text,
    textAlign: 'center',
  },
  photoLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
  photoWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brand.page,
  },
  photoChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 21,
  },
  topBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: colors.brand.page,
  },
  topBannerRow: {
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chromeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroActions: {
    position: 'absolute',
    right: spacing.sm,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAddPhoto: {
    position: 'absolute',
    right: spacing.sm,
    zIndex: 20,
  },
  photoGlyph: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoGlyphShadow: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  photoGlyphLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    ...screenHeaderStyles.iconButton,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(244, 251, 246, 0.92)',
    borderColor: colors.neutral[200],
  },
  photoCount: {
    borderRadius: 12,
    backgroundColor: 'rgba(26, 51, 41, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  photoCountText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.brand.page,
  },
  drawer: {
    backgroundColor: colors.brand.page,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: '100%',
    overflow: 'hidden',
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 8,
    backgroundColor: '#B7CFBE',
    alignSelf: 'center',
    marginTop: 10,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 6,
  },
  metaRowSpacer: {
    flex: 1,
    minWidth: 0,
  },
  eventKicker: {
    ...typography.caption,
    flex: 1,
    minWidth: 0,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.brand.textSecondary,
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.brand.text,
    marginBottom: 6,
  },
  introHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 6,
    minHeight: 18,
  },
  categoryLabel: {
    ...typography.caption,
    flex: 1,
    color: colors.brand.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  introDate: {
    ...typography.bodyBold,
    color: colors.brand.text,
  },
  introEnd: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  introPlace: {
    ...typography.body,
    color: colors.brand.text,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brand.line,
  },
  tagChipText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.brand.page,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  debugIdButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  debugIdText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  infoRowNoMargin: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoContent: {
    marginLeft: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  infoValue: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  infoDatePrimary: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 20,
  },
  infoDateSecondary: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  calendarCta: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
  calendarExpandedWrap: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(26, 51, 41, 0.12)',
    gap: spacing.xs,
  },
  calendarExpandedRow: {
    gap: 2,
  },
  calendarExpandedTitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  calendarExpandedValue: {
    ...typography.bodySmall,
    color: colors.brand.text,
    lineHeight: 18,
  },
  locationExpandedWrap: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[200],
  },
  locationMapBox: {
    height: 150,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  locationMapFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  locationMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand.secondary,
    borderWidth: 3,
    borderColor: colors.brand.ink,
  },
  description: {
    ...typography.body,
    color: colors.brand.text,
    lineHeight: 26,
  },
  descriptionMeasure: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    right: 0,
    zIndex: -1,
  },
  descriptionToggle: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  descriptionToggleText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  descriptionBlock: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brand.line,
  },
  factPress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.sm,
    marginTop: 2,
    minHeight: 44,
  },
  factPressStacked: {
    flexWrap: 'wrap',
  },
  factCopy: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 140,
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    flexShrink: 0,
  },
  placeDetail: {
    ...typography.bodySmall,
    color: colors.brand.text,
    marginBottom: spacing.xs,
  },
  disclosureStacked: {
    flexBasis: '100%',
  },
  disclosureText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
    flexShrink: 1,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: 150,
  },
  actionButtonStacked: {
    flexBasis: '100%',
  },
  weatherBlock: {
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brand.line,
  },
  provenanceSection: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  practicalTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  practicalRows: {
    gap: spacing.sm,
  },
  practicalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  practicalLabel: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  practicalValue: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  practicalValueLink: {
    color: colors.brand.secondary,
  },
  prepareFollow: {
    marginTop: spacing.lg,
  },
  quietLine: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginBottom: spacing.md,
  },
  quietLink: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  creatorMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  creatorCardAvatar: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.full,
  },
  creatorCardAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  creatorCardInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  creatorCardName: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  creatorCardMeta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: spacing.xs,
  },
  peersBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  peersTitle: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  peerAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  peerAvatar: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.brand.page,
  },
  peerAvatarOverlap: {
    marginLeft: -8,
  },
  peerLabelButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  peersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  peerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '48%',
    paddingRight: spacing.sm,
    paddingVertical: 4,
    paddingLeft: 4,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  peerAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 181, 24, 0.2)',
  },
  peerAvatarInitial: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  peerName: {
    ...typography.caption,
    color: colors.brand.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  followButton: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.brand.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(124, 181, 24,0.1)',
  },
  followButtonText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
});
