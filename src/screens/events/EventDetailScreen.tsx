import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Platform,
  Share,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Heart,
  Eye,
  MapPin,
  Calendar,
  Clock,
  Users,
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
  MessageCircle,
} from 'lucide-react-native';
import { AppBackground, Button, Card } from '@/components/ui/v2';
import { EventsService } from '../../services/events.service';
import { SocialService } from '../../services/social.service';
import { CommunityService } from '@/services/community.service';
import { useAuth } from '../../hooks';
import { colors, spacing, typography, borderRadius } from '@/components/ui/v2/theme';
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

const { width } = Dimensions.get('window');
const BOTTOM_BAR_HEIGHT = 96;
const PHOTO_SIZE = Math.floor((width - spacing.lg * 2 - spacing.sm * 2) / 3);

type EventAttendee = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  checkedInAt: string;
};

type XpCardData = {
  rewardAmount: number;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  progress: number;
};

const V2 = {
  bg: '#0f1719',
  surface: '#1a2426',
  surface2: '#243133',
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  primary: '#2bbfe3',
  border: 'rgba(148,163,184,0.22)',
};

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
  const [navSheetVisible, setNavSheetVisible] = useState(false);
  const [creatorEvents, setCreatorEvents] = useState<EventWithCreator[]>([]);
  const [communityPhotos, setCommunityPhotos] = useState<EventMediaSubmission[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<EventMediaSubmission[]>([]);
  const [eventStats, setEventStats] = useState({
    views: 0,
    likes: 0,
    favorites: 0,
    interests: 0,
    checkins: 0,
  });
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [friendsAttendingCount, setFriendsAttendingCount] = useState(0);
  const [isFollowingCreator, setIsFollowingCreator] = useState(false);
  const [creatorFollowersCount, setCreatorFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [commentLikesCount, setCommentLikesCount] = useState<Record<string, number>>({});
  const [xpCardData, setXpCardData] = useState<XpCardData>({
    rewardAmount: 50,
    level: 1,
    currentXp: 0,
    nextLevelXp: 100,
    progress: 0,
  });
  const [loadingCommunityPhotos, setLoadingCommunityPhotos] = useState(false);
  const [contribModalVisible, setContribModalVisible] = useState(false);
  const commentInputRef = useRef<TextInput>(null);
  const isGuest = !session;

  const openGuestGate = (title: string) => setGuestGate({ visible: true, title });
  const closeGuestGate = () => setGuestGate({ visible: false, title: '' });

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
      const [engagementResp, likesResp, favoritesResp, interestsResp, checkinsResp, viewsResp] = await Promise.all([
        supabase
          .from('event_engagement_stats')
          .select('likes_count, favorites_count, checkins_count, views_count')
          .eq('event_id', eventId)
          .maybeSingle(),
        supabase.from('event_likes').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('favorites').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_interests').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_checkins').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_views').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
      ]);

      if (engagementResp.error) throw engagementResp.error;
      if (likesResp.error) throw likesResp.error;
      if (favoritesResp.error) throw favoritesResp.error;
      if (interestsResp.error) throw interestsResp.error;
      if (checkinsResp.error) throw checkinsResp.error;
      if (viewsResp.error) throw viewsResp.error;

      const engagement = engagementResp.data;
      const likesCount = likesResp.count ?? engagement?.likes_count ?? 0;
      const favoritesCount = favoritesResp.count ?? engagement?.favorites_count ?? 0;
      const checkinsCount = checkinsResp.count ?? engagement?.checkins_count ?? 0;
      const viewsCount = (engagement?.views_count ?? 0) > 0 ? engagement?.views_count ?? 0 : viewsResp.count ?? 0;

      setEventStats({
        views: viewsCount,
        likes: likesCount,
        favorites: favoritesCount,
        interests: interestsResp.count || 0,
        checkins: checkinsCount,
      });
    } catch (error) {
      console.warn('load event stats', error);
    }
  }, []);

  const loadEventDetails = useCallback(async () => {
    if (!id) return;
    const data = await EventsService.getEventById(id);
    const withSocialFlags = data
      ? { ...data, is_favorited: isFavorite(data.id), is_liked: isLiked(data.id) }
      : null;
    setEvent(withSocialFlags);
    setLoading(false);
    if (withSocialFlags) {
      loadCommunityPhotos(withSocialFlags);
      loadEventStats(withSocialFlags.id);
    } else {
      setEventStats({ views: 0, likes: 0, favorites: 0, interests: 0, checkins: 0 });
    }
  }, [id, isFavorite, isLiked, loadCommunityPhotos, loadEventStats]);

  useEffect(() => {
    loadEventDetails();
  }, [loadEventDetails]);

  useFocusEffect(
    useCallback(() => {
      loadEventDetails();
    }, [loadEventDetails])
  );

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
    if (event) {
      loadCommunityPhotos(event);
    }
  }, [event, loadCommunityPhotos]);

  const loadAttendees = useCallback(
    async (eventId: string) => {
      try {
        const { data, error } = await supabase
          .from('event_checkins')
          .select('user_id, created_at, profiles!event_checkins_user_id_fkey(id, display_name, avatar_url)')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(80);
        if (error) throw error;

        const byUser = new Map<string, EventAttendee>();
        (data || []).forEach((row: any) => {
          const userId = row.user_id as string | null;
          if (!userId || byUser.has(userId)) return;
          byUser.set(userId, {
            userId,
            displayName: row.profiles?.display_name || 'Membre',
            avatarUrl: row.profiles?.avatar_url || null,
            checkedInAt: row.created_at,
          });
        });

        const uniqueAttendees = Array.from(byUser.values());
        setAttendees(uniqueAttendees);

        if (!profile?.id || uniqueAttendees.length === 0) {
          setFriendsAttendingCount(0);
          return;
        }

        const attendeeIds = uniqueAttendees.map((attendee) => attendee.userId).filter((uid) => uid !== profile.id);
        if (attendeeIds.length === 0) {
          setFriendsAttendingCount(0);
          return;
        }

        const { data: followsRows, error: followsError } = await supabase
          .from('follows')
          .select('following')
          .eq('follower', profile.id)
          .in('following', attendeeIds);
        if (followsError) throw followsError;
        setFriendsAttendingCount((followsRows || []).length);
      } catch (error) {
        console.warn('load attendees', error);
      }
    },
    [profile?.id],
  );

  const loadCreatorFollowState = useCallback(
    async (creatorId: string) => {
      try {
        const { count, error } = await supabase
          .from('follows')
          .select('following', { count: 'exact', head: true })
          .eq('following', creatorId);
        if (error) throw error;
        setCreatorFollowersCount(count || 0);

        if (!profile?.id || profile.id === creatorId) {
          setIsFollowingCreator(false);
          return;
        }

        const { data: relation, error: relationError } = await supabase
          .from('follows')
          .select('following')
          .eq('follower', profile.id)
          .eq('following', creatorId)
          .limit(1);
        if (relationError) throw relationError;
        setIsFollowingCreator((relation || []).length > 0);
      } catch (error) {
        console.warn('load creator follow state', error);
      }
    },
    [profile?.id],
  );

  const loadXpCardData = useCallback(async () => {
    if (isGuest) {
      setXpCardData((prev) => ({ ...prev, rewardAmount: 50 }));
      return;
    }
    try {
      const { data: rewardRule, error: rewardError } = await supabase
        .from('xp_rules')
        .select('amount')
        .eq('active', true)
        .or('trigger_event.ilike.%checkin%,code.ilike.%checkin%')
        .order('amount', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (rewardError) throw rewardError;
      const rewardAmount = Number(rewardRule?.amount ?? 50);

      if (!profile?.id) {
        setXpCardData((prev) => ({ ...prev, rewardAmount }));
        return;
      }

      const [levelResp, userXpResp, legacyXpResp] = await Promise.all([
        supabase
          .from('user_levels')
          .select('level, next_level_xp')
          .eq('user_id', profile.id)
          .maybeSingle(),
        supabase.from('user_xp').select('xp').eq('user_id', profile.id).maybeSingle(),
        supabase.from('xp').select('xp').eq('user_id', profile.id).maybeSingle(),
      ]);

      if (levelResp.error) throw levelResp.error;
      if (userXpResp.error) throw userXpResp.error;
      if (legacyXpResp.error) throw legacyXpResp.error;

      const level = Number(levelResp.data?.level ?? 1);
      const nextLevelXp = Math.max(1, Number(levelResp.data?.next_level_xp ?? 100));
      const rawXp = Number(userXpResp.data?.xp ?? legacyXpResp.data?.xp ?? 0);
      const normalizedXp = rawXp > nextLevelXp ? rawXp % nextLevelXp : rawXp;
      const progress = Math.max(0, Math.min(normalizedXp / nextLevelXp, 1));

      setXpCardData({
        rewardAmount,
        level,
        currentXp: rawXp,
        nextLevelXp,
        progress,
      });
    } catch (error) {
      console.warn('load xp card data', error);
    }
  }, [isGuest, profile?.id]);

  const loadCommentLikeState = useCallback(
    async (commentIds: string[]) => {
      if (commentIds.length === 0) {
        setCommentLikesCount({});
        setLikedComments(new Set());
        return;
      }
      try {
        const { data, error } = await supabase
          .from('comment_likes')
          .select('comment_id, user_id')
          .in('comment_id', commentIds);
        if (error) throw error;

        const counts: Record<string, number> = {};
        commentIds.forEach((commentId) => {
          counts[commentId] = 0;
        });

        const likedByMe = new Set<string>();
        (data || []).forEach((row: any) => {
          const commentId = row.comment_id as string;
          counts[commentId] = (counts[commentId] || 0) + 1;
          if (profile?.id && row.user_id === profile.id) {
            likedByMe.add(commentId);
          }
        });

        setCommentLikesCount(counts);
        setLikedComments(likedByMe);
      } catch (error) {
        console.warn('load comment like state', error);
      }
    },
    [profile?.id],
  );

  useEffect(() => {
    if (!event?.id) return;
    loadAttendees(event.id);
  }, [event?.id, loadAttendees]);

  useEffect(() => {
    if (!event?.creator_id) return;
    loadCreatorFollowState(event.creator_id);
  }, [event?.creator_id, loadCreatorFollowState]);

  useEffect(() => {
    loadXpCardData();
  }, [loadXpCardData, event?.id]);

  useEffect(() => {
    loadCommentLikeState(comments.map((comment) => comment.id));
  }, [comments, loadCommentLikeState]);

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
      const wasLiked = likedComments.has(commentId);
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
      setCommentLikesCount((prev) => {
        const currentCount = prev[commentId] ?? 0;
        return {
          ...prev,
          [commentId]: Math.max(0, currentCount + (wasLiked ? -1 : 1)),
        };
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
        await Promise.all([
          loadEventStats(event.id),
          loadAttendees(event.id),
          loadXpCardData(),
        ]);
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

  const handleToggleFollowCreator = async () => {
    if (!event?.creator_id || !profile?.id) {
      if (isGuest) {
        openGuestGate('Suivre cet organisateur');
      }
      return;
    }
    if (profile.id === event.creator_id || followLoading) return;

    const previousFollowing = isFollowingCreator;
    const previousFollowersCount = creatorFollowersCount;
    const nextFollowing = !previousFollowing;
    setIsFollowingCreator(nextFollowing);
    setCreatorFollowersCount((prev) => Math.max(0, prev + (nextFollowing ? 1 : -1)));
    setFollowLoading(true);

    try {
      if (nextFollowing) {
        await CommunityService.follow(event.creator_id);
      } else {
        await CommunityService.unfollow(event.creator_id);
      }
    } catch (error) {
      setIsFollowingCreator(previousFollowing);
      setCreatorFollowersCount(previousFollowersCount);
      console.warn('toggle creator follow', error);
      Alert.alert('Erreur', "Impossible de mettre à jour le suivi pour le moment.");
    } finally {
      setFollowLoading(false);
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

  const heroStats = useMemo(
    () => [
      {
        key: 'views',
        label: 'Vues',
        value: eventStats.views >= 1000 ? `${(eventStats.views / 1000).toFixed(1)}k` : eventStats.views,
        icon: <Eye size={16} color={colors.scale.neutral[500]} />,
      },
      {
        key: 'likes',
        label: 'Likes',
        value: eventStats.likes,
        icon: <Heart size={16} color={colors.scale.error[500]} fill={eventStats.likes > 0 ? colors.scale.error[500] : 'transparent'} />,
      },
      {
        key: 'checkins',
        label: 'Présences',
        value: eventStats.checkins,
        icon: <MapPin size={16} color={colors.scale.primary[600]} />,
      },
      {
        key: 'rating',
        label: 'Note',
        value: ratingCount > 0 ? ratingAvg.toFixed(1) : '—',
        subtitle: ratingCount > 0 ? `${ratingCount} avis` : 'Aucun avis',
        icon: <Star size={16} color={colors.scale.warning[600]} fill={colors.scale.warning[600]} />,
      },
    ],
    [eventStats.checkins, eventStats.likes, eventStats.views, ratingAvg, ratingCount],
  );

  const isLiveNow = useMemo(() => {
    if (!event?.starts_at) return false;
    const startsAt = new Date(event.starts_at).getTime();
    const endsAt = event.ends_at ? new Date(event.ends_at).getTime() : startsAt + 3 * 60 * 60 * 1000;
    if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return false;
    const now = Date.now();
    return now >= Math.min(startsAt, endsAt) && now <= Math.max(startsAt, endsAt);
  }, [event?.ends_at, event?.starts_at]);

  const priceLabel = useMemo(() => {
    if (!event?.price) return 'Gratuit';
    const numericPrice =
      typeof event.price === 'number' ? event.price : Number.parseFloat(String(event.price));
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) return 'Gratuit';
    return `${numericPrice % 1 === 0 ? numericPrice.toFixed(0) : numericPrice.toFixed(2)}€`;
  }, [event?.price]);

  const communityPreview = useMemo(() => comments.slice(0, 2), [comments]);

  const topAttendees = useMemo(() => attendees.slice(0, 4), [attendees]);

  const attendeesLabel = useMemo(() => {
    const total = attendees.length > 0 ? attendees.length : eventStats.checkins;
    if (total === 0) return 'Soyez le premier à valider votre présence';
    if (friendsAttendingCount > 0) {
      const others = Math.max(total - friendsAttendingCount, 0);
      if (others > 0) {
        return `${friendsAttendingCount} ami${friendsAttendingCount > 1 ? 's' : ''} + ${others} participant${others > 1 ? 's' : ''}`;
      }
      return `${friendsAttendingCount} ami${friendsAttendingCount > 1 ? 's' : ''} participe`;
    }
    return `${total} participant${total > 1 ? 's' : ''} présent${total > 1 ? 's' : ''}`;
  }, [attendees.length, eventStats.checkins, friendsAttendingCount]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <AppBackground opacity={0.2} />
        <ActivityIndicator size="large" color={colors.scale.primary[600]} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.loadingContainer}>
        <AppBackground opacity={0.2} />
        <Text style={styles.errorText}>Événement introuvable</Text>
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
    } catch {
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
    } catch {
      Alert.alert('Erreur', "Impossible de refuser cette photo.");
    }
  };

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
        <ActivityIndicator color={colors.scale.primary[600]} />
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
                    <Star size={14} color={colors.scale.primary[600]} fill={colors.scale.primary[600]} />
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
                    color={likedComments.has(comment.id) ? colors.scale.error[500] : colors.scale.neutral[500]}
                    fill={likedComments.has(comment.id) ? colors.scale.error[500] : 'transparent'}
                  />
                  <Text style={styles.commentActionText}>J’aime</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.commentActionButton}
                  onPress={() => handleOpenReport('comment', comment.id)}
                >
                  <Flag size={16} color={colors.scale.neutral[500]} />
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
                    color={active ? colors.scale.primary[600] : colors.scale.neutral[300]}
                    fill={active ? colors.scale.primary[600] : 'transparent'}
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
            <ImageIcon size={28} color={colors.scale.neutral[400]} />
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
          <ActivityIndicator color={colors.scale.primary[600]} />
        ) : communityPhotos.length === 0 ? (
          <View style={styles.emptyPhotos}>
            <ImageIcon size={28} color={colors.scale.neutral[400]} />
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
                      color={likedMedia.has(photo.id) ? colors.scale.error[500] : colors.scale.neutral[600]}
                      fill={likedMedia.has(photo.id) ? colors.scale.error[500] : 'transparent'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleOpenReport('media', photo.id)}>
                    <Flag size={16} color={colors.scale.neutral[600]} />
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
          <MapPin size={20} color={colors.scale.primary[600]} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Adresse</Text>
            <Text style={styles.infoValue}>{locationLabel}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Clock size={20} color={colors.scale.primary[600]} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Horaires</Text>
            <Text style={styles.infoValue}>{formatTimeRange(event.starts_at, event.ends_at)}</Text>
          </View>
        </View>
        {event.external_url ? (
          <TouchableOpacity style={styles.infoRow} onPress={handleOpenExternal}>
            <ExternalLink size={20} color={colors.scale.primary[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Lien externe</Text>
              <Text style={styles.infoValue}>{event.external_url}</Text>
            </View>
          </TouchableOpacity>
        ) : null}
        {event.contact_email ? (
          <View style={styles.infoRow}>
            <Mail size={20} color={colors.scale.primary[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{event.contact_email}</Text>
            </View>
          </View>
        ) : null}
        {event.contact_phone ? (
          <View style={styles.infoRow}>
            <Phone size={20} color={colors.scale.primary[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Téléphone</Text>
              <Text style={styles.infoValue}>{event.contact_phone}</Text>
            </View>
          </View>
        ) : null}
      </Card>
    </>
  );

  const renderCreator = () => (
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
            <Text style={styles.creatorCardMeta}>
              {creatorFollowersCount} abonné{creatorFollowersCount > 1 ? 's' : ''}
              {event.creator.city ? ` • ${event.creator.city}` : ''}
            </Text>
          </View>
          {!isOwner ? (
            <TouchableOpacity
              style={[styles.creatorCardFollowButton, isFollowingCreator && styles.creatorCardFollowButtonActive]}
              onPress={handleToggleFollowCreator}
              disabled={followLoading}
              accessibilityRole="button"
            >
              <Text
                style={[styles.creatorCardFollowLabel, isFollowingCreator && styles.creatorCardFollowLabelActive]}
              >
                {followLoading ? '...' : isFollowingCreator ? 'Suivi' : 'Suivre'}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.creatorCardAction}
            onPress={() => {
              if (isGuest) {
                openGuestGate('Accéder à la communauté');
                return;
              }
              router.push(`/community/${event.creator.id}` as any);
            }}
            accessibilityRole="button"
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
      <AppBackground opacity={0.2} />
      <View style={styles.screen}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroWrapper}>
            <PlaceMediaGallery images={mediaImages} onAddPhoto={handleAddPhoto} />

            <View style={[styles.heroActions, { top: insets.top + spacing.xs }]}>
              <TouchableOpacity style={styles.topCircleButton} onPress={handleBack}>
                <ChevronLeft size={22} color={V2.textPrimary} />
              </TouchableOpacity>

              <View style={styles.topCircleActionsRight}>
                {!isOwner && (
                  <TouchableOpacity style={styles.topCircleButton} onPress={() => handleOpenReport('event', event.id)}>
                    <Flag size={18} color={V2.textPrimary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.topCircleButton} onPress={handleShare}>
                  <Share2 size={20} color={V2.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.topCircleButton} onPress={handleToggleLike}>
                  <Heart
                    size={20}
                    color={event.is_liked ? colors.scale.error[500] : V2.textPrimary}
                    fill={event.is_liked ? colors.scale.error[500] : 'transparent'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.chipRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{getCategoryLabel(event.category || '')}</Text>
              </View>
              {isLiveNow ? (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>En cours</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.title}>{event.title}</Text>

            <Card padding="md" style={styles.headlineCard}>
              <TouchableOpacity style={styles.infoRow} activeOpacity={0.8} onPress={openCalendar}>
                <Calendar size={20} color={colors.scale.primary[600]} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Date et heure</Text>
                  <Text style={styles.infoValue}>{formatTimeRange(event.starts_at, event.ends_at)}</Text>
                  <Text style={styles.infoMeta}>{formatDateRange(event.starts_at, event.ends_at)}</Text>
                </View>
                <Text style={styles.priceValue}>{priceLabel}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.infoRow} onPress={() => setNavSheetVisible(true)}>
                <MapPin size={20} color={colors.scale.primary[600]} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Lieu</Text>
                  <Text style={styles.infoValue}>{locationLabel}</Text>
                </View>
                <Text style={styles.inlineAction}>Voir tout</Text>
              </TouchableOpacity>
            </Card>

            <View style={styles.heroStatsGrid}>
              {heroStats.map((stat) => (
                <Card key={stat.key} padding="md" style={styles.heroStatCard}>
                  <View style={styles.heroStatIcon}>{stat.icon}</View>
                  <Text style={styles.heroStatValue}>{stat.value}</Text>
                  <Text style={styles.heroStatLabel}>{stat.label}</Text>
                  {'subtitle' in stat && stat.subtitle ? (
                    <Text style={styles.heroStatSubLabel}>{stat.subtitle}</Text>
                  ) : null}
                </Card>
              ))}
            </View>

            {!isOwner ? (
              <TouchableOpacity style={styles.rewardCard} activeOpacity={0.9} onPress={handleCheckIn}>
                <View style={styles.rewardTextContainer}>
                  <Text style={styles.rewardTitle}>Gagnez une récompense XP</Text>
                  <Text style={styles.rewardSubtitle}>
                    Participez à cet événement pour gagner +{xpCardData.rewardAmount} XP
                  </Text>
                  <View style={styles.rewardProgressTrack}>
                    <View style={[styles.rewardProgressFill, { width: `${Math.round(xpCardData.progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.rewardMeta}>
                    Niveau {xpCardData.level} • {xpCardData.currentXp}/{xpCardData.nextLevelXp} XP
                  </Text>
                </View>
                <View style={styles.rewardIconWrap}>
                  <Star size={20} color={colors.scale.neutral[0]} fill={colors.scale.neutral[0]} />
                </View>
              </TouchableOpacity>
            ) : null}

            <View style={styles.fansStrip}>
              <View style={styles.fansAvatarsRow}>
                {topAttendees.length > 0 ? (
                  <>
                    {topAttendees.map((attendee, index) => (
                      <TouchableOpacity
                        key={`${attendee.userId}-${index}`}
                        onPress={() => {
                          if (isGuest) {
                            openGuestGate('Voir les participants');
                            return;
                          }
                          router.push(`/community/${attendee.userId}` as any);
                        }}
                        accessibilityRole="button"
                        activeOpacity={0.85}
                      >
                        {attendee.avatarUrl ? (
                          <Image
                            source={{ uri: attendee.avatarUrl }}
                            style={[styles.fanAvatar, { marginLeft: index === 0 ? 0 : -12 }]}
                          />
                        ) : (
                          <View style={[styles.fanAvatarFallback, { marginLeft: index === 0 ? 0 : -12 }]}>
                            <Users size={14} color={colors.scale.neutral[600]} />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                    {attendees.length > topAttendees.length ? (
                      <View style={[styles.fanAvatar, styles.fanCountBadge, { marginLeft: -12 }]}>
                        <Text style={styles.fanCountText}>+{attendees.length - topAttendees.length}</Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View style={styles.fanAvatarFallback}>
                    <Users size={14} color={colors.scale.neutral[600]} />
                  </View>
                )}
              </View>
              <Text style={styles.fansStripText}>{attendeesLabel}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>À propos de l&apos;événement</Text>
              <Text style={styles.description}>{event.description}</Text>
              {event.tags && event.tags.length > 0 ? (
                <View style={styles.tagsContainer}>
                  {event.tags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionTitle}>Organisateur</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (isGuest) {
                      openGuestGate('Accéder à la communauté');
                      return;
                    }
                    router.push(`/community/${event.creator.id}` as any);
                  }}
                >
                  <Text style={styles.sectionLink}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              {renderCreator()}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionTitle}>Échos de la communauté</Text>
                <TouchableOpacity onPress={() => commentInputRef.current?.focus()}>
                  <Text style={styles.sectionLink}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              {communityPreview.length === 0 ? (
                <Text style={styles.emptyComments}>Aucun commentaire pour le moment</Text>
              ) : (
                <View style={styles.communityPreviewList}>
                  {communityPreview.map((comment) => (
                    <Card key={comment.id} padding="md" style={styles.communityPreviewCard}>
                      <View style={styles.commentHeader}>
                        {comment.author?.avatar_url ? (
                          <Image source={{ uri: comment.author.avatar_url }} style={styles.commentAvatar} />
                        ) : (
                          <View style={[styles.commentAvatar, styles.commentAvatarFallback]} />
                        )}
                        <Text style={styles.commentAuthor}>{comment.author?.display_name || 'Utilisateur'}</Text>
                        <Text style={styles.commentActionText}>
                          {new Date(comment.created_at).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>
                      <Text style={styles.commentContent}>{comment.message}</Text>
                      <View style={styles.communityMetaRow}>
                        <TouchableOpacity
                          style={styles.communityMetaPill}
                          onPress={() => handleToggleCommentLike(comment.id)}
                          accessibilityRole="button"
                        >
                          <Heart
                            size={14}
                            color={likedComments.has(comment.id) ? colors.scale.error[500] : colors.scale.neutral[500]}
                            fill={likedComments.has(comment.id) ? colors.scale.error[500] : 'transparent'}
                          />
                          <Text style={styles.communityMetaText}>{commentLikesCount[comment.id] ?? 0}</Text>
                        </TouchableOpacity>
                        <View style={styles.communityMetaPill}>
                          <MessageCircle size={14} color={colors.scale.neutral[500]} />
                          <Text style={styles.communityMetaText}>0</Text>
                        </View>
                      </View>
                    </Card>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Galerie</Text>
              {renderPhotos()}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Avis</Text>
              {renderReviews()}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations complémentaires</Text>
              {renderInfo()}
            </View>

            {(isOwner || isAdmin) ? (
              <View style={styles.ownerActions}>
                <TouchableOpacity
                  style={styles.ownerButton}
                  onPress={() => router.push(`/events/create/step-1?edit=${event.id}` as any)}
                >
                  <Edit size={16} color={colors.scale.neutral[800]} />
                  <Text style={styles.ownerText}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ownerButton, styles.deleteButton]} onPress={handleDeleteEvent}>
                  <Trash2 size={16} color={colors.scale.error[600]} />
                  <Text style={[styles.ownerText, styles.deleteText]}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.bottomRibbon, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <TouchableOpacity style={styles.bottomRibbonFavorite} onPress={handleToggleFavorite}>
            <Star
              size={24}
              color={event.is_favorited ? colors.scale.warning[500] : V2.textPrimary}
              fill={event.is_favorited ? colors.scale.warning[500] : 'transparent'}
            />
          </TouchableOpacity>
          {!isOwner ? (
            <Button
              title="Valider ma présence"
              onPress={handleCheckIn}
              fullWidth
              leftSlot={<Navigation2 size={18} color={colors.scale.neutral[50]} />}
              style={styles.bottomRibbonCta}
            />
          ) : (
            <Button
              title="Modifier l'événement"
              onPress={() => router.push(`/events/create/step-1?edit=${event.id}` as any)}
              fullWidth
              leftSlot={<Edit size={18} color={colors.scale.neutral[50]} />}
              style={styles.bottomRibbonCta}
            />
          )}
        </View>
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
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: V2.bg,
  },
  errorText: {
    ...typography.body,
    color: V2.textPrimary,
  },
  heroWrapper: {
    position: 'relative',
  },
  heroActions: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topCircleActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  topCircleButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 25, 0.68)',
    borderWidth: 1,
    borderColor: V2.border,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveBadge: {
    backgroundColor: '#0f8e5d',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  liveBadgeText: {
    ...typography.caption,
    color: colors.scale.neutral[0],
    textTransform: 'uppercase',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: V2.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  categoryText: {
    color: V2.bg,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    ...typography.h2,
    color: V2.textPrimary,
    marginBottom: spacing.xs,
  },
  headlineCard: {
    backgroundColor: V2.surface,
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
    color: V2.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: V2.surface,
    borderWidth: 1,
    borderColor: V2.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    ...typography.bodySmall,
    color: colors.scale.neutral[600],
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
    color: colors.scale.neutral[500],
    marginBottom: spacing.xs,
  },
  infoValue: {
    ...typography.body,
    color: colors.scale.neutral[900],
  },
  infoMeta: {
    ...typography.caption,
    color: colors.scale.neutral[600],
    marginTop: spacing.xxs,
  },
  inlineAction: {
    ...typography.bodySmall,
    color: colors.scale.primary[500],
    fontWeight: '700',
    alignSelf: 'center',
  },
  priceValue: {
    ...typography.h6,
    color: colors.scale.primary[500],
    marginLeft: spacing.sm,
  },
  heroStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroStatCard: {
    width: (width - spacing.lg * 2 - spacing.sm * 3) / 4,
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  heroStatIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 25, 0.45)',
    marginBottom: spacing.xs,
  },
  heroStatValue: {
    ...typography.h4,
    color: colors.scale.neutral[900],
  },
  heroStatLabel: {
    ...typography.caption,
    color: colors.scale.neutral[600],
    marginTop: spacing.xxs,
    textTransform: 'uppercase',
  },
  heroStatSubLabel: {
    ...typography.small,
    color: colors.scale.neutral[500],
    marginTop: spacing.xxs,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.scale.info[500],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rewardTextContainer: {
    flex: 1,
    gap: spacing.xxs,
  },
  rewardTitle: {
    ...typography.h5,
    color: colors.scale.neutral[0],
  },
  rewardSubtitle: {
    ...typography.bodySmall,
    color: colors.scale.neutral[0],
  },
  rewardProgressTrack: {
    marginTop: spacing.xs,
    width: '100%',
    height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.24)',
    overflow: 'hidden',
  },
  rewardProgressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
    backgroundColor: colors.scale.neutral[0],
  },
  rewardMeta: {
    ...typography.caption,
    color: colors.scale.neutral[100],
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  rewardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fansStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fansAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fanAvatar: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.scale.neutral[200],
    backgroundColor: V2.surface,
  },
  fanCountBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V2.surface2,
  },
  fanCountText: {
    ...typography.caption,
    color: colors.scale.neutral[200],
    fontWeight: '700',
  },
  fanAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.scale.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V2.surface2,
  },
  fansStripText: {
    ...typography.bodySmall,
    color: colors.scale.neutral[600],
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionLink: {
    ...typography.bodySmall,
    color: colors.scale.primary[500],
    fontWeight: '700',
  },
  sectionTitle: {
    ...typography.h4,
    color: V2.textPrimary,
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    marginBottom: spacing.md,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: V2.textSecondary,
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
    backgroundColor: colors.scale.neutral[100],
  },
  statLabel: {
    ...typography.caption,
    color: colors.scale.neutral[600],
  },
  statValue: {
    ...typography.h5,
    color: colors.scale.neutral[900],
  },
  description: {
    ...typography.body,
    color: colors.scale.neutral[700],
    lineHeight: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.scale.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  tagText: {
    ...typography.bodySmall,
    color: colors.scale.primary[700],
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  ratingValue: {
    ...typography.h2,
    color: colors.scale.neutral[900],
  },
  ratingMeta: {
    gap: 2,
  },
  ratingMetaText: {
    ...typography.bodySmall,
    color: colors.scale.neutral[600],
  },
  emptyComments: {
    ...typography.bodySmall,
    color: colors.scale.neutral[500],
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
    backgroundColor: colors.scale.neutral[300],
  },
  commentAuthor: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.scale.neutral[900],
  },
  commentRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  commentRatingText: {
    ...typography.caption,
    color: colors.scale.neutral[700],
  },
  commentContent: {
    ...typography.bodySmall,
    color: colors.scale.neutral[700],
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
    color: colors.scale.neutral[600],
    fontWeight: '600',
  },
  commentInputCard: {
    marginBottom: spacing.md,
  },
  communityPreviewList: {
    gap: spacing.sm,
  },
  communityPreviewCard: {
    marginBottom: 0,
  },
  communityMetaRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  communityMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.scale.neutral[100],
  },
  communityMetaText: {
    ...typography.caption,
    color: colors.scale.neutral[700],
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  commentInput: {
    ...typography.body,
    backgroundColor: colors.scale.neutral[50],
    borderWidth: 1,
    borderColor: colors.scale.neutral[300],
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
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
    backgroundColor: colors.scale.neutral[100],
  },
  ownerText: {
    ...typography.bodySmall,
    color: colors.scale.neutral[800],
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: colors.scale.error[50],
  },
  deleteText: {
    color: colors.scale.error[600],
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
    backgroundColor: colors.scale.neutral[0],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.scale.neutral[200],
    overflow: 'hidden',
  },
  pendingImage: {
    width: '100%',
    height: 180,
    backgroundColor: colors.scale.neutral[100],
  },
  pendingActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  pendingApprove: {
    flex: 1,
    backgroundColor: colors.scale.primary[600],
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  pendingApproveText: {
    ...typography.bodySmall,
    color: colors.scale.neutral[0],
    fontWeight: '600',
  },
  pendingReject: {
    flex: 1,
    backgroundColor: colors.scale.neutral[100],
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.scale.neutral[300],
  },
  pendingRejectText: {
    ...typography.bodySmall,
    color: colors.scale.neutral[700],
    fontWeight: '600',
  },
  emptyPhotos: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyPhotosText: {
    ...typography.bodySmall,
    color: colors.scale.neutral[500],
  },
  creatorCard: {
    marginBottom: spacing.md,
  },
  creatorCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
  },
  creatorCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
  },
  creatorCardAvatarFallback: {
    backgroundColor: colors.scale.neutral[200],
  },
  creatorCardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  creatorCardName: {
    ...typography.body,
    color: colors.scale.neutral[900],
    fontWeight: '600',
  },
  creatorCardMeta: {
    ...typography.caption,
    color: colors.scale.neutral[500],
    marginTop: spacing.xs,
  },
  creatorCardAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.scale.neutral[100],
  },
  creatorCardFollowButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.scale.primary[500],
    marginRight: spacing.sm,
  },
  creatorCardFollowButtonActive: {
    backgroundColor: colors.scale.neutral[100],
  },
  creatorCardFollowLabel: {
    ...typography.caption,
    color: colors.scale.neutral[0],
    fontWeight: '700',
  },
  creatorCardFollowLabelActive: {
    color: colors.scale.neutral[700],
  },
  creatorCardLink: {
    ...typography.caption,
    color: colors.scale.neutral[700],
    fontWeight: '600',
  },
  creatorEvents: {
    gap: spacing.sm,
  },
  creatorEventRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.scale.neutral[200],
  },
  creatorEventTitle: {
    ...typography.bodySmall,
    color: colors.scale.neutral[900],
    fontWeight: '600',
  },
  creatorEventMeta: {
    ...typography.caption,
    color: colors.scale.neutral[500],
    marginTop: spacing.xs,
  },
  bottomRibbon: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 36, 38, 0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: V2.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bottomRibbonFavorite: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V2.surface2,
    borderWidth: 1,
    borderColor: V2.border,
  },
  bottomRibbonCta: {
    flex: 1,
  },
});
