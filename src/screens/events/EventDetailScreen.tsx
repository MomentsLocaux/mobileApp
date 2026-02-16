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
  StatusBar,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Heart,
  MapPin,
  Calendar,
  Users,
  Share2,
  Edit,
  ChevronLeft,
  Star,
  Bookmark,
  QrCode,
  Eye,
  Award,
  Zap,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, AppBackground, screenHeaderStyles } from '../../components/ui';
import { EventsService } from '../../services/events.service';
import { SocialService } from '../../services/social.service';
import { useAuth } from '../../hooks';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getCategoryLabel } from '../../constants/categories';
import type { EventMediaSubmission, EventWithCreator } from '../../types/database';
import { useComments } from '@/hooks/useComments';
import { useLocationStore } from '@/store';
import { CheckinService } from '@/services/checkin.service';
import { PlaceMediaGallery, type MediaImage } from '@/components/events/PlaceMediaGallery';
import { supabase } from '@/lib/supabase/client';
import { useFavoritesStore } from '@/store/favoritesStore';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { NavigationOptionsSheet } from '@/components/search/NavigationOptionsSheet';
import { EventPhotoContributionModal } from '@/components/events/EventPhotoContributionModal';
import { EventMediaSubmissionsService } from '@/services/event-media-submissions.service';
import { CommunityService } from '@/services/community.service';
import Toast from 'react-native-toast-message';
import { useLikesStore } from '@/store/likesStore';
import { isEventLive } from '@/utils/event-status';
import { getDistanceText } from '@/utils/sort-events';

const { width } = Dimensions.get('window');
const BOTTOM_BAR_HEIGHT = 104;
const XP_REWARD_FALLBACK = 50;
const EVENT_QR_BASE_URL = process.env.EXPO_PUBLIC_EVENT_QR_BASE_URL || 'https://momentslocaux.app/events';

type AttendeePreview = {
  user_id: string;
  avatar_url: string | null;
};

const extractQrPayload = (raw: string): { eventId: string | null; qrToken: string | null } => {
  const value = (raw || '').trim();
  if (!value) return { eventId: null, qrToken: null };

  try {
    const url = new URL(value);
    const qrToken = url.searchParams.get('qr');
    const parts = url.pathname.split('/').filter(Boolean);
    const eventsIndex = parts.findIndex((part) => part === 'events');
    const eventId = eventsIndex >= 0 ? (parts[eventsIndex + 1] || null) : null;
    return { eventId, qrToken };
  } catch {
    // Fallback: allow scanning a raw token only.
    return { eventId: null, qrToken: value };
  }
};

