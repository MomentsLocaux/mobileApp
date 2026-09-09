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
  Dimensions,
  Linking,
  Share,
  Platform,
  StatusBar,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Heart,
  MapPin,
  Calendar,
  Share2,
  Flag,
  Edit,
  ChevronLeft,
  ChevronRight,
  Star,
  Eye,
  PenLine,
  Trash2,
} from 'lucide-react-native';
import {
  Button,
  Card,
  AppBackground,
  screenHeaderStyles,
  MotionReveal,
  FloatingPressable,
  EventDetailSkeleton,
} from '../../components/ui';
import { features } from '@/config/features';
import { getEventAppLink, getEventShareMessage } from '@/utils/event-share';
import {
  EVENT_CALENDAR_LABEL,
  presentAddToDeviceCalendar,
} from '@/utils/event-calendar';
import {
  MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL,
  MOMENTS_LOCAUX_ORGANIZER_AVATAR_URL,
  MOMENTS_LOCAUX_ORGANIZER_NAME,
  isMomentsLocauxOrganizerFallback,
} from '@/constants/branding';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Motion, createEnterTiming } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/utils/haptics';
import { EventsService } from '../../services/events.service';
import { useAuth } from '../../hooks';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import {
  getCategoryColor,
  getCategoryLabel,
  getCategoryTextColor,
} from '../../constants/categories';
import { formatEventTagLabel } from '../../constants/discovery-tags';
import { getVisibleEventTags } from '../../utils/event-card-display';
import type { EventMediaSubmission, EventWithCreator } from '../../types/database';
import { useComments } from '@/hooks/useComments';
import { useLocationStore } from '@/store';
import { PlaceMediaGallery, type MediaImage } from '@/components/events/PlaceMediaGallery';
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
import { EVENT_ITINERARY_LABEL } from '@/utils/event-navigation';
import { syncHeartStores, toggleEventHeart } from '@/utils/event-heart';
import { likesCountAfterHeartToggle } from '@/utils/likes-count';
import { getCommunityPhotoEligibility } from '@/utils/community-photo-eligibility';
import { getDistanceText } from '@/utils/sort-events';
import MapboxGL from '@rnmapbox/maps';

const { width } = Dimensions.get('window');
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

const normalizeImageUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'none') return null;
  return trimmed;
};

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile, session, isLoading: authLoading } = useAuth();
  const { currentLocation } = useLocationStore();
  const insets = useSafeAreaInsets();
  const { comments } = useComments(id || '');
  const { toggleFavorite: toggleFavoriteStore, isFavorite } = useFavoritesStore();
  const { toggleLike: toggleLikeStore, isLiked } = useLikesStore();

  const [event, setEvent] = useState<EventWithCreator | null>(null);
  const [loading, setLoading] = useState(true);
  const reduceMotion = useReduceMotion();
  const screenProgress = useSharedValue(0);
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
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [locationExpanded, setLocationExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionCanExpand, setDescriptionCanExpand] = useState(false);
  const [eventReportVisible, setEventReportVisible] = useState(false);
  const [eventReported, setEventReported] = useState(false);
  const [eventCorrectionVisible, setEventCorrectionVisible] = useState(false);

  const isGuest = !session;
  const isOwner = !!profile?.id && profile.id === event?.creator_id;
  const isPlatformOrganizer = isMomentsLocauxOrganizerFallback(event?.creator);
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

  const heartScale = useSharedValue(1);
  const wasHeartedRef = useRef(isEventHearted);
  useEffect(() => {
    if (isEventHearted && !wasHeartedRef.current) {
      heartScale.value = withSequence(
        withSpring(1.3, Motion.spring.snappy),
        withSpring(1, Motion.spring.soft)
      );
    }
    wasHeartedRef.current = isEventHearted;
  }, [isEventHearted, heartScale]);
  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

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
    try {
      const data = await EventsService.getEventById(id);
      const enriched = data ? { ...data, is_favorited: isFavorite(data.id), is_liked: isLiked(data.id) } : null;
      setEvent(enriched);
      setDescriptionExpanded(false);
      setDescriptionCanExpand(false);
      if (enriched) {
        await Promise.all([
          loadEventStats(enriched.id),
          loadCommunityPhotos(enriched.id),
        ]);
      }
    } catch (error) {
      console.warn('loadEventDetails error', error);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id, isFavorite, isLiked, loadCommunityPhotos, loadEventStats]);

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
  }, [event?.id, profile?.id, isGuest, isLiked, isFavorite]);

  const handleBack = () => {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace('/(tabs)/map');
    }
  };

  const handleToggleHeart = async () => {
    if (isGuest) {
      openGuestGate('Aimer cet événement');
      return;
    }
    if (!profile || !event) return;

    haptics.light();

    const before = {
      isLiked: isLiked(event.id),
      isFavorite: isFavorite(event.id),
    };

    try {
      const after = await toggleEventHeart(profile.id, event, before);
      syncHeartStores(event, before, after, {
        toggleLike: toggleLikeStore,
        toggleFavorite: toggleFavoriteStore,
      });
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
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
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
      const message = getEventShareMessage(event.title, event.id, event.external_url);
      if (Platform.OS === 'ios') {
        await Share.share({ message, url: getEventAppLink(event.id) });
      } else {
        await Share.share({ message });
      }
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

  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const capitalizeFirst = (value: string) => {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const formatPrice = (price?: number | null) => {
    if (typeof price !== 'number' || Number.isNaN(price) || price <= 0) return 'Gratuit';
    return `${price.toFixed(2)}€`;
  };

  const hasTicketPrice = useMemo(
    () => typeof event?.price === 'number' && !Number.isNaN(event.price) && event.price > 0,
    [event?.price],
  );

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

  const locationLabel = useMemo(() => {
    if (!event) return 'Lieu à venir';
    const venueName = typeof event.venue_name === 'string' ? event.venue_name.trim() : '';
    const city = typeof event.city === 'string' ? event.city.trim() : '';
    const address = typeof event.address === 'string' ? event.address.trim() : '';
    return venueName || city || address || 'Lieu à venir';
  }, [event]);

  const locationSubLabel = useMemo(() => {
    if (!event) return 'Lieu de l’événement';
    const postalCode = typeof event.postal_code === 'string' ? event.postal_code.trim() : '';
    const city = typeof event.city === 'string' ? event.city.trim() : '';
    const address = typeof event.address === 'string' ? event.address.trim() : '';
    const cityLine = [postalCode, city].filter(Boolean).join(' ');
    return cityLine || address || 'Lieu de l’événement';
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

  const startDateTimeLabel = useMemo(() => {
    if (!event) return '';
    const day = capitalizeFirst(
      new Date(event.starts_at).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    );
    return `${day} - ${formatTime(event.starts_at)}`;
  }, [event]);

  const visibleTags = useMemo(
    () => (event ? getVisibleEventTags(event.tags).slice(0, 6) : []),
    [event],
  );

  const endDateTimeLabel = useMemo(() => {
    if (!event?.ends_at) return 'Se termine selon les informations de l’organisateur.';
    const endDate = new Date(event.ends_at);
    if (Number.isNaN(endDate.getTime())) return 'Se termine selon les informations de l’organisateur.';
    const day = capitalizeFirst(
      endDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    );
    return `Se termine à ${formatTime(event.ends_at)} le ${day}.`;
  }, [event?.ends_at]);

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
      addLine('Fin', endDateTimeLabel);
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

  const { ratingAvg, ratingCount } = useMemo(() => {
    const commentRatings = comments
      .map((comment) => comment.rating)
      .filter((rating): rating is number => typeof rating === 'number' && !Number.isNaN(rating));
    const derivedCount = commentRatings.length;
    const derivedAvg = derivedCount > 0
      ? Math.round((commentRatings.reduce((sum, rating) => sum + rating, 0) / derivedCount) * 100) / 100
      : 0;
    const dbCount = Number(event?.rating_count || 0);
    const dbAvg = Number(event?.rating_avg || 0);
    const effectiveCount = Math.max(derivedCount, dbCount);
    const effectiveAvg = derivedCount > 0 && derivedCount >= dbCount ? derivedAvg : dbAvg;

    return {
      ratingAvg: Number.isFinite(effectiveAvg) ? effectiveAvg : 0,
      ratingCount: Number.isFinite(effectiveCount) ? effectiveCount : 0,
    };
  }, [comments, event]);

  const practicalInfoRows = useMemo(() => {
    if (!event) return [] as Array<{ label: string; value: string; action?: () => void }>;
    const rows: Array<{ label: string; value: string; action?: () => void }> = [];
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
  ]);

  useEffect(() => {
    if (loading || !event) {
      screenProgress.value = 0;
      return;
    }
    screenProgress.value = reduceMotion
      ? 1
      : withTiming(1, createEnterTiming(Motion.duration.normal));
  }, [event, loading, reduceMotion, screenProgress]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenProgress.value,
  }));

  if (loading) {
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
      <Animated.View style={[{ flex: 1 }, screenStyle]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <AppBackground />
        <StatusBar barStyle="light-content" />

        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <FloatingPressable style={styles.iconButton} onPress={handleBack} entranceDelay={0}>
            <ChevronLeft size={22} color={colors.brand.text} />
          </FloatingPressable>
          <View style={styles.headerActions}>
            <FloatingPressable style={styles.iconButton} onPress={handleShare} entranceDelay={40}>
              <Share2 size={20} color={colors.brand.text} />
            </FloatingPressable>
            {event.status === 'published' ? (
              <FloatingPressable
                style={styles.iconButton}
                onPress={handleOpenEventCorrection}
                entranceDelay={80}
                accessibilityLabel="Proposer une correction"
              >
                <PenLine size={20} color={colors.brand.text} />
              </FloatingPressable>
            ) : null}
            <FloatingPressable style={styles.iconButton} onPress={handleOpenEventReport} entranceDelay={100}>
              <Flag
                size={20}
                color={eventReported ? colors.error[500] : colors.brand.text}
                fill={eventReported ? colors.error[500] : 'transparent'}
              />
            </FloatingPressable>
            {canEditEvent ? (
              <FloatingPressable
                style={styles.iconButton}
                onPress={() => router.push(`/events/create?edit=${event.id}` as any)}
                entranceDelay={120}
              >
                <Edit size={20} color={colors.brand.secondary} />
              </FloatingPressable>
            ) : null}
            {canDeleteEvent ? (
              <FloatingPressable
                style={styles.iconButton}
                onPress={handleDeleteEvent}
                entranceDelay={140}
                accessibilityLabel="Supprimer l’événement"
              >
                <Trash2 size={20} color={colors.error[500]} />
              </FloatingPressable>
            ) : null}
            <FloatingPressable style={styles.iconButton} onPress={handleToggleHeart} entranceDelay={160}>
              <Animated.View style={heartAnimatedStyle}>
                <Heart
                  size={20}
                  color={isEventHearted ? colors.brand.secondary : colors.brand.text}
                  fill={isEventHearted ? colors.brand.secondary : 'transparent'}
                />
              </Animated.View>
            </FloatingPressable>
          </View>
        </View>

        <MotionReveal delay={0}>
        <View style={styles.heroContainer}>
          <PlaceMediaGallery images={mediaImages} communityImages={communityMediaImages} onAddPhoto={handleAddPhoto}>
            <View style={styles.heroBadges}>
              <View
                style={[
                  styles.heroBadge,
                  { backgroundColor: getCategoryColor(event.category || '') },
                ]}
              >
                <Text
                  style={[
                    styles.heroBadgeText,
                    { color: getCategoryTextColor(event.category || '') },
                  ]}
                >
                  {getCategoryLabel(event.category || '')}
                </Text>
              </View>
              {visibleTags.map((tag) => (
                <View key={tag} style={styles.heroTagBadge}>
                  <Text style={styles.heroTagText}>{formatEventTagLabel(tag)}</Text>
                </View>
              ))}
            </View>
          </PlaceMediaGallery>
        </View>
        </MotionReveal>

        <View style={styles.content}>
          <MotionReveal delay={Motion.stagger.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{event.title}</Text>
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
          </MotionReveal>

          {event.description ? (
            <MotionReveal delay={Motion.stagger.content * 1.5}>
              <Card padding="md" style={styles.descriptionCard}>
                {/* Hidden full text to measure whether truncation is needed */}
                {!descriptionCanExpand && !descriptionExpanded ? (
                  <Text
                    style={[styles.description, styles.descriptionMeasure]}
                    onTextLayout={(e) => {
                      if (e.nativeEvent.lines.length > 3) {
                        setDescriptionCanExpand(true);
                      }
                    }}
                  >
                    {event.description}
                  </Text>
                ) : null}
                <Text style={styles.description} numberOfLines={descriptionExpanded ? undefined : 3}>
                  {event.description}
                </Text>
                {descriptionCanExpand || descriptionExpanded ? (
                  <TouchableOpacity
                    onPress={() => setDescriptionExpanded((prev) => !prev)}
                    accessibilityRole="button"
                    hitSlop={8}
                    style={styles.descriptionToggle}
                  >
                    <Text style={styles.descriptionToggleText}>
                      {descriptionExpanded ? 'Voir moins' : 'Voir plus'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </Card>
            </MotionReveal>
          ) : null}

          <MotionReveal delay={Motion.stagger.content * 2}>
          <Card padding="md" style={styles.infoCard}>
            <TouchableOpacity
              style={styles.infoRowNoMargin}
              activeOpacity={0.85}
              onPress={() => setCalendarExpanded((prev) => !prev)}
            >
              <View style={styles.infoIconWrap}>
                <Calendar size={20} color={colors.brand.secondary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoDatePrimary}>{startDateTimeLabel}</Text>
                <Text style={styles.infoDateSecondary}>{endDateTimeLabel}</Text>
              </View>
              <View style={styles.priceBlock}>
                <Text style={styles.priceValue}>{formatPrice(event.price)}</Text>
                {hasTicketPrice ? <Text style={styles.priceHint}>PAR BILLET</Text> : null}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarCta}
              activeOpacity={0.85}
              disabled={calendarBusy}
              onPress={() => void handleAddToCalendar()}
              accessibilityRole="button"
              accessibilityLabel={EVENT_CALENDAR_LABEL}
            >
              <Calendar size={16} color={colors.brand.secondary} />
              <Text style={styles.calendarCtaText}>
                {calendarBusy ? 'Ouverture de l’agenda…' : EVENT_CALENDAR_LABEL}
              </Text>
            </TouchableOpacity>
            {calendarExpanded ? (
              <View style={styles.calendarExpandedWrap}>
                {calendarDetailLines.map((line, index) => (
                  <View key={`${line.title}-${line.value}-${index}`} style={styles.calendarExpandedRow}>
                    <Text style={styles.calendarExpandedTitle}>{line.title}</Text>
                    <Text style={styles.calendarExpandedValue}>{line.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
          </MotionReveal>

          <MotionReveal delay={Motion.stagger.content * 3}>
          <Card padding="md" style={[styles.infoCard, { marginTop: spacing.md }]}>
            <TouchableOpacity
              style={styles.infoRowNoMargin}
              activeOpacity={0.85}
              onPress={() => setLocationExpanded((prev) => !prev)}
            >
                <View style={styles.infoIconWrap}>
                  <MapPin size={20} color={colors.brand.secondary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>{locationLabel}</Text>
                  <Text style={styles.infoLabel}>{locationSubLabel}</Text>
                </View>
                <View style={styles.routeColumn}>
                  <TouchableOpacity style={styles.routeButton} onPress={handleOpenNavigationOptions}>
                    <Text style={styles.routeText}>{EVENT_ITINERARY_LABEL}</Text>
                  </TouchableOpacity>
                  {distanceLabel ? <Text style={styles.routeDistanceText}>{distanceLabel}</Text> : null}
                </View>
            </TouchableOpacity>
              {locationExpanded ? (
                <View style={styles.locationExpandedWrap}>
                  <View style={styles.locationMapBox}>
                    {eventCoordinates ? (
                      <MapboxGL.MapView
                        style={StyleSheet.absoluteFill}
                        styleURL={MapboxGL.StyleURL.Dark}
                        scrollEnabled
                        zoomEnabled
                        pitchEnabled
                        rotateEnabled
                      >
                        <MapboxGL.Camera
                          zoomLevel={13}
                          centerCoordinate={[eventCoordinates.longitude, eventCoordinates.latitude]}
                        />
                        <MapboxGL.PointAnnotation
                          id="event-location-preview"
                          coordinate={[eventCoordinates.longitude, eventCoordinates.latitude]}
                        >
                          <View style={styles.locationMarker} />
                        </MapboxGL.PointAnnotation>
                      </MapboxGL.MapView>
                    ) : (
                      <View style={styles.locationMapFallback} />
                    )}
                  </View>
                </View>
              ) : null}
          </Card>
          </MotionReveal>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Eye size={20} color={colors.brand.textSecondary} style={{ marginBottom: 4 }} />
              <Text style={styles.statBoxValue}>{eventStats.views > 999 ? `${(eventStats.views / 1000).toFixed(1)}k` : eventStats.views}</Text>
            </View>
            <View style={styles.statBox}>
              <TouchableOpacity
                onPress={handleToggleHeart}
                accessibilityRole="button"
                accessibilityLabel={isEventHearted ? 'Ne plus aimer' : 'Aimer'}
                hitSlop={8}
              >
                <Animated.View style={heartAnimatedStyle}>
                  <Heart
                    size={20}
                    color={colors.brand.secondary}
                    fill={isEventHearted ? colors.brand.secondary : 'transparent'}
                    style={{ marginBottom: 4 }}
                  />
                </Animated.View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleOpenLikers}
                accessibilityRole="button"
                accessibilityLabel={`${eventStats.likes} personnes ont aimé`}
                hitSlop={8}
              >
                <Text style={styles.statBoxValue}>{eventStats.likes}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.statBox} onPress={handleGoToEchoes} activeOpacity={0.85}>
              <Star size={20} color="#FBBF24" fill="#FBBF24" style={{ marginBottom: 4 }} />
              <Text style={styles.statBoxValue}>{ratingAvg.toFixed(1)}</Text>
              <Text style={styles.statBoxLabel}>{ratingCount} AVIS</Text>
            </TouchableOpacity>
          </View>

          {practicalInfoRows.length > 0 ? (
            <Card padding="md" style={styles.practicalCard}>
              <Text style={styles.practicalTitle}>Infos pratiques</Text>
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
            </Card>
          ) : null}

          <Card padding="md" style={styles.creatorCard}>
            {isPlatformOrganizer ? (
              <TouchableOpacity
                style={styles.creatorMain}
                onPress={() => setPlatformOrganizerSheetVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Organisateur Moments Locaux. En savoir plus."
              >
                {event.creator?.avatar_url ? (
                  <Image source={{ uri: event.creator.avatar_url }} style={styles.creatorCardAvatar} />
                ) : MOMENTS_LOCAUX_ORGANIZER_AVATAR_URL ? (
                  <Image
                    source={{ uri: MOMENTS_LOCAUX_ORGANIZER_AVATAR_URL }}
                    defaultSource={MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL}
                    style={styles.creatorCardAvatar}
                  />
                ) : (
                  <Image source={MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL} style={styles.creatorCardAvatar} />
                )}
                <View style={styles.creatorCardInfo}>
                  <Text style={styles.creatorCardName}>
                    {event.creator?.display_name || MOMENTS_LOCAUX_ORGANIZER_NAME}
                  </Text>
                  <Text style={styles.creatorCardMeta}>Agenda public</Text>
                </View>
                <ChevronRight size={18} color={colors.brand.textSecondary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.creatorMain}>
                {event.creator?.avatar_url ? (
                  <Image source={{ uri: event.creator.avatar_url }} style={styles.creatorCardAvatar} />
                ) : MOMENTS_LOCAUX_ORGANIZER_AVATAR_URL ? (
                  <Image
                    source={{ uri: MOMENTS_LOCAUX_ORGANIZER_AVATAR_URL }}
                    defaultSource={MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL}
                    style={styles.creatorCardAvatar}
                  />
                ) : (
                  <Image source={MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL} style={styles.creatorCardAvatar} />
                )}
                <View style={styles.creatorCardInfo}>
                  <Text style={styles.creatorCardName}>
                    {event.creator?.display_name || MOMENTS_LOCAUX_ORGANIZER_NAME}
                  </Text>
                </View>
              </View>
            )}
          </Card>

          {features.socialPeers && peersEngaged.length > 0 ? (
            <Card padding="md" style={[styles.creatorCard, { marginTop: spacing.sm }]}>
              <Text style={styles.practicalTitle}>Aimé par vos suivis</Text>
              <View style={styles.peersRow}>
                {peersEngaged.map((peer) => (
                  <TouchableOpacity
                    key={peer.id}
                    style={styles.peerChip}
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
                    {peer.avatar_url ? (
                      <Image source={{ uri: peer.avatar_url }} style={styles.peerAvatar} />
                    ) : (
                      <View style={[styles.peerAvatar, styles.peerAvatarFallback]}>
                        <Text style={styles.peerAvatarInitial}>
                          {(peer.display_name || '?').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.peerName} numberOfLines={1}>
                      {peer.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
          ) : null}

          <View style={styles.echoesHeader}>
            <Text style={styles.echoesTitle}>Echos de la communauté</Text>
            <TouchableOpacity onPress={handleGoToEchoes}>
              <Text style={styles.echoesLink}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          <Card padding="md" style={styles.echoesCard}>
            {comments.slice(0, 2).length === 0 ? (
              <Text style={styles.emptyComments}>Aucun avis pour le moment</Text>
            ) : (
              comments.slice(0, 2).map((comment) => (
                <View key={comment.id} style={{ marginBottom: spacing.sm }}>
                  <Text style={styles.commentAuthor}>{comment.author?.display_name || 'Utilisateur'}</Text>
                  <Text style={styles.commentContent} numberOfLines={2}>{comment.message}</Text>
                </View>
              ))
            )}
          </Card>

          {loadingCommunityPhotos ? <ActivityIndicator color={colors.brand.secondary} style={{ marginTop: spacing.md }} /> : null}
        </View>
      </ScrollView>
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
        showClaimCta={false}
        onClose={() => setPlatformOrganizerSheetVisible(false)}
        onClaim={() => {}}
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    ...screenHeaderStyles.iconButton,
    backgroundColor: 'rgba(244, 251, 246, 0.92)',
    borderColor: 'rgba(26,51,41,0.12)',
  },
  heroContainer: {
    position: 'relative',
  },
  heroBadges: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
    maxWidth: '68%',
    flexWrap: 'wrap',
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(244,251,246,0.92)',
  },
  heroTagText: {
    color: colors.brand.text,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    flex: 1,
    color: colors.brand.text,
  },
  debugIdButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    marginTop: 4,
  },
  debugIdText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  infoCard: {
    marginBottom: 0,
  },
  infoRowNoMargin: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconWrap: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 181, 24,0.12)',
  },
  infoContent: {
    marginLeft: spacing.md,
    flex: 1,
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
  priceBlock: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.brand.secondary,
  },
  priceHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  calendarCta: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24,0.5)',
    backgroundColor: 'rgba(124, 181, 24,0.12)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  calendarCtaText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  calendarExpandedWrap: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
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
  routeButton: {
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24,0.5)',
    backgroundColor: 'rgba(124, 181, 24,0.12)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  routeText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  routeColumn: {
    marginLeft: spacing.sm,
    alignItems: 'flex-end',
    gap: 4,
  },
  routeDistanceText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  locationExpandedWrap: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  locationMapBox: {
    height: 150,
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
    borderColor: 'rgba(15,23,25,0.9)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
    minWidth: (width - spacing.lg * 2 - spacing.sm * 2) / 3,
    backgroundColor: colors.brand.surfaceMuted,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24, 0.22)',
  },
  statBoxValue: {
    color: colors.brand.text,
    fontWeight: '700',
    fontSize: 16,
  },
  statBoxLabel: {
    color: colors.brand.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  descriptionCard: {
    marginTop: 0,
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.brand.text,
    lineHeight: 24,
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
  practicalCard: {
    marginBottom: spacing.lg,
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
  creatorCard: {
    marginBottom: spacing.lg,
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
  peerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  echoesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  echoesTitle: {
    ...typography.h4,
    color: colors.brand.text,
  },
  echoesLink: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  echoesCard: {
    marginBottom: spacing.md,
  },
  emptyComments: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  commentAuthor: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.brand.text,
  },
  commentContent: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
});
