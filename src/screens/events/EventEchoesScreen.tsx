import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import { AppBackground, Button, Card, ScreenHeader } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { useComments } from '@/hooks/useComments';
import { EventsService } from '@/services/events.service';
import { EventMediaSubmissionsService } from '@/services/event-media-submissions.service';
import { EventPhotoContributionModal } from '@/components/events/EventPhotoContributionModal';
import type { EventMediaSubmission, EventWithCreator } from '@/types/database';
import { supabase } from '@/lib/supabase/client';

export default function EventEchoesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile, session } = useAuth();
  const isGuest = !session;
  const { comments, loading: loadingComments, addComment, reload: reloadComments } = useComments(id || '');

  const [event, setEvent] = useState<EventWithCreator | null>(null);
  const [tab, setTab] = useState<'reviews' | 'organizer' | 'community'>('reviews');
  const [communityPhotos, setCommunityPhotos] = useState<EventMediaSubmission[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentRating, setCommentRating] = useState<number | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [contribVisible, setContribVisible] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

  const isOwner = !!profile?.id && profile.id === event?.creator_id;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'moderateur';
  const canAddCommunityPhoto = !isGuest && !!event && (isAdmin || isOwner || hasCheckedIn);

  const organizerUrls = useMemo(() => {
    const urls = [event?.cover_url, ...((event?.media || []).map((m) => m.url).filter(Boolean) as string[])].filter(Boolean) as string[];
    return Array.from(new Set(urls));
  }, [event]);

  const loadCheckinStatus = useCallback(async (eventId: string) => {
    if (!profile?.id) {
      setHasCheckedIn(false);
      return;
    }
    const { count } = await supabase
      .from('event_checkins')
      .select('id', { head: true, count: 'exact' })
      .eq('event_id', eventId)
      .eq('user_id', profile.id);
    setHasCheckedIn((count || 0) > 0);
  }, [profile?.id]);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const evt = await EventsService.getEventById(id);
      setEvent(evt);
      setLoadingPhotos(true);
      const approved = await EventMediaSubmissionsService.listApproved(id);
      setCommunityPhotos(approved);
      await loadCheckinStatus(id);
    } catch (e) {
      console.warn('load echoes screen', e);
    } finally {
      setLoadingPhotos(false);
    }
  }, [id, loadCheckinStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddPhoto = () => {
    if (!event) return;
    if (!canAddCommunityPhoto) {
      Alert.alert('Check-in requis', 'Vous devez faire un check-in pour ajouter une photo.');
      return;
    }
    setContribVisible(true);
  };

  const handleSubmitComment = async () => {
    if (isGuest) return;
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await addComment(commentText.trim(), commentRating ?? undefined);
      setCommentText('');
      setCommentRating(null);
      reloadComments();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Impossible d'envoyer votre avis.";
      Alert.alert('Erreur', message);
    } finally {
      setSubmittingComment(false);
    }
  };

  if (!event) {
    return (
      <View style={styles.centered}>
        <AppBackground />
        <ActivityIndicator color={colors.brand.secondary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackground />
      <ScreenHeader title="Echos de la communauté" onBack={() => router.back()} />

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'reviews' && styles.tabActive]} onPress={() => setTab('reviews')}>
          <Text style={[styles.tabText, tab === 'reviews' && styles.tabTextActive]}>Avis et commentaires</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'organizer' && styles.tabActive]} onPress={() => setTab('organizer')}>
          <Text style={[styles.tabText, tab === 'organizer' && styles.tabTextActive]}>Photos orga</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'community' && styles.tabActive]} onPress={() => setTab('community')}>
          <Text style={[styles.tabText, tab === 'community' && styles.tabTextActive]}>Photos communauté</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'reviews' ? (
          <>
            {loadingComments ? (
              <ActivityIndicator color={colors.brand.secondary} />
            ) : comments.length === 0 ? (
              <Text style={styles.muted}>Aucun avis pour le moment</Text>
            ) : (
              comments.map((comment) => (
                <Card key={comment.id} padding="md" style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.author}>{comment.author?.display_name || 'Utilisateur'}</Text>
                    {typeof comment.rating === 'number' ? (
                      <View style={styles.rowCenter}>
                        <Star size={14} color="#FBBF24" fill="#FBBF24" />
                        <Text style={styles.muted}> {comment.rating.toFixed(1)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.body}>{comment.message}</Text>
                </Card>
              ))
            )}

            {!isGuest ? (
              <Card padding="md" style={styles.card}>
                <Text style={styles.label}>Votre avis</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((v) => {
                    const active = (commentRating ?? 0) >= v;
                    return (
                      <TouchableOpacity key={v} onPress={() => setCommentRating(v)}>
                        <Star size={20} color={active ? '#FBBF24' : colors.neutral[500]} fill={active ? '#FBBF24' : 'transparent'} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Partager votre avis"
                  placeholderTextColor={colors.brand.textSecondary}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
                <Button title="Publier" onPress={handleSubmitComment} loading={submittingComment} disabled={!commentText.trim()} fullWidth />
              </Card>
            ) : null}
          </>
        ) : null}

        {tab === 'organizer' ? (
          organizerUrls.length === 0 ? (
            <Text style={styles.muted}>Aucune photo organisateur</Text>
          ) : (
            <View style={styles.grid}>
              {organizerUrls.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.photo} />
              ))}
            </View>
          )
        ) : null}

        {tab === 'community' ? (
          <>
            {loadingPhotos ? (
              <ActivityIndicator color={colors.brand.secondary} />
            ) : communityPhotos.length === 0 ? (
              <Text style={styles.muted}>Aucune photo communauté</Text>
            ) : (
              <View style={styles.grid}>
                {communityPhotos.map((photo) => (
                  <Image key={photo.id} source={{ uri: photo.url }} style={styles.photo} />
                ))}
              </View>
            )}

            <Button title="Ajouter une photo" onPress={handleAddPhoto} disabled={!canAddCommunityPhoto} fullWidth style={{ marginTop: spacing.md }} />
          </>
        ) : null}
      </ScrollView>

      {event && profile?.id ? (
        <EventPhotoContributionModal
          visible={contribVisible}
          eventId={event.id}
          userId={profile.id}
          onClose={() => setContribVisible(false)}
          onSubmitted={() => loadData()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand.background },
  tabRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabActive: { backgroundColor: colors.brand.secondary },
  tabText: { ...typography.bodySmall, color: colors.brand.textSecondary },
  tabTextActive: { color: '#0f1719', fontWeight: '700' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { marginBottom: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  author: { ...typography.bodySmall, color: colors.brand.text, fontWeight: '700' },
  body: { ...typography.bodySmall, color: colors.brand.textSecondary, marginTop: spacing.xs },
  muted: { ...typography.bodySmall, color: colors.brand.textSecondary },
  label: { ...typography.caption, color: colors.brand.textSecondary, marginBottom: spacing.xs },
  starsRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  commentInput: {
    ...typography.body,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 90,
    textAlignVertical: 'top',
    color: colors.brand.text,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: {
    width: 110,
    height: 110,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