export default function EventDetailScreen() {
  const { id, qr } = useLocalSearchParams<{ id: string; qr?: string }>();
  const router = useRouter();
  const { profile, session } = useAuth();
  const { currentLocation } = useLocationStore();
  const insets = useSafeAreaInsets();
  const { comments } = useComments(id || '');
  const { toggleFavorite: toggleFavoriteStore, isFavorite } = useFavoritesStore();
  const { toggleLike: toggleLikeStore, isLiked } = useLikesStore();

  const [event, setEvent] = useState<EventWithCreator | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestGate, setGuestGate] = useState({ visible: false, title: '' });
  const [navSheetVisible, setNavSheetVisible] = useState(false);
  const [communityPhotos, setCommunityPhotos] = useState<EventMediaSubmission[]>([]);
  const [loadingCommunityPhotos, setLoadingCommunityPhotos] = useState(false);
  const [contribModalVisible, setContribModalVisible] = useState(false);
  const [isFollowingCreator, setIsFollowingCreator] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [attendees, setAttendees] = useState<AttendeePreview[]>([]);
  const [totalAttendees, setTotalAttendees] = useState(0);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [eventStats, setEventStats] = useState({
    likes: 0,
    interests: 0,
    checkins: 0,
    views: 0,
  });
  const [checkinXpReward, setCheckinXpReward] = useState(XP_REWARD_FALLBACK);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const autoQrAttemptedRef = useRef(new Set<string>());
  const autoQrGuestPromptedRef = useRef(new Set<string>());
  const autoQrLocationPromptedRef = useRef(new Set<string>());
  const qrScanBusyRef = useRef(false);

  const isGuest = !session;
  const isOwner = !!profile?.id && profile.id === event?.creator_id;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'moderateur';
  const isEventLiked = event ? isLiked(event.id) : false;
  const isEventFavorited = event ? isFavorite(event.id) : false;

  const openGuestGate = (title: string) => setGuestGate({ visible: true, title });
  const closeGuestGate = () => setGuestGate({ visible: false, title: '' });

  const trackEventView = useCallback(
    async (eventId: string) => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const storageKey = `event_view_${eventId}_${today}`;
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const alreadyViewed = await AsyncStorage.getItem(storageKey);
        if (alreadyViewed) return;

        const { error } = await supabase.from('event_views').insert({
          event_id: eventId,
          profile_id: profile?.id || null,
        });
        if (error) return;

        await AsyncStorage.setItem(storageKey, 'true');
      } catch (err) {
        console.warn('trackEventView error', err);
      }
    },
    [profile?.id],
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
      const [likesResp, interestsResp, checkinsResp, viewsResp] = await Promise.all([
        supabase.from('event_likes').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_interests').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_checkins').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_views').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
      ]);

      setEventStats({
        likes: likesResp.count || 0,
        interests: interestsResp.count || 0,
        checkins: checkinsResp.count || 0,
        views: viewsResp.count || 0,
      });
    } catch (error) {
      console.warn('load event stats', error);
    }
  }, []);

  const loadAttendeesAndCheckin = useCallback(
    async (eventId: string) => {
      try {
        const [attendeesResp, countResp, mineResp] = await Promise.all([
          supabase
            .from('event_checkins')
            .select('user_id, profile:profiles!event_checkins_user_id_fkey(avatar_url)')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false })
            .limit(12),
          supabase.from('event_checkins').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
          profile?.id
            ? supabase
                .from('event_checkins')
                .select('id', { head: true, count: 'exact' })
                .eq('event_id', eventId)
                .eq('user_id', profile.id)
            : Promise.resolve({ count: 0, error: null } as any),
        ]);

        if (!attendeesResp.error && attendeesResp.data) {
          const formatted = attendeesResp.data.map((row: any) => ({
            user_id: row.user_id,
            avatar_url: row.profile?.avatar_url ?? null,
          }));
          setAttendees(formatted);
        }

        setTotalAttendees(countResp.count || 0);
        setHasCheckedIn((mineResp?.count || 0) > 0);
      } catch (err) {
        console.warn('load attendees/checkin', err);
      }
    },
    [profile?.id],
  );

  const loadCheckinXpReward = useCallback(async () => {
    try {
      let resolvedXp: number | null = null;

      const { data: missions, error: missionError } = await supabase
        .from('missions')
        .select('type, requirement, reward_xp, is_active')
        .eq('is_active', true)
        .limit(100);

      if (!missionError && Array.isArray(missions)) {
        const checkinMission = missions.find((mission: any) => {
          const typeStr = String(mission?.type || '').toLowerCase();
          const requirementStr = JSON.stringify(mission?.requirement || {}).toLowerCase();
          return (
            typeStr.includes('checkin') ||
            typeStr.includes('check-in') ||
            requirementStr.includes('checkin') ||
            requirementStr.includes('check-in')
          );
        });
        if (typeof checkinMission?.reward_xp === 'number' && checkinMission.reward_xp > 0) {
          resolvedXp = Number(checkinMission.reward_xp);
        }
      }

      if (resolvedXp === null) {
        const { data: lumoRule, error: lumoRuleError } = await supabase
          .from('lumo_rules')
          .select('amount')
          .eq('trigger_event', 'checkin')
          .eq('active', true)
          .maybeSingle();
        if (!lumoRuleError && typeof lumoRule?.amount === 'number' && lumoRule.amount > 0) {
          resolvedXp = Number(lumoRule.amount);
        }
      }

      setCheckinXpReward(resolvedXp ?? XP_REWARD_FALLBACK);
    } catch (error) {
      console.warn('load checkin xp reward', error);
      setCheckinXpReward(XP_REWARD_FALLBACK);
    }
  }, []);

  const loadEventDetails = useCallback(async () => {
    if (!id) return;
    try {
      const data = await EventsService.getEventById(id);
      const enriched = data ? { ...data, is_favorited: isFavorite(data.id), is_liked: isLiked(data.id) } : null;
      setEvent(enriched);
      if (enriched) {
        await Promise.all([
          loadEventStats(enriched.id),
          loadCommunityPhotos(enriched.id),
          loadAttendeesAndCheckin(enriched.id),
          loadCheckinXpReward(),
        ]);
      }
    } catch (error) {
      console.warn('loadEventDetails error', error);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id, isFavorite, isLiked, loadAttendeesAndCheckin, loadCheckinXpReward, loadCommunityPhotos, loadEventStats]);

  useFocusEffect(
    useCallback(() => {
      loadEventDetails();
      if (id) trackEventView(id);
    }, [id, loadEventDetails, trackEventView]),
  );

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!event?.creator_id || !profile?.id || isGuest || profile.id === event.creator_id) {
        if (mounted) setIsFollowingCreator(false);
        return;
      }
      try {
        const following = await CommunityService.isFollowing(event.creator_id);
        if (mounted) setIsFollowingCreator(following);
      } catch (e) {
        console.warn('check following creator', e);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [event?.creator_id, profile?.id, isGuest]);

  const handleBack = () => {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace('/(tabs)/map');
    }
  };

  const handleToggleLike = async () => {
    if (isGuest) {
      openGuestGate('Aimer cet événement');
      return;
    }
    if (!profile || !event) return;
    try {
      const nowLiked = await SocialService.like(profile.id, event.id);
      const wasLiked = isLiked(event.id);
      if (nowLiked !== wasLiked) {
        toggleLikeStore(event.id);
      }
      setEvent((prev) => (prev ? { ...prev, is_liked: nowLiked } : null));
      await loadEventStats(event.id);
    } catch (error) {
      Alert.alert('Erreur', "Impossible d'enregistrer le like pour le moment.");
    }
  };

  const handleToggleFavorite = async () => {
    if (isGuest) {
      openGuestGate('Ajouter aux favoris');
      return;
    }
    if (!profile || !event) return;
    try {
      const nowFavorited = await SocialService.toggleFavorite(profile.id, event.id);
      const wasFavorited = isFavorite(event.id);
      if (nowFavorited !== wasFavorited) {
        toggleFavoriteStore(event);
      }
      setEvent((prev) => (prev ? { ...prev, is_favorited: nowFavorited } : null));
      if (nowFavorited) {
        Alert.alert('Favoris', 'Cet événement a bien été ajouté à vos favoris.');
      }
    } catch (error) {
      Alert.alert('Erreur', "Impossible d'enregistrer le favori pour le moment.");
    }
  };

  const handleToggleFollowCreator = async () => {
    if (isGuest) {
      openGuestGate('Suivre ce créateur');
      return;
    }
    if (!event?.creator_id || !profile?.id || profile.id === event.creator_id || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowingCreator) {
        await CommunityService.unfollow(event.creator_id);
        setIsFollowingCreator(false);
      } else {
        await CommunityService.follow(event.creator_id);
        setIsFollowingCreator(true);
      }
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le suivi pour le moment.');
    } finally {
      setFollowLoading(false);
    }
  };

  const executeCheckIn = useCallback(async (options?: { qrToken?: string; source?: 'mobile' | 'qr_scan'; successTitle?: string }) => {
    if (isGuest) {
      openGuestGate('Faire un check-in');
      return;
    }
    if (!profile || !event || !session?.access_token) return;
    if (!currentLocation) {
      Alert.alert('Localisation requise', 'Activez la localisation pour valider le check-in.');
      return;
    }
    try {
      const res = await CheckinService.checkIn(
        event.id,
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        session.access_token,
        {
          qrToken: options?.qrToken,
          source: options?.source || 'mobile',
        },
      );
      if (res.success) {
        const message = res.rewards?.lumo ? `+${res.rewards.lumo} Lumo` : 'Check-in validé';
        setHasCheckedIn(true);
        await Promise.all([loadEventStats(event.id), loadAttendeesAndCheckin(event.id)]);
        Alert.alert(options?.successTitle || 'Check-in réussi', message);
      } else {
        Alert.alert(options?.successTitle || 'Check-in', res.message || 'Check-in non valide');
      }
    } catch (err) {
      Alert.alert(options?.successTitle || 'Check-in', err instanceof Error ? err.message : 'Erreur check-in');
    }
  }, [
    currentLocation,
    event,
    isGuest,
    loadAttendeesAndCheckin,
    loadEventStats,
    profile,
    session?.access_token,
  ]);

  const handleDistanceCheckIn = useCallback(async () => {
    await executeCheckIn({ source: 'mobile', successTitle: 'Check-in réussi' });
  }, [executeCheckIn]);

  const openQrScanner = useCallback(async () => {
    if (isGuest) {
      openGuestGate('Faire un check-in par QR');
      return;
    }
    if (!profile || !event || !session?.access_token) return;
    if (!currentLocation) {
      Alert.alert(
        'Localisation requise',
        'Activez la géolocalisation: elle est utilisée pour vérifier votre distance au lieu de l’événement.',
      );
      return;
    }

    const status = cameraPermission?.status;
    if (status !== 'granted') {
      const permission = await requestCameraPermission();
      if (permission.status !== 'granted') {
        Alert.alert('Caméra requise', 'Autorisez la caméra pour scanner le QR code.');
        return;
      }
    }

    qrScanBusyRef.current = false;
    setQrScannerVisible(true);
  }, [
    cameraPermission?.status,
    currentLocation,
    event,
    isGuest,
    profile,
    requestCameraPermission,
    session?.access_token,
  ]);

  const handleCheckIn = () => {
    if (isOwner) {
      Alert.alert('Check-in', 'L’organisateur ne peut pas valider sa présence sur son propre événement.');
      return;
    }
    if (hasCheckedIn) {
      Alert.alert('Check-in', 'Votre présence est déjà validée pour cet événement.');
      return;
    }
    Alert.alert(
      'Choisir un mode de check-in',
      'Vous pouvez faire un check-in via QR code ou sans QR via vérification de distance (géolocalisation utilisée).',
      [
        { text: 'Check-in par QR', onPress: () => void openQrScanner() },
        { text: "Je n'ai pas de QR code", onPress: () => void handleDistanceCheckIn() },
        { text: 'Annuler', style: 'cancel' },
      ],
    );
  };

  const handleShare = async () => {
    if (isGuest) {
      openGuestGate('Partager cet événement');
      return;
    }
    if (!event) return;
    try {
      const message = `${event.title}${event.external_url ? `\n${event.external_url}` : ''}`;
      await Share.share({ message });
    } catch (err) {
      console.warn('share error', err);
    }
  };

  const handleShareQr = async () => {
    if (isGuest) {
      openGuestGate('Partager le QR code');
      return;
    }
    if (!isOwner && !isAdmin) {
      Alert.alert('Accès restreint', 'Seuls l’organisateur et les modérateurs/admin peuvent partager ce QR code.');
      return;
    }
    if (!eventQrPayload) {
      Alert.alert('QR indisponible', 'Le QR code sera généré lors de la publication de l’événement.');
      return;
    }
    const eventTitle = event?.title || 'Événement';
    try {
      await Share.share({
        message: `QR code de ${eventTitle}\n${eventQrPayload}`,
      });
    } catch (err) {
      console.warn('share qr error', err);
    }
  };

  const handleAddPhoto = () => {
    if (isGuest) {
      openGuestGate('Ajouter une photo');
      return;
    }
    if (!isAdmin && !isOwner && !hasCheckedIn) {
      Alert.alert('Check-in requis', 'Vous devez faire un check-in pour ajouter une photo.');
      return;
    }
    setContribModalVisible(true);
  };

  const handleGoToEchoes = () => {
    if (!event) return;
    router.push(`/events/echoes?id=${event.id}` as any);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
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

  const formatCalendarDate = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  };

  const openCalendar = async () => {
    if (!event) return;
    const start = new Date(event.starts_at);
    if (isNaN(start.getTime())) return;
    const end = event.ends_at ? new Date(event.ends_at) : start;
    const endDate = isNaN(end.getTime()) || end < start ? start : end;

    const locationLabel = [event.address, [event.postal_code, event.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
    const calendarUrl =
      'https://www.google.com/calendar/render' +
      `?action=TEMPLATE&text=${encodeURIComponent(event.title || 'Événement')}` +
      `&dates=${encodeURIComponent(`${formatCalendarDate(start)}/${formatCalendarDate(endDate)}`)}` +
      `&details=${encodeURIComponent(event.description || '')}` +
      `&location=${encodeURIComponent(locationLabel)}` +
      `&ctz=${encodeURIComponent(timezone)}`;

    await Linking.openURL(calendarUrl);
  };

  const confirmOpenCalendar = () => {
    if (!event) return;
    Alert.alert(
      'Ajouter au calendrier',
      `Voulez-vous créer un événement dans votre calendrier pour:\n${event.title}\nLe ${formatDate(event.starts_at)} à ${formatTime(event.starts_at)} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Créer', onPress: () => void openCalendar() },
      ],
    );
  };

  const locationLabel = useMemo(() => {
    if (!event) return 'Ville non précisée';
    const formatted = [event.postal_code, event.city].filter(Boolean).join(' ');
    return formatted || event.city || 'Ville non précisée';
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

  const handleOpenNavigationOptions = useCallback(() => {
    if (!event) return;
    Alert.alert(
      "S'y rendre",
      'Choisissez comment ouvrir l’itinéraire.',
      [
        {
          text: 'Voir sur la map Moments Locaux',
          onPress: () => router.push(`/(tabs)/map?focus=${event.id}` as any),
        },
        {
          text: "Ouvrir dans l'application de navigation",
          onPress: () => setNavSheetVisible(true),
        },
        { text: 'Annuler', style: 'cancel' },
      ],
    );
  }, [event, router]);

  const eventQrPayload = useMemo(() => {
    if (!event?.qr_token) return null;
    return `${EVENT_QR_BASE_URL}/${event.id}?qr=${event.qr_token}`;
  }, [event?.id, event?.qr_token]);
  const qrTokenFromLink = useMemo(() => {
    if (typeof qr !== 'string') return '';
    return qr.trim();
  }, [qr]);

  const eventQrImageUrl = useMemo(() => {
    if (!eventQrPayload) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(eventQrPayload)}`;
  }, [eventQrPayload]);

  useEffect(() => {
    if (!event || !qrTokenFromLink) return;

    const key = `${event.id}:${qrTokenFromLink}`;
    if (hasCheckedIn) {
      autoQrAttemptedRef.current.add(key);
      return;
    }

    if (isGuest || !session?.access_token) {
      if (!autoQrGuestPromptedRef.current.has(key)) {
        autoQrGuestPromptedRef.current.add(key);
        openGuestGate('Se connecter pour valider le check-in QR');
      }
      return;
    }

    if (!currentLocation) {
      if (!autoQrLocationPromptedRef.current.has(key)) {
        autoQrLocationPromptedRef.current.add(key);
        Alert.alert('Localisation requise', 'Activez la localisation pour valider le check-in QR.');
      }
      return;
    }

    if (autoQrAttemptedRef.current.has(key)) return;
    autoQrAttemptedRef.current.add(key);

    (async () => {
      try {
        const res = await CheckinService.checkIn(
          event.id,
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          session.access_token,
          {
            qrToken: qrTokenFromLink,
            source: 'qr_scan',
          },
        );
        if (res.success) {
          const message = res.rewards?.lumo ? `+${res.rewards.lumo} Lumo` : 'Check-in validé';
          setHasCheckedIn(true);
          await Promise.all([loadEventStats(event.id), loadAttendeesAndCheckin(event.id)]);
          Alert.alert('Check-in QR réussi', message);
        } else {
          Alert.alert('Check-in QR', res.message || 'Check-in non valide');
        }
      } catch (err) {
        Alert.alert('Check-in QR', err instanceof Error ? err.message : 'Erreur check-in');
      }
    })();
  }, [
    currentLocation,
    event,
    hasCheckedIn,
    isGuest,
    loadAttendeesAndCheckin,
    loadEventStats,
    qrTokenFromLink,
    session?.access_token,
  ]);

  const mediaImages = useMemo<MediaImage[]>(() => {
    if (!event) return [];
    const media = (event.media || []).map((m, index) => ({
      id: m.id || `${m.url}-${index}`,
      uri: m.url,
      authorId: (m as any).author_id,
      isUserGenerated: false,
    }));

    const cover = event.cover_url ? [{ id: `cover-${event.id}`, uri: event.cover_url, isUserGenerated: false }] : [];
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
    return (communityPhotos || [])
      .map((photo, index) => ({
        id: photo.id || `community-${index}`,
        uri: photo.url,
        authorId: photo.author_id,
        isUserGenerated: true,
      }))
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

    return {
      ratingAvg: derivedCount > 0 ? derivedAvg : event?.rating_avg ?? 0,
      ratingCount: derivedCount > 0 ? derivedCount : event?.rating_count ?? 0,
    };
  }, [comments, event]);

  const isLiveNow = useMemo(() => isEventLive(event), [event?.starts_at, event?.ends_at]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <AppBackground />
        <ActivityIndicator size="large" color={colors.brand.secondary} />
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <AppBackground />
        <StatusBar barStyle="light-content" />

        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
            <ChevronLeft size={22} color={colors.brand.text} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
              <Share2 size={20} color={colors.brand.text} />
            </TouchableOpacity>
            {(isOwner || isAdmin) ? (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => router.push(`/events/create/step-1?edit=${event.id}` as any)}
              >
                <Edit size={20} color={colors.brand.secondary} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.iconButton} onPress={handleToggleLike}>
              <Heart
                size={20}
                color={isEventLiked ? colors.error[500] : colors.brand.text}
                fill={isEventLiked ? colors.error[500] : 'transparent'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroContainer}>
          <PlaceMediaGallery images={mediaImages} communityImages={communityMediaImages} onAddPhoto={handleAddPhoto}>
            <View style={styles.heroBadges}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{getCategoryLabel(event.category || '')}</Text>
              </View>
              {isLiveNow && (
                <View style={[styles.heroBadge, styles.heroBadgeLive]}>
                  <View style={styles.liveDot} />
                  <Text style={[styles.heroBadgeText, styles.heroBadgeTextLive]}>EN DIRECT</Text>
                </View>
              )}
            </View>
          </PlaceMediaGallery>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{event.title}</Text>

          <TouchableOpacity style={styles.cardTouchable} activeOpacity={0.85} onPress={confirmOpenCalendar}>
            <Card padding="md" style={styles.infoCard}>
              <View style={styles.infoRowNoMargin}>
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
              </View>
            </Card>
          </TouchableOpacity>

          <Card padding="md" style={[styles.infoCard, { marginTop: spacing.md }]}> 
            <View style={styles.infoRowNoMargin}>
              <View style={styles.infoIconWrap}>
                <MapPin size={20} color={colors.brand.secondary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>{locationLabel}</Text>
                <Text style={styles.infoLabel}>{event.venue_name || 'Lieu de l\'événement'}</Text>
              </View>
              <View style={styles.routeColumn}>
                <TouchableOpacity style={styles.routeButton} onPress={handleOpenNavigationOptions}>
                  <Text style={styles.routeText}>S&apos;y rendre</Text>
                </TouchableOpacity>
                {distanceLabel ? <Text style={styles.routeDistanceText}>{distanceLabel}</Text> : null}
              </View>
            </View>
          </Card>

          {event.status === 'published' && (isOwner || isAdmin) ? (
            <Card padding="md" style={[styles.qrCard, { marginTop: spacing.md }]}>
              <View style={styles.qrHeader}>
                <Text style={styles.qrTitle}>QR code de l’événement</Text>
                <TouchableOpacity style={styles.qrShareButton} onPress={handleShareQr}>
                  <Share2 size={16} color={colors.brand.secondary} />
                  <Text style={styles.qrShareText}>Partager</Text>
                </TouchableOpacity>
              </View>
              {eventQrImageUrl ? (
                <Image source={{ uri: eventQrImageUrl }} style={styles.qrImage} />
              ) : (
                <Text style={styles.qrHint}>Le QR code est en cours de génération.</Text>
              )}
              {eventQrPayload ? (
                <Text numberOfLines={1} style={styles.qrLink}>{eventQrPayload}</Text>
              ) : null}
            </Card>
          ) : null}

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Eye size={20} color={colors.neutral[400]} style={{ marginBottom: 4 }} />
              <Text style={styles.statBoxValue}>{eventStats.views > 999 ? `${(eventStats.views / 1000).toFixed(1)}k` : eventStats.views}</Text>
            </View>
            <TouchableOpacity style={styles.statBox} onPress={handleToggleLike}>
              <Heart size={20} color={colors.error[500]} fill={isEventLiked ? colors.error[500] : 'transparent'} style={{ marginBottom: 4 }} />
              <Text style={styles.statBoxValue}>{eventStats.likes}</Text>
            </TouchableOpacity>
            <View style={styles.statBox}>
              <Users size={20} color={colors.brand.secondary} style={{ marginBottom: 4 }} />
              <Text style={styles.statBoxValue}>{eventStats.checkins + (event.interests_count || eventStats.interests || 0)}</Text>
            </View>
            <View style={styles.statBox}>
              <Star size={20} color="#FBBF24" fill="#FBBF24" style={{ marginBottom: 4 }} />
              <Text style={styles.statBoxValue}>{ratingAvg.toFixed(1)}</Text>
              <Text style={styles.statBoxLabel}>{ratingCount} AVIS</Text>
            </View>
          </View>

          <LinearGradient
            colors={[colors.brand.secondary, '#2A4FE3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.xpCard}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.xpTitle}>Gagnez une récompense XP</Text>
              <Text style={styles.xpSubtitle}>
                Participez à cet événement pour gagner <Text style={{ fontWeight: '800' }}>+{checkinXpReward} XP</Text>{' '}
                <Award size={13} color="#FFF" />
              </Text>
            </View>
            <View style={styles.xpIcon}>
              <Zap size={30} color="#FFF" fill="#FFF" />
            </View>
          </LinearGradient>

          <View style={styles.facepileSection}>
            <View style={styles.facepileRow}>
              {attendees.slice(0, 3).map((attendee, i) => (
                attendee.avatar_url ? (
                  <Image key={`${attendee.user_id}-${i}`} source={{ uri: attendee.avatar_url }} style={[styles.facepileAvatar, { zIndex: 3 - i }]} />
                ) : (
                  <View key={`${attendee.user_id}-${i}`} style={[styles.facepileAvatar, { zIndex: 3 - i, backgroundColor: colors.neutral[600] }]} />
                )
              ))}
              {attendees.length === 0 ? (
                <>
                  <View style={[styles.facepileAvatar, { backgroundColor: colors.neutral[700], zIndex: 3 }]} />
                  <View style={[styles.facepileAvatar, { backgroundColor: colors.neutral[600], zIndex: 2 }]} />
                  <View style={[styles.facepileAvatar, { backgroundColor: colors.neutral[500], zIndex: 1 }]} />
                </>
              ) : null}
              <View style={[styles.facepileAvatar, styles.facepileCounter, { zIndex: 0 }]}>
                <Text style={styles.facepileCountText}>+{Math.max(totalAttendees - 3, 0)}</Text>
              </View>
            </View>
            <Text style={styles.facepileLabel}>
              {isLiveNow
                ? `${totalAttendees} participant${totalAttendees > 1 ? 's' : ''}`
                : `${Math.max(event.interests_count || 0, totalAttendees)} ami${Math.max(event.interests_count || 0, totalAttendees) > 1 ? 's' : ''} intéressé${Math.max(event.interests_count || 0, totalAttendees) > 1 ? 's' : ''}`}
            </Text>
          </View>

          <Text style={styles.description}>{event.description}</Text>

          {event.tags?.length ? (
            <View style={styles.tagsContainer}>
              {event.tags.map((tag, index) => (
                <View key={`${tag}-${index}`} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Card padding="md" style={styles.creatorCard}>
            <View style={styles.creatorCardRow}>
              <TouchableOpacity
                style={styles.creatorMain}
                activeOpacity={0.8}
                onPress={() => {
                  if (!event.creator) return;
                  if (isGuest) {
                    openGuestGate('Accéder à la communauté');
                    return;
                  }
                  router.push(`/community/${event.creator.id}` as any);
                }}
              >
                {event.creator?.avatar_url ? (
                  <Image source={{ uri: event.creator.avatar_url }} style={styles.creatorCardAvatar} />
                ) : (
                  <View style={[styles.creatorCardAvatar, styles.creatorCardAvatarFallback]} />
                )}
                <View style={styles.creatorCardInfo}>
                  <Text style={styles.creatorCardName}>{event.creator?.display_name || 'Moments Locaux'}</Text>
                  <Text style={styles.creatorCardMeta}>{event.creator?.city || 'Organisateur'}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.followButton} onPress={handleToggleFollowCreator}>
                <Text style={styles.followButtonText}>
                  {isOwner ? 'Vous' : followLoading ? '...' : isFollowingCreator ? 'Suivi' : 'Suivre'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

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

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}> 
        <View style={styles.bottomBarContent}>
          <TouchableOpacity style={[styles.bottomBarCta, styles.bottomPrimary]} onPress={handleToggleFavorite}>
            <Bookmark
              size={18}
              color={isEventFavorited ? colors.warning[500] : colors.brand.text}
              fill={isEventFavorited ? colors.warning[500] : 'transparent'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.bottomBarCta, styles.bottomSecondary]} onPress={handleCheckIn}>
            <View style={styles.checkinIconWrap}>
              <QrCode size={16} color="#D4F6FF" />
            </View>
            <Text style={styles.checkinButtonText}>{hasCheckedIn ? 'Présence validée' : 'Valider ma présence'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <NavigationOptionsSheet visible={navSheetVisible} event={event} onClose={() => setNavSheetVisible(false)} />

      <Modal
        visible={qrScannerVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setQrScannerVisible(false)}
      >
        <View style={styles.qrScannerContainer}>
          <CameraView
            style={styles.qrScannerCamera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={async ({ data }) => {
              if (qrScanBusyRef.current) return;
              if (!event) return;
              qrScanBusyRef.current = true;

              const payload = extractQrPayload(data || '');
              if (!payload.qrToken) {
                qrScanBusyRef.current = false;
                Alert.alert('QR invalide', 'Ce QR code ne contient pas de token de check-in.');
                return;
              }
              if (payload.eventId && payload.eventId !== event.id) {
                qrScanBusyRef.current = false;
                Alert.alert('Mauvais événement', 'Ce QR code correspond à un autre événement.');
                return;
              }

              setQrScannerVisible(false);
              await executeCheckIn({
                qrToken: payload.qrToken,
                source: 'qr_scan',
                successTitle: 'Check-in QR réussi',
              });
              qrScanBusyRef.current = false;
            }}
          />
          <View style={styles.qrScannerOverlay}>
            <Text style={styles.qrScannerTitle}>Scannez le QR code de l’événement</Text>
            <Text style={styles.qrScannerHint}>
              La validation utilise aussi votre géolocalisation pour vérifier votre présence sur place.
            </Text>
            <TouchableOpacity style={styles.qrScannerClose} onPress={() => setQrScannerVisible(false)}>
              <Text style={styles.qrScannerCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

      {event && profile?.id ? (
        <EventPhotoContributionModal
          visible={contribModalVisible}
          eventId={event.id}
          userId={profile.id}
          onClose={() => setContribModalVisible(false)}
          onSubmitted={() => loadCommunityPhotos(event.id)}
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
    backgroundColor: colors.brand.background,
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
    backgroundColor: 'rgba(8, 13, 16, 0.62)',
    borderColor: 'rgba(255,255,255,0.28)',
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
  heroBadgeLive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroBadgeTextLive: {
    color: '#34D399',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.brand.text,
    marginBottom: spacing.md,
  },
  cardTouchable: {
    borderRadius: borderRadius.lg,
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
    backgroundColor: 'rgba(43,191,227,0.12)',
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
  routeButton: {
    borderWidth: 1,
    borderColor: 'rgba(43,191,227,0.5)',
    backgroundColor: 'rgba(43,191,227,0.12)',
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
  qrCard: {
    marginBottom: 0,
  },
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  qrTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  qrShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(43,191,227,0.45)',
    backgroundColor: 'rgba(43,191,227,0.1)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  qrShareText: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  qrImage: {
    width: Math.min(width - spacing.lg * 4, 220),
    height: Math.min(width - spacing.lg * 4, 220),
    alignSelf: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
  },
  qrHint: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  qrLink: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statBox: {
    flex: 1,
    minWidth: (width - spacing.lg * 2 - spacing.sm * 3) / 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statBoxValue: {
    color: '#FFF',
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
  xpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 20,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  xpTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  xpSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
  },
  xpIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  facepileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingVertical: 8,
  },
  facepileRow: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  facepileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: -12,
    borderWidth: 2,
    borderColor: colors.brand.background,
  },
  facepileCounter: {
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facepileCountText: {
    color: colors.brand.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  facepileLabel: {
    color: colors.brand.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  description: {
    ...typography.body,
    color: colors.brand.text,
    lineHeight: 30,
    marginBottom: spacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagText: {
    ...typography.bodySmall,
    color: colors.brand.text,
  },
  creatorCard: {
    marginBottom: spacing.lg,
  },
  creatorCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  followButton: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.brand.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(43,191,227,0.1)',
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
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.brand.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: spacing.md,
    minHeight: BOTTOM_BAR_HEIGHT,
    justifyContent: 'center',
  },
  bottomBarContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomBarCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    height: 56,
    gap: spacing.xs,
  },
  bottomPrimary: {
    flex: 0.2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bottomSecondary: {
    flex: 0.8,
    backgroundColor: '#39BFE3',
  },
  bottomBarText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  checkinIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 42, 56, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(212, 246, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinButtonText: {
    ...typography.body,
    color: '#F0FBFF',
    fontWeight: '800',
  },
  qrScannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  qrScannerCamera: {
    flex: 1,
  },
  qrScannerOverlay: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: Math.max(spacing.lg, 24),
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: spacing.xs,
  },
  qrScannerTitle: {
    ...typography.body,
    color: '#FFF',
    fontWeight: '700',
  },
  qrScannerHint: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.84)',
  },
  qrScannerClose: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  qrScannerCloseText: {
    ...typography.bodySmall,
    color: '#FFF',
    fontWeight: '700',
  },
});
