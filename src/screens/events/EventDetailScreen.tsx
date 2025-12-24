import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  Heart,
  MapPin,
  Calendar,
  Clock,
  Users,
  Share2,
  Edit,
  Trash2,
  Image as ImageIcon,
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

const { width } = Dimensions.get('window');

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile, session } = useAuth();
  const { currentLocation } = useLocationStore();
  const { comments, loading: loadingComments, addComment, reload: reloadComments } = useComments(id || '');
  const { toggleFavorite: toggleFavoriteStore, isFavorite } = useFavoritesStore();

  const [event, setEvent] = useState<EventWithCreator | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

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

  const handleToggleFavorite = async () => {
    if (!profile || !event) return;
    await SocialService.toggleFavorite(profile.id, event.id);
    toggleFavoriteStore(event);
    setEvent((prev) => (prev ? { ...prev, is_favorited: !prev.is_favorited } : null));
  };

  const handleCheckIn = async () => {
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
              router.replace('/(tabs)');
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

  const images = useMemo(() => {
    const urls = [
      event?.cover_url,
      ...(event?.media?.map((m) => m.url).filter((u) => !!u && u !== event.cover_url) as string[] | undefined || []),
    ].filter(Boolean) as string[];
    return Array.from(new Set(urls)).slice(0, 4); // cover + 3 max
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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <EventImageCarousel images={images} height={300} borderRadius={0} />

      <View style={styles.content}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{getCategoryLabel(event.category || '')}</Text>
        </View>

        <Text style={styles.title}>{event.title}</Text>

        <TouchableOpacity
          style={styles.creatorRow}
          activeOpacity={0.7}
          onPress={() => router.push(`/community/${event.creator.id}`)}
        >
          {event.creator.avatar_url && (
            <Image source={{ uri: event.creator.avatar_url }} style={styles.avatar} />
          )}
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

          <TouchableOpacity style={styles.actionButton}>
            <Share2 size={24} color={colors.neutral[600]} />
          </TouchableOpacity>

          {(isOwner || isAdmin) && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  if (isOwner || isAdmin) {
                    console.log('[EventDetail] edit click', {
                      eventId: event.id,
                      creatorId: event.creator_id,
                      currentUserId: profile?.id,
                    });
                    router.push(`/events/create/step-1?edit=${event.id}` as any);
                  }
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

        <Card padding="md" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Calendar size={20} color={colors.primary[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>{formatDate(event.starts_at)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Clock size={20} color={colors.primary[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Horaire</Text>
              <Text style={styles.infoValue}>
                {formatTime(event.starts_at)} - {formatTime(event.ends_at)}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <MapPin size={20} color={colors.primary[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Lieu</Text>
              <Text style={styles.infoValue}>{event.address}</Text>
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
            <Button
              title="Check-in"
              onPress={handleCheckIn}
              variant="secondary"
              fullWidth
            />
          </View>
        )}
      </View>
    </ScrollView>
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
    justifyContent: 'flex-end',
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
  closeText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  content: {
    padding: spacing.lg,
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
    marginBottom: spacing.lg,
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
  commentAuthor: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  commentContent: {
    ...typography.bodySmall,
    color: colors.neutral[700],
  },
  commentInputCard: {
    marginBottom: spacing.md,
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
});
