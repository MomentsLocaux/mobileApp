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
} from 'lucide-react-native';
import { Button, Card } from '../../components/ui';
import { EventsService } from '../../services/events.service';
import { SocialService } from '../../services/social.service';
import { useAuth } from '../../hooks';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getCategoryLabel } from '../../constants/categories';
import type { EventWithCreator } from '../../types/database';
import { useComments } from '@/hooks/useComments';
import { useLocationStore } from '@/store';
import { CheckinService } from '@/services/checkin.service';
import { EventImageCarousel } from '@/components/events/EventImageCarousel';
import { supabase } from '@/lib/supabase/client';
import { useFavoritesStore } from '@/store/favoritesStore';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { NavigationOptionsSheet } from '@/components/search/NavigationOptionsSheet';

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

  const [event, setEvent] = useState<EventWithCreator | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentRating, setCommentRating] = useState<number | null>(null);
  const [guestGate, setGuestGate] = useState({ visible: false, title: '' });
  const [activeSection, setActiveSection] = useState<'overview' | 'reviews' | 'photos' | 'info' | 'creator'>('overview');
  const [navSheetVisible, setNavSheetVisible] = useState(false);
  const [creatorEvents, setCreatorEvents] = useState<EventWithCreator[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const commentInputRef = useRef<TextInput>(null);
  const sectionOpacity = useRef(new Animated.Value(1)).current;
  const isGuest = !session;

  const openGuestGate = (title: string) => setGuestGate({ visible: true, title });
  const closeGuestGate = () => setGuestGate({ visible: false, title: '' });

  useEffect(() => {
    loadEventDetails();
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadEventDetails();
    }, [id])
  );

  const loadEventDetails = async () => {
    if (!id) return;
    const data = await EventsService.getEventById(id);
    setEvent(data);
    setLoading(false);
  };

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

  const handleToggleFavorite = async () => {
    if (isGuest) {
      openGuestGate('Ajouter aux favoris');
      return;
    }
    if (!profile || !event) return;
    await SocialService.toggleFavorite(profile.id, event.id);
    toggleFavoriteStore(event);
    setEvent((prev) => (prev ? { ...prev, is_favorited: !prev.is_favorited } : null));
  };

  const handleCheckIn = async () => {
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
        Alert.alert('Check-in réussi', res.rewards?.lumo ? `+${res.rewards.lumo} Lumo` : 'Check-in validé');
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

  const images = useMemo(() => {
    const urls = [
      event?.cover_url,
      ...(event?.media?.map((m) => m.url).filter((u) => !!u && u !== event.cover_url) as string[] | undefined || []),
    ].filter(Boolean) as string[];
    return Array.from(new Set(urls)).slice(0, 4); // cover + 3 max
  }, [event]);

  const mediaUrls = useMemo(() => {
    const urls = [
      event?.cover_url,
      ...(event?.media?.map((m) => m.url).filter(Boolean) as string[] | undefined || []),
    ].filter(Boolean) as string[];
    return Array.from(new Set(urls));
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.loadingContainer}>
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
    if (!isOwner && !isAdmin) {
      Alert.alert('Action réservée', "Seul le créateur peut ajouter des photos.");
      return;
    }
    router.push(`/events/create/step-1?edit=${event.id}` as any);
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
      Alert.alert('Erreur', "Impossible d'envoyer votre avis pour le moment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const renderOverview = () => (
    <>
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryText}>{getCategoryLabel(event.category || '')}</Text>
      </View>

      <Text style={styles.title}>{event.title}</Text>

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

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleToggleFavorite}>
          <Heart
            size={24}
            color={event.is_favorited ? colors.error[500] : colors.neutral[600]}
            fill={event.is_favorited ? colors.error[500] : 'transparent'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Share2 size={24} color={colors.neutral[600]} />
        </TouchableOpacity>

        {(isOwner || isAdmin) && (
          <>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                router.push(`/events/create/step-1?edit=${event.id}` as any);
              }}
            >
              <Edit size={24} color={colors.primary[600]} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleDeleteEvent}>
              <Trash2 size={24} color={colors.error[600]} />
            </TouchableOpacity>
          </>
        )}
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

        <EventImageCarousel images={images} height={300} borderRadius={0} />

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
            <Heart
              size={20}
              color={event.is_favorited ? colors.error[500] : colors.neutral[700]}
              fill={event.is_favorited ? colors.error[500] : 'transparent'}
            />
            <Text style={styles.bottomBarText}>Favori</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarCta} onPress={handleShare}>
            <Share2 size={20} color={colors.neutral[700]} />
            <Text style={styles.bottomBarText}>Partager</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarCta} onPress={handleGoToReviews}>
            <Star size={20} color={colors.neutral[700]} />
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
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
    backgroundColor: colors.neutral[0],
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
    backgroundColor: colors.neutral[100],
  },
  sectionTabActive: {
    backgroundColor: colors.neutral[900],
  },
  sectionTabText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  sectionTabTextActive: {
    color: colors.neutral[0],
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
    marginBottom: spacing.md,
  },
  categoryText: {
    color: colors.neutral[50],
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
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
    color: colors.neutral[600],
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
    color: colors.neutral[600],
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
    color: colors.neutral[500],
    marginBottom: spacing.xs,
  },
  infoValue: {
    ...typography.body,
    color: colors.neutral[900],
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.neutral[900],
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.neutral[700],
    lineHeight: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  tagText: {
    ...typography.bodySmall,
    color: colors.primary[700],
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  ratingValue: {
    ...typography.h2,
    color: colors.neutral[900],
  },
  ratingMeta: {
    gap: 2,
  },
  ratingMetaText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  emptyComments: {
    ...typography.bodySmall,
    color: colors.neutral[500],
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
    backgroundColor: colors.neutral[300],
  },
  commentAuthor: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  commentRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  commentRatingText: {
    ...typography.caption,
    color: colors.neutral[700],
  },
  commentContent: {
    ...typography.bodySmall,
    color: colors.neutral[700],
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
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[300],
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
    backgroundColor: colors.neutral[100],
  },
  ownerText: {
    ...typography.bodySmall,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: colors.error[50],
  },
  deleteText: {
    color: colors.error[600],
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: borderRadius.md,
  },
  emptyPhotos: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyPhotosText: {
    ...typography.bodySmall,
    color: colors.neutral[500],
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
    backgroundColor: colors.neutral[200],
  },
  creatorCardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  creatorCardName: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  creatorCardMeta: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  creatorCardAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
  },
  creatorCardLink: {
    ...typography.caption,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  creatorEvents: {
    gap: spacing.sm,
  },
  creatorEventRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  creatorEventTitle: {
    ...typography.bodySmall,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  creatorEventMeta: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.neutral[0],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[200],
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
    color: colors.neutral[700],
    marginTop: spacing.xs,
  },
});
