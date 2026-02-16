import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star, Heart, Flag } from 'lucide-react-native';
import { AppBackground, Button, Card, ScreenHeader } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { useComments } from '@/hooks/useComments';
import { EventsService } from '@/services/events.service';
import { EventMediaSubmissionsService } from '@/services/event-media-submissions.service';
import { EventPhotoContributionModal } from '@/components/events/EventPhotoContributionModal';
import type { EventMediaSubmission, EventWithCreator } from '@/types/database';
import { supabase } from '@/lib/supabase/client';
import { SocialService } from '@/services/social.service';
import ReportReasonModal from '@/components/moderation/ReportReasonModal';
import { ReportService } from '@/services/report.service';
import type { ReportReasonCode } from '@/constants/report-reasons';

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
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [contribVisible, setContribVisible] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
  const [likingCommentId, setLikingCommentId] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportCommentId, setReportCommentId] = useState<string | null>(null);
  const [reportedCommentIds, setReportedCommentIds] = useState<Set<string>>(new Set());

  const isOwner = !!profile?.id && profile.id === event?.creator_id;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'moderateur';
  const canAddCommunityPhoto = !isGuest && !!event && (isAdmin || isOwner || hasCheckedIn);
  const rootComments = useMemo(
    () => comments.filter((comment) => !comment.parent_comment_id),
    [comments],
  );
  const repliesByParent = useMemo(() => {
    const map = new Map<string, typeof comments>();
    comments
      .filter((comment) => !!comment.parent_comment_id)
      .forEach((comment) => {
        const parentId = comment.parent_comment_id as string;
        map.set(parentId, [...(map.get(parentId) || []), comment]);
      });
    return map;
  }, [comments]);

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

  const loadLikedComments = useCallback(async () => {
    if (isGuest || !comments.length) {
      setLikedCommentIds(new Set());
      return;
    }
    const ids = comments.map((comment) => comment.id);
    const { data, error } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .in('comment_id', ids);
    if (error) {
      console.warn('load liked comments', error);
      return;
    }
    const liked = new Set((data || []).map((row: any) => row.comment_id as string));
    setLikedCommentIds(liked);
  }, [comments, isGuest]);

  useEffect(() => {
    loadLikedComments();
  }, [loadLikedComments]);

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
      if (replyTo) {
        await addComment(commentText.trim(), null, replyTo.id);
      } else {
        await addComment(commentText.trim(), commentRating ?? undefined);
      }
      setCommentText('');
      setCommentRating(null);
      setReplyTo(null);
      reloadComments();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Impossible d'envoyer votre avis.";
      Alert.alert('Erreur', message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (isGuest || !profile?.id || likingCommentId) {
      if (isGuest) Alert.alert('Connexion requise', 'Connectez-vous pour aimer un commentaire.');
      return;
    }
    setLikingCommentId(commentId);
    try {
      await SocialService.likeComment(profile.id, commentId);
      setLikedCommentIds((prev) => {
        const next = new Set(prev);
        if (next.has(commentId)) {
          next.delete(commentId);
        } else {
          next.add(commentId);
        }
        return next;
      });
    } catch (error) {
      Alert.alert('Erreur', "Impossible de mettre à jour le like pour l'instant.");
    } finally {
      setLikingCommentId(null);
    }
  };

  const handleOpenReport = (commentId: string) => {
    if (isGuest) {
      Alert.alert('Connexion requise', 'Connectez-vous pour signaler un commentaire.');
      return;
    }
    setReportCommentId(commentId);
    setReportVisible(true);
  };

  const handleReportComment = async (reason: ReportReasonCode) => {
    if (!reportCommentId) return;
    try {
      await ReportService.comment(reportCommentId, { reason });
      setReportedCommentIds((prev) => {
        const next = new Set(prev);
        next.add(reportCommentId);
        return next;
      });
      Alert.alert('Signalement envoyé', 'Merci, notre équipe de modération va examiner ce commentaire.');
    } catch (error) {
      Alert.alert('Erreur', "Impossible d'envoyer le signalement pour l'instant.");
    } finally {
      setReportVisible(false);
      setReportCommentId(null);
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
            ) : rootComments.length === 0 ? (
              <Text style={styles.muted}>Aucun avis pour le moment</Text>
            ) : (
              rootComments.map((comment) => {
                const replies = repliesByParent.get(comment.id) || [];
                return (
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
                    <View style={styles.commentActions}>
                      <TouchableOpacity
                        style={styles.commentAction}
                        onPress={() => handleToggleCommentLike(comment.id)}
                        disabled={likingCommentId === comment.id}
                      >
                        <Heart
                          size={14}
                          color={likedCommentIds.has(comment.id) ? colors.error[500] : colors.brand.textSecondary}
                          fill={likedCommentIds.has(comment.id) ? colors.error[500] : 'transparent'}
                        />
                        <Text
                          style={[
                            styles.commentActionText,
                            likedCommentIds.has(comment.id) && styles.commentActionTextActive,
                          ]}
                        >
                          {likedCommentIds.has(comment.id) ? 'Aimé' : 'Aimer'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.commentAction}
                        onPress={() =>
                          setReplyTo({
                            id: comment.id,
                            name: comment.author?.display_name || 'Utilisateur',
                          })
                        }
                      >
                        <Text style={styles.commentActionText}>Répondre</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.commentAction} onPress={() => handleOpenReport(comment.id)}>
                        <Flag
                          size={14}
                          color={reportedCommentIds.has(comment.id) ? colors.warning[500] : colors.brand.textSecondary}
                          fill={reportedCommentIds.has(comment.id) ? colors.warning[500] : 'transparent'}
                        />
                        <Text
                          style={[
                            styles.commentActionText,
                            reportedCommentIds.has(comment.id) && styles.commentActionTextReported,
                          ]}
                        >
                          {reportedCommentIds.has(comment.id) ? 'Signalé' : 'Signaler'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {replies.length > 0 ? (
                      <View style={styles.repliesWrap}>
                        {replies.map((reply) => (
                          <View key={reply.id} style={styles.replyItem}>
                            <Text style={styles.replyAuthor}>{reply.author?.display_name || 'Utilisateur'}</Text>
                            <Text style={styles.replyBody}>{reply.message}</Text>
                            <View style={styles.commentActions}>
                              <TouchableOpacity
                                style={styles.commentAction}
                                onPress={() => handleToggleCommentLike(reply.id)}
                                disabled={likingCommentId === reply.id}
                              >
                                <Heart
                                  size={13}
                                  color={likedCommentIds.has(reply.id) ? colors.error[500] : colors.brand.textSecondary}
                                  fill={likedCommentIds.has(reply.id) ? colors.error[500] : 'transparent'}
                                />
                                <Text
                                  style={[
                                    styles.commentActionText,
                                    likedCommentIds.has(reply.id) && styles.commentActionTextActive,
                                  ]}
                                >
                                  {likedCommentIds.has(reply.id) ? 'Aimé' : 'Aimer'}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.commentAction} onPress={() => handleOpenReport(reply.id)}>
                                <Flag
                                  size={13}
                                  color={reportedCommentIds.has(reply.id) ? colors.warning[500] : colors.brand.textSecondary}
                                  fill={reportedCommentIds.has(reply.id) ? colors.warning[500] : 'transparent'}
                                />
                                <Text
                                  style={[
                                    styles.commentActionText,
                                    reportedCommentIds.has(reply.id) && styles.commentActionTextReported,
                                  ]}
                                >
                                  {reportedCommentIds.has(reply.id) ? 'Signalé' : 'Signaler'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}

            {!isGuest ? (
              <Card padding="md" style={styles.card}>
                <Text style={styles.label}>Votre avis</Text>
                {replyTo ? (
                  <View style={styles.replyContext}>
                    <Text style={styles.replyContextText}>Réponse à {replyTo.name}</Text>
                    <TouchableOpacity onPress={() => setReplyTo(null)}>
                      <Text style={styles.replyCancel}>Annuler</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
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
                )}
                <TextInput
                  style={styles.commentInput}
                  placeholder={replyTo ? 'Rédiger votre réponse' : 'Partager votre avis'}
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

      <ReportReasonModal
        visible={reportVisible}
        onClose={() => {
          setReportVisible(false);
          setReportCommentId(null);
        }}
        onSelect={handleReportComment}
      />
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
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentActionText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  commentActionTextActive: {
    color: colors.error[500],
  },
  commentActionTextReported: {
    color: colors.warning[500],
  },
  repliesWrap: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: spacing.sm,
  },
  replyItem: {
    marginLeft: spacing.sm,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.12)',
  },
  replyAuthor: {
    ...typography.caption,
    color: colors.brand.text,
    fontWeight: '700',
  },
  replyBody: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  muted: { ...typography.bodySmall, color: colors.brand.textSecondary },
  label: { ...typography.caption, color: colors.brand.textSecondary, marginBottom: spacing.xs },
  replyContext: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(43,191,227,0.12)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(43,191,227,0.4)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  replyContextText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  replyCancel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
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
