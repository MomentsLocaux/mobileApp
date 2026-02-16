import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Platform,
  Share,
  TextInput,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Heart,
  MapPin,
  Calendar,
  Clock,
  Users,
  MessageSquare,
  Share2,
  ChevronLeft,
  Star,
  Edit,
  Trash2,
  Image as ImageIcon,
  Navigation2,
  ExternalLink,
  Mail,
  Phone,
  Flag,
  Eye,
  Award,
  Zap,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, AppBackground } from '../../components/ui';
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
import { ReportService } from '@/services/report.service';
import type { ReportReasonCode } from '@/constants/report-reasons';
import ReportReasonModal from '@/components/moderation/ReportReasonModal';
import Toast from 'react-native-toast-message';
import { useLikesStore } from '@/store/likesStore';
import { isEventLive } from '@/utils/event-status';

const { width } = Dimensions.get('window');
const BOTTOM_BAR_HEIGHT = 72;
const PHOTO_SIZE = Math.floor((width - spacing.lg * 2 - spacing.sm * 2) / 3);

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile, session } = useAuth();
  const { currentLocation } = useLocationStore();
  const insets = useSafeAreaInsets();
  const { comments, loading: loadingComments, addComment, reload: reloadComments } = useComments(id || '');
  const { toggleFavorite: toggleFavoriteStore, isFavorite } = useFavoritesStore();
  const { toggleLike: toggleLikeStore, isLiked } = useLikesStore();

  const [event, setEvent] = useState<EventWithCreator | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentRating, setCommentRating] = useState<number | null>(null);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [likedMedia, setLikedMedia] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<{ type: 'event' | 'comment' | 'media'; id: string } | null>(null);
  const [guestGate, setGuestGate] = useState({ visible: false, title: '' });
  const [activeSection, setActiveSection] = useState<'overview' | 'reviews' | 'photos' | 'info' | 'creator'>('overview');
  const [navSheetVisible, setNavSheetVisible] = useState(false);
  const [creatorEvents, setCreatorEvents] = useState<EventWithCreator[]>([]);
  const [communityPhotos, setCommunityPhotos] = useState<EventMediaSubmission[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<EventMediaSubmission[]>([]);
  const [eventStats, setEventStats] = useState({
    likes: 0,
    favorites: 0,
    interests: 0,
    checkins: 0,
    views: 0,
  });
  const [loadingCommunityPhotos, setLoadingCommunityPhotos] = useState(false);
  const [contribModalVisible, setContribModalVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const commentInputRef = useRef<TextInput>(null);
  const sectionOpacity = useRef(new Animated.Value(1)).current;
  const isGuest = !session;

  const openGuestGate = (title: string) => setGuestGate({ visible: true, title });
  const closeGuestGate = () => setGuestGate({ visible: false, title: '' });

  // Track event view with daily deduplication
  const trackEventView = useCallback(async (eventId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const storageKey = `event_view_${eventId}_${today}`;

      // Check if already viewed today (using AsyncStorage for React Native)
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const alreadyViewed = await AsyncStorage.getItem(storageKey);

      if (alreadyViewed) return;

      // Insert view record
      const { error } = await supabase.from('event_views').insert({
        event_id: eventId,
        profile_id: profile?.id || null,
      });

      if (error) {
        console.warn('track view error', error);
        return;
      }

      // Mark as viewed for today
      await AsyncStorage.setItem(storageKey, 'true');
    } catch (err) {
      console.warn('trackEventView error', err);
    }
  }, [profile?.id]);

  const loadCommunityPhotos = useCallback(
    async (evt: EventWithCreator | null) => {
      if (!evt) return;
      setLoadingCommunityPhotos(true);
      try {
        const approved = await EventMediaSubmissionsService.listApproved(evt.id);
        setCommunityPhotos(approved);

        const canReview =
          profile?.id === evt.creator_id || profile?.role === 'admin' || profile?.role === 'moderateur';
        if (canReview) {
          const pending = await EventMediaSubmissionsService.listPendingForEvent(evt.id);
          setPendingPhotos(pending);
        } else {
          setPendingPhotos([]);
        }
      } catch (err) {
        console.warn('load community photos', err);
      } finally {
        setLoadingCommunityPhotos(false);
      }
    },
    [profile?.id, profile?.role]
  );

  const loadEventStats = useCallback(async (eventId: string) => {
    try {
      const [likesResp, favoritesResp, interestsResp, checkinsResp, viewsResp] = await Promise.all([
        supabase.from('event_likes').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('favorites').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_interests').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_checkins').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_views').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
      ]);

      if (likesResp.error) throw likesResp.error;
      if (favoritesResp.error) throw favoritesResp.error;
      if (interestsResp.error) throw interestsResp.error;
      if (checkinsResp.error) throw checkinsResp.error;
      if (viewsResp.error) throw viewsResp.error;

      setEventStats({
        likes: likesResp.count || 0,
        favorites: favoritesResp.count || 0,
        interests: interestsResp.count || 0,
        checkins: checkinsResp.count || 0,
        views: viewsResp.count || 0,
      });
    } catch (error) {
      console.warn('load event stats', error);
    }
  }, []);

  const loadEventDetails = useCallback(async () => {
    if (!id) return;
    try {
      const data = await EventsService.getEventById(id);
      const withSocialFlags = data
        ? { ...data, is_favorited: isFavorite(data.id), is_liked: isLiked(data.id) }
        : null;
      setEvent(withSocialFlags);
      if (withSocialFlags) {
        await loadEventStats(withSocialFlags.id);
      } else {
        setEventStats({ likes: 0, favorites: 0, interests: 0, checkins: 0, views: 0 });
      }
    } catch (error) {
      console.warn('loadEventDetails error', error);
      setEvent(null);
      setEventStats({ likes: 0, favorites: 0, interests: 0, checkins: 0, views: 0 });
    } finally {
      setLoading(false);
    }
  }, [id, isFavorite, isLiked, loadEventStats]);

  useFocusEffect(
    useCallback(() => {
      loadEventDetails();
      if (id) {
        trackEventView(id);
      }
    }, [id, loadEventDetails, trackEventView]),
  );

  useEffect(() => {
    sectionOpacity.setValue(0);
    Animated.timing(sectionOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [activeSection, sectionOpacity]);

  useEffect(() => {
    let mounted = true;
    const loadCreatorEvents = async () => {
      if (!event?.creator_id) return;
      try {
        const data = await EventsService.listEventsByCreator(event.creator_id);
        if (!mounted) return;
        const filtered = data.filter((evt) => evt.id !== event.id).slice(0, 4);
        setCreatorEvents(filtered);
      } catch (err) {
        console.warn('load creator events', err);
      }
    };
    loadCreatorEvents();
    return () => {
      mounted = false;
    };
  }, [event?.creator_id, event?.id]);

  useEffect(() => {
    if (!event) return;
    loadCommunityPhotos(event);
  }, [event?.id, loadCommunityPhotos]);

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
      console.warn('toggle like error', error);
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
      await loadEventStats(event.id);
    } catch (error) {
      console.warn('toggle favorite error', error);
      Alert.alert('Erreur', "Impossible d'enregistrer le favori pour le moment.");
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (isGuest) {
      openGuestGate('Aimer un commentaire');
      return;
    }
    try {
      await SocialService.likeComment(profile?.id || '', commentId);
      setLikedComments((prev) => {
        const next = new Set(prev);
        if (next.has(commentId)) {
          next.delete(commentId);
        } else {
          next.add(commentId);
        }
        return next;
      });
    } catch (e) {
      console.warn('likeComment', e);
    }
  };

  const handleToggleMediaLike = async (mediaId: string) => {
    if (isGuest) {
      openGuestGate('Aimer une photo');
      return;
    }
    try {
      await SocialService.likeMedia(profile?.id || '', mediaId);
      setLikedMedia((prev) => {
        const next = new Set(prev);
        if (next.has(mediaId)) {
          next.delete(mediaId);
        } else {
          next.add(mediaId);
        }
        return next;
      });
    } catch (e) {
      console.warn('likeMedia', e);
    }
  };

  const handleOpenReport = (type: 'event' | 'comment' | 'media', id: string) => {
    if (isGuest) {
      openGuestGate('Signaler');
      return;
    }
    setReportTarget({ type, id });
  };

  const handleReportReason = async (reason: ReportReasonCode) => {
    if (!reportTarget) return;
    try {
      if (reportTarget.type === 'event') {
        await ReportService.event(reportTarget.id, { reason });
      } else if (reportTarget.type === 'comment') {
        await ReportService.comment(reportTarget.id, { reason });
      } else {
        await ReportService.media(reportTarget.id, { reason });
      }
      Toast.show({
        type: 'success',
        text1: 'Merci !',
        text2: 'Votre signalement a été envoyé.',
      });
    } catch (e) {
      console.warn('report', e);
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible d’envoyer le signalement.',
      });
    } finally {
      setReportTarget(null);
    }
  };

  const handleCheckIn = async () => {
    console.log('[CheckIn] click', {
      eventId: event?.id,
      userId: profile?.id,
      isGuest,
      hasLocation: !!currentLocation,
    });
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
      );
      if (res.success) {
        const message = res.rewards?.lumo ? `+${res.rewards.lumo} Lumo` : 'Check-in validé';
        Alert.alert('Check-in réussi', message, [
          {
            text: 'OK',
            onPress: () => {
              if (res.rewards?.lumo) {
                Toast.show({
                  type: 'success',
                  text1: 'Lumo gagné',
                  text2: `+${res.rewards.lumo} Lumo`,
                });
              }
            },
          },
        ]);
      } else {
        Alert.alert('Check-in', res.message || 'Check-in non valide');
      }
    } catch (err) {
      Alert.alert('Check-in', err instanceof Error ? err.message : 'Erreur check-in');
    }
  };

  const handleDeleteEvent = async () => {
    if (!event) return;
    console.log('[EventDetail] delete click', {
      eventId: event.id,
      creatorId: event.creator_id,
      currentUserId: profile?.id,
    });
    const isOwner = profile?.id === event.creator_id;
    const isAdmin = profile?.role === 'admin' || profile?.role === 'moderateur';
    if (!isOwner && !isAdmin) {
      Alert.alert('Action refusée', 'Seul le créateur ou un administrateur peut supprimer cet événement.');
      return;
    }

    Alert.alert(
      'Supprimer l\'événement',
      'Êtes-vous sûr de vouloir supprimer cet événement ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            // 1. Nettoyage du stockage (Storage)
            const pathsToDelete: string[] = [];
            const marker = '/storage/v1/object/public/event-media/';
            const extractPath = (url: string) => {
              const idx = url.indexOf(marker);
              return idx !== -1 ? url.slice(idx + marker.length) : null;
            };

            if (event.cover_url) {
              const p = extractPath(event.cover_url);
              if (p) pathsToDelete.push(p);
            }
            if (event.media && event.media.length > 0) {
              event.media.forEach((m) => {
                if (m.url) {
                  const p = extractPath(m.url as string);
                  if (p) pathsToDelete.push(p);
                }
              });
            }
            if (pathsToDelete.length > 0) {
              await supabase.storage.from('event-media').remove(pathsToDelete).catch((err) => console.warn('Storage cleanup error:', err));
            }

            // 2. Suppression en base de données
            const success = await EventsService.deleteEvent(event.id);
            if (success) {
              router.replace('/(tabs)/map');
            }
          },
        },
      ]
    );
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

  const formatDateRange = (start: string, end?: string | null) => {
    if (!end) return formatDate(start);
    const startDate = new Date(start);
    const endDate = new Date(end);
    const sameDay = startDate.toDateString() === endDate.toDateString();
    if (sameDay) return formatDate(start);
    if (endDate < startDate) {
      return `${formatDate(end)} - ${formatDate(start)}`;
    }
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const formatTimeRange = (start: string, end?: string | null) => {
    if (!end) return formatTime(start);
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate < startDate) {
      return `${formatTime(end)} - ${formatTime(start)}`;
    }
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  const formatCalendarDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  };

  const mediaUrls = useMemo(() => {
    const urls = [
      event?.cover_url,
      ...(event?.media?.map((m) => m.url).filter(Boolean) as string[] | undefined || []),
    ].filter(Boolean) as string[];
    return Array.from(new Set(urls));
  }, [event]);


  const mediaImages = useMemo<MediaImage[]>(() => {
    if (!event) return [];
    const media = (event.media || []).map((m, index) => ({
      id: m.id || `${m.url}-${index}`,
      uri: m.url,
      authorId: (m as any).author_id,
      isUserGenerated: true,
    }));

    const cover = event.cover_url
      ? [{ id: `cover-${event.id}`, uri: event.cover_url, isUserGenerated: false }]
      : [];

    const merged = [...cover, ...media];
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (!item.uri || seen.has(item.uri)) return false;
      seen.add(item.uri);
      return true;
    });
  }, [event]);

  const sections = useMemo(
    () => [
      { key: 'overview', label: 'Aperçu' },
      { key: 'reviews', label: 'Avis' },
      { key: 'photos', label: 'Photos' },
      { key: 'info', label: 'Infos' },
      { key: 'creator', label: 'Créateur' },
    ],
    []
  );

  const { ratingAvg, ratingCount, commentsCount } = useMemo(() => {
    const commentRatings = comments
      .map((comment) => comment.rating)
      .filter((rating): rating is number => typeof rating === 'number' && !Number.isNaN(rating));
    const derivedCount = commentRatings.length;
    const derivedAvg =
      derivedCount > 0
        ? Math.round((commentRatings.reduce((sum, rating) => sum + rating, 0) / derivedCount) * 100) / 100
        : 0;

    return {
      ratingAvg: derivedCount > 0 ? derivedAvg : event?.rating_avg ?? 0,
      ratingCount: derivedCount > 0 ? derivedCount : event?.rating_count ?? 0,
      commentsCount: comments.length > 0 ? comments.length : event?.comments_count ?? 0,
    };
  }, [comments, event]);

  const locationLabel = useMemo(() => {
    if (!event) return '';
    const cityLine = [event.postal_code, event.city].filter(Boolean).join(' ');
    return [event.address, cityLine].filter(Boolean).join(', ') || 'Lieu à venir';
  }, [event]);

  const isLiveNow = useMemo(() => isEventLive(event), [event?.starts_at, event?.ends_at]);

  const overviewStats = useMemo(
    () => {
      if (!event) return [];

      return [
        {
          key: 'favorites',
          label: 'Favoris',
          value: eventStats.favorites,
          icon: <Star size={16} color={colors.warning[600]} fill={colors.warning[600]} />,
        },
        {
          key: 'likes',
          label: 'Likes',
          value: eventStats.likes,
          icon: <Heart size={16} color={colors.error[500]} />,
        },
        {
          key: 'interests',
          label: 'Intéressés',
          value: eventStats.interests,
          icon: <Users size={16} color={colors.brand.secondary} />,
        },
        {
          key: 'checkins',
          label: 'Check-ins',
          value: eventStats.checkins,
          icon: <MapPin size={16} color={colors.brand.secondary} />,
        },
        {
          key: 'reviews',
          label: 'Avis',
          value: commentsCount,
          icon: <MessageSquare size={16} color={colors.brand.secondary} />,
        },
        {
          key: 'rating',
          label: 'Note moy.',
          value: ratingCount > 0 ? ratingAvg.toFixed(1) : '—',
          icon: <Star size={16} color={colors.brand.secondary} fill={colors.brand.secondary} />,
        },
        {
          key: 'photos',
          label: 'Photos',
          value: (event.media_count ?? 0) + communityPhotos.length,
          icon: <ImageIcon size={16} color={colors.brand.secondary} />,
        },
      ];
    },
    [
      commentsCount,
      communityPhotos.length,
      event,
      eventStats.checkins,
      eventStats.favorites,
      eventStats.interests,
      eventStats.likes,
      ratingAvg,
      ratingCount,
    ],
  );

  // 1) Show loading
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.brand.background, alignItems: 'center', justifyContent: 'center' }}>
        <AppBackground />
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  // 2) Show error if no event
  if (!event) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.brand.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <AppBackground />
        <Text style={{ ...typography.h4, color: colors.brand.text, textAlign: 'center' }}>
          Événement introuvable
        </Text>
        <Button
          title="Retour"
          variant="outline"
          onPress={() => router.back()}
          style={{ marginTop: spacing.md }}
        />
      </View>
    );
  }

  const isOwner = !!profile?.id && profile.id === event.creator_id;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'moderateur';
  const handleBack = () => {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace('/(tabs)/map');
    }
  };

  const handleShare = async () => {
    if (isGuest) {
      openGuestGate('Partager cet événement');
      return;
    }
    try {
      const message = `${event.title}${event.external_url ? `\n${event.external_url}` : ''}`;
      await Share.share({ message });
    } catch (err) {
      console.warn('share error', err);
    }
  };

  const handleOpenExternal = async () => {
    if (!event.external_url) return;
    const url = event.external_url.startsWith('http') ? event.external_url : `https://${event.external_url}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  const handleAddPhoto = () => {
    if (isGuest) {
      openGuestGate('Ajouter une photo');
      return;
    }
    if (isOwner || isAdmin) {
      router.push(`/events/create/step-1?edit=${event.id}` as any);
      return;
    }
    setContribModalVisible(true);
  };

  const handleGoToReviews = () => {
    setActiveSection('reviews');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setTimeout(() => commentInputRef.current?.focus(), 200);
  };

  const handleSubmitComment = async () => {
    if (isGuest) {
      openGuestGate('Donner un avis');
      return;
    }
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await addComment(commentText.trim(), commentRating ?? undefined);
      setCommentText('');
      setCommentRating(null);
      reloadComments();
    } catch (e) {
      console.warn('submit comment', e);
      const message = e instanceof Error ? e.message : "Impossible d'envoyer votre avis pour le moment.";
      Alert.alert('Erreur', message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleApproveSubmission = async (submissionId: string) => {
    if (!event || !profile?.id) return;
    try {
      await EventMediaSubmissionsService.updateStatus({
        submissionId,
        status: 'approved',
        reviewerId: profile.id,
      });
      loadCommunityPhotos(event);
    } catch (err) {
      Alert.alert('Erreur', "Impossible d'approuver cette photo.");
    }
  };

  const handleRejectSubmission = async (submissionId: string) => {
    if (!event || !profile?.id) return;
    try {
      await EventMediaSubmissionsService.updateStatus({
        submissionId,
        status: 'rejected',
        reviewerId: profile.id,
      });
      loadCommunityPhotos(event);
    } catch (err) {
      Alert.alert('Erreur', "Impossible de refuser cette photo.");
    }
  };

  const renderOverview = () => (
    <>
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryText}>{getCategoryLabel(event.category || '')}</Text>
      </View>

      <Text style={styles.title}>{event.title}</Text>

      {event.creator ? (
        <TouchableOpacity
          style={styles.creatorRow}
          activeOpacity={0.7}
          onPress={() => {
            if (isGuest) {
              openGuestGate('Accéder à la communauté');
              return;
            }
            router.push(`/community/${event.creator.id}`);
          }}
        >
          {event.creator.avatar_url && <Image source={{ uri: event.creator.avatar_url }} style={styles.avatar} />}
          <Text style={styles.creatorName}>Par {event.creator.display_name}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.creatorRow}>
          <Text style={styles.creatorName}>Par Moments Locaux</Text>
        </View>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleToggleLike}>
          <Heart
            size={24}
            color={event.is_liked ? colors.error[500] : colors.brand.textSecondary}
            fill={event.is_liked ? colors.error[500] : 'transparent'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleToggleFavorite}>
          <Star
            size={24}
            color={event.is_favorited ? colors.warning[500] : colors.brand.textSecondary}
            fill={event.is_favorited ? colors.warning[500] : 'transparent'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Share2 size={24} color={colors.brand.textSecondary} />
        </TouchableOpacity>

        {!isOwner && (
          <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenReport('event', event.id)}>
            <Flag size={22} color={colors.brand.textSecondary} />
          </TouchableOpacity>
        )}

        {(isOwner || isAdmin) && (
          <>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                router.push(`/events/create/step-1?edit=${event.id}` as any);
              }}
            >
              <Edit size={24} color={colors.brand.secondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleDeleteEvent}>
              <Trash2 size={24} color={colors.error[600]} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Engagement Stats Grid (Stitch Style) */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Eye size={20} color={colors.neutral[400]} style={{ marginBottom: 4 }} />
          <Text style={styles.statBoxValue}>
            {eventStats.views > 999
              ? `${(eventStats.views / 1000).toFixed(1)}k`
              : eventStats.views}
          </Text>
        </View>
        <TouchableOpacity style={styles.statBox} onPress={handleToggleLike}>
          <Heart
            size={20}
            color={event.is_liked ? colors.error[500] : colors.error[500]}
            fill={event.is_liked ? colors.error[500] : 'transparent'}
            style={{ marginBottom: 4 }}
          />
          <Text style={styles.statBoxValue}>{eventStats.likes}</Text>
        </TouchableOpacity>
        <View style={styles.statBox}>
          <Users size={20} color={colors.brand.secondary} style={{ marginBottom: 4 }} />
          <Text style={styles.statBoxValue}>{eventStats.checkins + eventStats.interests}</Text>
        </View>
        {ratingCount > 0 && (
          <View style={styles.statBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 4 }}>
              <Star size={20} color="#FBBF24" fill="#FBBF24" />
            </View>
            <Text style={styles.statBoxValue}>{ratingAvg.toFixed(1)}</Text>
            <Text style={styles.statBoxLabel}>{ratingCount} AVIS</Text>
          </View>
        )}
        <View style={styles.statBox}>
          <ImageIcon size={20} color={colors.brand.secondary} style={{ marginBottom: 4 }} />
          <Text style={styles.statBoxValue}>{(event.media_count ?? 0) + communityPhotos.length}</Text>
        </View>
      </View>

      {/* XP Reward Card */}
      <LinearGradient
        colors={[colors.brand.secondary, '#2A4FE3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.xpCard}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.xpTitle}>Gagnez une récompense XP</Text>
          <Text style={styles.xpSubtitle}>
            Participez pour gagner <Text style={{ fontWeight: '800' }}>+50 XP</Text> <Award size={14} color="#FFF" />
          </Text>
        </View>
        <View style={styles.xpIcon}>
          <Zap size={32} color="#FFF" fill="#FFF" />
        </View>
      </LinearGradient>

      {/* Community Facepile */}
      <View style={styles.facepileSection}>
        <View style={styles.facepileRow}>
          {communityPhotos.slice(0, 3).map((photo, i) => (
            <Image
              key={photo.id}
              source={{ uri: photo.url }}
              style={[styles.facepileAvatar, { zIndex: 3 - i }]}
            />
          ))}
          {/* Mock avatars if no community photos */}
          {communityPhotos.length === 0 && (
            <>
              <View style={[styles.facepileAvatar, { backgroundColor: colors.neutral[700], zIndex: 3 }]} />
              <View style={[styles.facepileAvatar, { backgroundColor: colors.neutral[600], zIndex: 2 }]} />
              <View style={[styles.facepileAvatar, { backgroundColor: colors.neutral[500], zIndex: 1 }]} />
            </>
          )}
          <View style={[styles.facepileAvatar, styles.facepileCounter, { zIndex: 0 }]}>
            <Text style={styles.facepileCountText}>+72</Text>
          </View>
        </View>
        <Text style={styles.facepileLabel}>Top fans et amis présents</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Calendrier</Text>
        <TouchableOpacity style={styles.infoCard} activeOpacity={0.8} onPress={openCalendar}>
          <Card padding="md">
            <View style={styles.infoRow}>
              <Calendar size={20} color={colors.primary[600]} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Dates</Text>
                <Text style={styles.infoValue}>{formatDateRange(event.starts_at, event.ends_at)}</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Infos pratiques</Text>
        <Card padding="md" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Clock size={20} color={colors.primary[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Horaire</Text>
              <Text style={styles.infoValue}>{formatTimeRange(event.starts_at, event.ends_at)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <MapPin size={20} color={colors.primary[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Lieu</Text>
              <Text style={styles.infoValue}>{locationLabel}</Text>
            </View>
          </View>

          {event.interests_count > 0 && (
            <View style={styles.infoRow}>
              <Users size={20} color={colors.primary[600]} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Intéressés</Text>
                <Text style={styles.infoValue}>
                  {event.interests_count} personne{event.interests_count > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{event.description}</Text>
      </View>

      {event.tags && event.tags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagsContainer}>
            {event.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {!isOwner && (
        <View style={styles.section}>
          <Button title="Check-in" onPress={handleCheckIn} variant="secondary" fullWidth />
        </View>
      )}
    </>
  );

  const renderReviews = () => (
    <>
      <View style={styles.ratingSummary}>
        <Text style={styles.ratingValue}>{ratingAvg.toFixed(1)}</Text>
        <View style={styles.ratingMeta}>
          <Text style={styles.ratingMetaText}>{ratingCount} note{ratingCount > 1 ? 's' : ''}</Text>
          <Text style={styles.ratingMetaText}>{commentsCount} avis</Text>
        </View>
      </View>

      {loadingComments ? (
        <ActivityIndicator color={colors.primary[600]} />
      ) : comments.length === 0 ? (
        <Text style={styles.emptyComments}>Aucun avis pour le moment</Text>
      ) : (
        <View>
          {comments.map((comment) => (
            <Card key={comment.id} padding="md" style={styles.commentCard}>
              <View style={styles.commentHeader}>
                {comment.author?.avatar_url ? (
                  <Image source={{ uri: comment.author.avatar_url }} style={styles.commentAvatar} />
                ) : (
                  <View style={[styles.commentAvatar, styles.commentAvatarFallback]} />
                )}
                <Text style={styles.commentAuthor}>{comment.author?.display_name || 'Utilisateur'}</Text>
                {typeof comment.rating === 'number' && (
                  <View style={styles.commentRating}>
                    <Star size={14} color={colors.primary[600]} fill={colors.primary[600]} />
                    <Text style={styles.commentRatingText}>{comment.rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.commentContent}>{comment.message}</Text>
              <View style={styles.commentActions}>
                <TouchableOpacity
                  style={styles.commentActionButton}
                  onPress={() => handleToggleCommentLike(comment.id)}
                >
                  <Heart
                    size={16}
                    color={likedComments.has(comment.id) ? colors.error[500] : colors.neutral[500]}
                    fill={likedComments.has(comment.id) ? colors.error[500] : 'transparent'}
                  />
                  <Text style={styles.commentActionText}>J’aime</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.commentActionButton}
                  onPress={() => handleOpenReport('comment', comment.id)}
                >
                  <Flag size={16} color={colors.neutral[500]} />
                  <Text style={styles.commentActionText}>Signaler</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      )}

      {isGuest ? (
        <Button title="Donner un avis" onPress={() => openGuestGate('Donner un avis')} fullWidth />
      ) : (
        <Card padding="md" style={styles.commentInputCard}>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((value) => {
              const active = (commentRating ?? 0) >= value;
              return (
                <TouchableOpacity key={value} onPress={() => setCommentRating(value)}>
                  <Star
                    size={20}
                    color={active ? colors.primary[600] : colors.neutral[300]}
                    fill={active ? colors.primary[600] : 'transparent'}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            ref={commentInputRef}
            style={styles.commentInput}
            placeholder="Partager votre avis"
            value={commentText}
            onChangeText={setCommentText}
            multiline
          />
          <Button
            title="Publier"
            onPress={handleSubmitComment}
            loading={submittingComment}
            disabled={!commentText.trim()}
            fullWidth
          />
        </Card>
      )}
    </>
  );

  const renderPhotos = () => (
    <>
      <View style={styles.photoSection}>
        <Text style={styles.sectionTitle}>Photos de l&apos;organisateur</Text>
        {mediaUrls.length === 0 ? (
          <View style={styles.emptyPhotos}>
            <ImageIcon size={28} color={colors.neutral[400]} />
            <Text style={styles.emptyPhotosText}>Aucune photo pour le moment</Text>
          </View>
        ) : (
          <View style={styles.photoGrid}>
            {mediaUrls.map((url) => (
              <Image key={url} source={{ uri: url }} style={styles.photoItem} />
            ))}
          </View>
        )}
      </View>

      <View style={styles.photoSection}>
        <Text style={styles.sectionTitle}>Photos de la communauté</Text>
        {loadingCommunityPhotos ? (
          <ActivityIndicator color={colors.primary[600]} />
        ) : communityPhotos.length === 0 ? (
          <View style={styles.emptyPhotos}>
            <ImageIcon size={28} color={colors.neutral[400]} />
            <Text style={styles.emptyPhotosText}>Aucune photo pour le moment</Text>
          </View>
        ) : (
          <View style={styles.photoGrid}>
            {communityPhotos.map((photo) => (
              <View key={photo.id} style={styles.photoTile}>
                <Image source={{ uri: photo.url }} style={styles.photoItem} />
                <View style={styles.photoActions}>
                  <TouchableOpacity onPress={() => handleToggleMediaLike(photo.id)}>
                    <Heart
                      size={16}
                      color={likedMedia.has(photo.id) ? colors.error[500] : colors.neutral[600]}
                      fill={likedMedia.has(photo.id) ? colors.error[500] : 'transparent'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleOpenReport('media', photo.id)}>
                    <Flag size={16} color={colors.neutral[600]} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {(isOwner || isAdmin) && pendingPhotos.length > 0 ? (
        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>En attente de validation</Text>
          <View style={styles.pendingGrid}>
            {pendingPhotos.map((photo) => (
              <View key={photo.id} style={styles.pendingItem}>
                <Image source={{ uri: photo.url }} style={styles.pendingImage} />
                <View style={styles.pendingActions}>
                  <TouchableOpacity
                    style={styles.pendingApprove}
                    onPress={() => handleApproveSubmission(photo.id)}
                  >
                    <Text style={styles.pendingApproveText}>Valider</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pendingReject}
                    onPress={() => handleRejectSubmission(photo.id)}
                  >
                    <Text style={styles.pendingRejectText}>Refuser</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Button title="Ajouter une photo" onPress={handleAddPhoto} fullWidth />
    </>
  );

  const renderInfo = () => (
    <>
      <Card padding="md" style={styles.infoCard}>
        <View style={styles.infoRow}>
          <MapPin size={20} color={colors.primary[600]} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Adresse</Text>
            <Text style={styles.infoValue}>{locationLabel}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Clock size={20} color={colors.primary[600]} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Horaires</Text>
            <Text style={styles.infoValue}>{formatTimeRange(event.starts_at, event.ends_at)}</Text>
          </View>
        </View>
        {event.external_url ? (
          <TouchableOpacity style={styles.infoRow} onPress={handleOpenExternal}>
            <ExternalLink size={20} color={colors.primary[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Lien externe</Text>
              <Text style={styles.infoValue}>{event.external_url}</Text>
            </View>
          </TouchableOpacity>
        ) : null}
        {event.contact_email ? (
          <View style={styles.infoRow}>
            <Mail size={20} color={colors.primary[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{event.contact_email}</Text>
            </View>
          </View>
        ) : null}
        {event.contact_phone ? (
          <View style={styles.infoRow}>
            <Phone size={20} color={colors.primary[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Téléphone</Text>
              <Text style={styles.infoValue}>{event.contact_phone}</Text>
            </View>
          </View>
        ) : null}
      </Card>
    </>
  );

  const renderCreator = () => {
    if (!event.creator) {
      return (
        <Card padding="md" style={styles.creatorCard}>
          <View style={styles.creatorCardRow}>
            <View style={[styles.creatorCardAvatar, styles.creatorCardAvatarFallback]} />
            <View style={styles.creatorCardInfo}>
              <Text style={styles.creatorCardName}>Moments Locaux</Text>
              <Text style={styles.creatorCardMeta}>Événement importé</Text>
            </View>
          </View>
        </Card>
      );
    }

    return (
      <>
        <Card padding="md" style={styles.creatorCard}>
          <View style={styles.creatorCardRow}>
            {event.creator.avatar_url ? (
              <Image source={{ uri: event.creator.avatar_url }} style={styles.creatorCardAvatar} />
            ) : (
              <View style={[styles.creatorCardAvatar, styles.creatorCardAvatarFallback]} />
            )}
            <View style={styles.creatorCardInfo}>
              <Text style={styles.creatorCardName}>{event.creator.display_name}</Text>
              {event.creator.city ? <Text style={styles.creatorCardMeta}>{event.creator.city}</Text> : null}
            </View>
            <TouchableOpacity
              style={styles.creatorCardAction}
              onPress={() => {
                if (isGuest) {
                  openGuestGate('Accéder à la communauté');
                  return;
                }
                router.push(`/community/${event.creator.id}` as any);
              }}
            >
              <Text style={styles.creatorCardLink}>Voir</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {creatorEvents.length > 0 ? (
          <View style={styles.creatorEvents}>
            <Text style={styles.sectionTitle}>Autres événements</Text>
            {creatorEvents.map((evt) => (
              <TouchableOpacity
                key={evt.id}
                style={styles.creatorEventRow}
                onPress={() => router.push(`/events/${evt.id}` as any)}
              >
                <Text style={styles.creatorEventTitle}>{evt.title}</Text>
                <Text style={styles.creatorEventMeta}>{evt.city || evt.address || ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </>
    );
  };


  const openCalendar = async () => {
    const start = new Date(event.starts_at);
    if (isNaN(start.getTime())) return;
    const end = event.ends_at ? new Date(event.ends_at) : start;
    const endDate = isNaN(end.getTime()) ? start : end;
    const startMs = start.getTime();

    if (Platform.OS === 'ios') {
      await Linking.openURL(`calshow:${startMs}`);
      return;
    }

    if (Platform.OS === 'android') {
      const androidUrl = `content://com.android.calendar/time/${startMs}`;
      const canOpen = await Linking.canOpenURL(androidUrl);
      if (canOpen) {
        await Linking.openURL(androidUrl);
        return;
      }
    }

    const calendarUrl =
      'https://www.google.com/calendar/render' +
      `?action=TEMPLATE&text=${encodeURIComponent(event.title || 'Événement')}` +
      `&dates=${encodeURIComponent(`${formatCalendarDate(start)}/${formatCalendarDate(endDate)}`)}` +
      `&details=${encodeURIComponent(event.description || '')}` +
      `&location=${encodeURIComponent(locationLabel)}`;

    await Linking.openURL(calendarUrl);
  };

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleBack}>
            <ChevronLeft size={22} color={colors.neutral[700]} />
          </TouchableOpacity>
        </View>

        <StatusBar barStyle="light-content" />
        <View style={styles.heroContainer}>
          <PlaceMediaGallery images={mediaImages} onAddPhoto={handleAddPhoto}>
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.sectionTabs}
            contentContainerStyle={styles.sectionTabsContent}
          >
            {sections.map((section) => {
              const isActive = activeSection === section.key;
              return (
                <TouchableOpacity
                  key={section.key}
                  style={[styles.sectionTab, isActive && styles.sectionTabActive]}
                  onPress={() => setActiveSection(section.key as typeof activeSection)}
                >
                  <Text style={[styles.sectionTabText, isActive && styles.sectionTabTextActive]}>{section.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Animated.View style={[styles.sectionContent, { opacity: sectionOpacity }]}>
            {activeSection === 'overview' && renderOverview()}
            {activeSection === 'reviews' && renderReviews()}
            {activeSection === 'photos' && renderPhotos()}
            {activeSection === 'info' && renderInfo()}
            {activeSection === 'creator' && renderCreator()}
          </Animated.View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bottomBarContent}>
          <TouchableOpacity style={styles.bottomBarCta} onPress={() => setNavSheetVisible(true)}>
            <Navigation2 size={20} color={colors.neutral[700]} />
            <Text style={styles.bottomBarText}>Itinéraire</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarCta} onPress={handleToggleFavorite}>
            <Star
              size={20}
              color={event.is_favorited ? colors.warning[500] : colors.neutral[700]}
              fill={event.is_favorited ? colors.warning[500] : 'transparent'}
            />
            <Text style={styles.bottomBarText}>Favori</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarCta} onPress={handleToggleLike}>
            <Heart
              size={20}
              color={event.is_liked ? colors.error[500] : colors.neutral[700]}
              fill={event.is_liked ? colors.error[500] : 'transparent'}
            />
            <Text style={styles.bottomBarText}>Like</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarCta} onPress={handleShare}>
            <Share2 size={20} color={colors.neutral[700]} />
            <Text style={styles.bottomBarText}>Partager</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarCta} onPress={handleGoToReviews}>
            <Edit size={20} color={colors.neutral[700]} />
            <Text style={styles.bottomBarText}>Publier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarCta} onPress={handleAddPhoto}>
            <ImageIcon size={20} color={colors.neutral[700]} />
            <Text style={styles.bottomBarText}>Ajouter</Text>
          </TouchableOpacity>
          {event.external_url ? (
            <TouchableOpacity style={styles.bottomBarCta} onPress={handleOpenExternal}>
              <ExternalLink size={20} color={colors.neutral[700]} />
              <Text style={styles.bottomBarText}>Lien</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>

      <NavigationOptionsSheet
        visible={navSheetVisible}
        event={event}
        onClose={() => setNavSheetVisible(false)}
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

      {event && profile?.id ? (
        <EventPhotoContributionModal
          visible={contribModalVisible}
          eventId={event.id}
          userId={profile.id}
          onClose={() => setContribModalVisible(false)}
          onSubmitted={() => loadCommunityPhotos(event)}
        />
      ) : null}

      <ReportReasonModal
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        onSelect={handleReportReason}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.error[500],
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  content: {
    padding: spacing.lg,
  },
  sectionTabs: {
    marginBottom: spacing.lg,
  },
  sectionTabsContent: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  sectionTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sectionTabActive: {
    backgroundColor: colors.brand.secondary,
  },
  sectionTabText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  sectionTabTextActive: {
    color: '#0f1719',
  },
  sectionContent: {
    minHeight: 200,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  categoryText: {
    color: colors.brand.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  fallbackSubtext: {
    marginTop: spacing.sm,
    textAlign: 'center',
    color: colors.brand.textSecondary,
    fontSize: 14,
  },
  title: {
    ...typography.h2,
    color: colors.brand.text,
    marginBottom: spacing.md,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  creatorName: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  infoCard: {
    marginBottom: 0,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  infoContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginBottom: spacing.xs,
  },
  infoValue: {
    ...typography.body,
    color: colors.brand.text,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.brand.text,
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    marginBottom: spacing.md,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: (width - spacing.lg * 2 - spacing.sm) / 2,
    marginBottom: 0,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  statIconWrap: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  statLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  statValue: {
    ...typography.h5,
    color: colors.brand.text,
  },
  description: {
    ...typography.body,
    color: colors.brand.text,
    lineHeight: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  tagText: {
    ...typography.bodySmall,
    color: colors.brand.text,
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  ratingValue: {
    ...typography.h2,
    color: colors.brand.text,
  },
  ratingMeta: {
    gap: 2,
  },
  ratingMetaText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  emptyComments: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.md,
  },
  commentCard: {
    marginBottom: spacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  commentAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  commentAuthor: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.brand.text,
  },
  commentRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  commentRatingText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  commentContent: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  commentActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  commentActionText: {
    ...typography.caption,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  // Gamification Styles
  heroContainer: {
    position: 'relative',
  },
  heroBadges: {
    position: 'absolute',
    bottom: 12, // Adjusted to sit above the gradient/add button
    left: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
    maxWidth: '65%', // Prevent overlap with Add Photo button
    flexWrap: 'wrap',
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
  },
  heroBadgeLive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)', // Emerald-500/20
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backdropFilter: 'blur(12px)', // Note: backdropFilter needs specific handling in RN, but backgroundColor alpha helps
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroBadgeTextLive: {
    color: '#34D399', // Emerald-400
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  statBox: {
    flex: 1,
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
    marginBottom: spacing.lg,
    shadowColor: colors.brand.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  xpTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  xpSubtitle: {
    color: 'rgba(255,255,255,0.8)',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: -12,
    borderWidth: 2,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.brand.background,
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
  commentInputCard: {
    marginBottom: spacing.md,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  commentInput: {
    ...typography.body,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
    color: colors.brand.text,
  },
  participateButton: {
    marginBottom: spacing.md,
  },
  ownerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  ownerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  ownerText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  deleteText: {
    color: '#ef4444',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  photoTile: {
    width: PHOTO_SIZE,
    gap: spacing.xs,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: borderRadius.md,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  photoSection: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  pendingGrid: {
    gap: spacing.sm,
  },
  pendingItem: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  pendingImage: {
    width: '100%',
    height: 180,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  pendingActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  pendingApprove: {
    flex: 1,
    backgroundColor: colors.brand.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  pendingApproveText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  pendingReject: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pendingRejectText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  emptyPhotos: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyPhotosText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  creatorCard: {
    marginBottom: spacing.md,
  },
  creatorCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
  },
  creatorCardAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  creatorCardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  creatorCardName: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
  },
  creatorCardMeta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: spacing.xs,
  },
  creatorCardAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  creatorCardLink: {
    ...typography.caption,
    color: colors.brand.text,
    fontWeight: '600',
  },
  creatorEvents: {
    gap: spacing.sm,
  },
  creatorEventRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  creatorEventTitle: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  creatorEventMeta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: spacing.xs,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.brand.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: spacing.sm,
  },
  bottomBarContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  bottomBarCta: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  bottomBarText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: spacing.xs,
  },
});
