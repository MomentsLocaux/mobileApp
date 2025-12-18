import React, { useState, useEffect } from 'react';
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
import {
  Heart,
  Star,
  MapPin,
  Calendar,
  Clock,
  Users,
  Share2,
  Edit,
  Trash2,
  Image as ImageIcon,
  ChevronLeft,
} from 'lucide-react-native';
import { Button, Card } from '../../components/ui';
import { EventsService } from '../../services/events.service';
import { SocialService } from '../../services/social.service';
import { useAuth } from '../../hooks';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getCategoryLabel } from '@/constants/eventTypology';
import { useI18n } from '@/contexts/I18nProvider';
import { t } from '@/i18n/translations';
import type { EventWithCreator } from '../../types/database';
import { useComments } from '@/hooks/useComments';
import { useLocationStore } from '@/store';
import { CheckinService } from '@/services/checkin.service';

const { width } = Dimensions.get('window');

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useI18n();
  const { profile, session } = useAuth();
  const { currentLocation } = useLocationStore();
  const { comments, loading: loadingComments, addComment, reload: reloadComments } = useComments(id || '');

  const [event, setEvent] = useState<EventWithCreator | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    loadEventDetails();
  }, [id]);

  const loadEventDetails = async () => {
    if (!id) return;
    const data = await EventsService.getEventById(id);
    setEvent(data);
    setLoading(false);
  };

  const handleToggleFavorite = async () => {
    if (!profile || !event) return;
    await SocialService.toggleFavorite(profile.id, event.id);
    setEvent((prev) => (prev ? { ...prev, is_favorited: !prev.is_favorited } : null));
  };

  const handleToggleInterest = async () => {
    if (!profile || !event) return;
    const newState = await SocialService.toggleInterest(profile.id, event.id);
    setEvent((prev) =>
      prev
        ? {
            ...prev,
            is_interested: newState,
            interests_count: newState
              ? prev.interests_count + 1
              : prev.interests_count - 1,
          }
        : null
    );
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

  const handlePostComment = async () => {
    if (!profile || !event || !commentText.trim()) return;

    setSubmittingComment(true);
    try {
      await addComment(commentText.trim());
      setCommentText('');
      reloadComments();
    } catch (err) {
      Alert.alert('Commentaire', err instanceof Error ? err.message : 'Erreur envoi commentaire');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!event) return;

    Alert.alert(
      'Supprimer l\'événement',
      'Êtes-vous sûr de vouloir supprimer cet événement ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const success = await EventsService.deleteEvent(event.id);
            if (success) {
              router.back();
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

  const isOwner = profile?.id === event.creator_id;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'moderateur';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.neutral[700]} />
          <Text style={styles.backText}>{t('eventDetail', 'back', locale)}</Text>
        </TouchableOpacity>
      </View>

      {event.cover_url ? (
        <Image source={{ uri: event.cover_url }} style={styles.coverImage} />
      ) : (
        <View style={[styles.coverImage, styles.coverPlaceholder]}>
          <ImageIcon size={48} color={colors.neutral[400]} />
        </View>
      )}

      <View style={styles.content}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{getCategoryLabel(event.category, locale)}</Text>
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

          <TouchableOpacity style={styles.actionButton} onPress={handleToggleInterest}>
            <Star
              size={24}
              color={event.is_interested ? colors.warning[500] : colors.neutral[600]}
              fill={event.is_interested ? colors.warning[500] : 'transparent'}
            />
            <Text style={styles.actionText}>{event.interests_count}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Share2 size={24} color={colors.neutral[600]} />
          </TouchableOpacity>

          {(isOwner || isAdmin) && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push(`/events/${event.id}/edit`)}
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commentaires ({comments.length})</Text>

          {profile && (
            <Card padding="md" style={styles.commentInputCard}>
              <TextInput
                style={styles.commentInput}
                placeholder="Ajouter un commentaire..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
                numberOfLines={3}
              />
              <Button
                title="Publier"
                onPress={handlePostComment}
                loading={submittingComment}
                disabled={!commentText.trim()}
                size="small"
              />
            </Card>
          )}

          {comments.map((comment) => (
            <Card key={comment.id} padding="md" style={styles.commentCard}>
              <View style={styles.commentHeader}>
                {comment.author.avatar_url && (
                  <Image
                    source={{ uri: comment.author.avatar_url }}
                    style={styles.commentAvatar}
                  />
                )}
                <Text style={styles.commentAuthor}>{comment.author.display_name}</Text>
              </View>
              <Text style={styles.commentContent}>{comment.message}</Text>
            </Card>
          ))}
        </View>

        <Button
          title="Je participe !"
          onPress={handleToggleInterest}
          variant={event.is_interested ? 'outline' : 'primary'}
          fullWidth
          style={styles.participateButton}
        />

        <Button
          title="Check-in"
          onPress={handleCheckIn}
          variant="secondary"
          fullWidth
        />
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  coverImage: {
    width: width,
    height: 300,
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
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
});
