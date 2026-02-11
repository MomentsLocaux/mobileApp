import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, RefreshControl } from 'react-native';
import { ArrowLeft, X, MessageSquare, AlertTriangle } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks';
import { ModerationService } from '@/services/moderation.service';
import { getReportReasonMeta } from '@/constants/report-reasons';
import type { ModerationComment, ReportRecord } from '@/types/moderation';
import { Button, Card } from '@/components/ui';
import { supabase } from '@/lib/supabase/client';

export default function ModerationCommentsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<ModerationComment[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jwtRole, setJwtRole] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{
    title: string;
    onConfirm: (reason: string) => void;
  } | null>(null);
  const [reason, setReason] = useState('');

  const loadComments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const role = (sessionData.session?.user?.app_metadata as any)?.role;
      setJwtRole(typeof role === 'string' ? role : null);
      const data = await ModerationService.listReportedComments({ limit: 50 });
      setComments(data.comments);
      setReports(data.reports);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const reportMap = useMemo(() => {
    const map = new Map<string, ReportRecord[]>();
    reports.forEach((report) => {
      if (!map.has(report.target_id)) map.set(report.target_id, []);
      map.get(report.target_id)?.push(report);
    });
    return map;
  }, [reports]);

  const handleRemove = async (comment: ModerationComment, note?: string) => {
    if (!profile?.id) return;
    await ModerationService.removeComment({
      commentId: comment.id,
      moderatorId: profile.id,
      authorId: comment.author_id,
      eventId: comment.event_id,
      reason: note,
    });
    await loadComments();
  };

  const handleWarn = async (comment: ModerationComment, note?: string) => {
    if (!profile?.id) return;
    await ModerationService.warnUser({
      userId: comment.author_id,
      moderatorId: profile.id,
      reason: note,
    });
    await loadComments();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/moderation')}>
          <ArrowLeft size={18} color={colors.neutral[700]} />
          <Text style={styles.headerButtonText}>Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commentaires signalés</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
          <X size={18} color={colors.neutral[700]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadComments} />}
      >
        <View style={styles.debugCard}>
          <Text style={styles.debugText}>Role profil: {profile?.role || 'n/a'}</Text>
          <Text style={styles.debugText}>Role JWT: {jwtRole || 'n/a'}</Text>
          {loadError ? <Text style={styles.debugError}>Erreur: {loadError}</Text> : null}
          {!!profile?.role && !!jwtRole && profile.role !== (jwtRole as any) ? (
            <Text style={styles.debugWarn}>Incohérence: le rôle JWT diffère du rôle profil (RLS peut bloquer).</Text>
          ) : null}
        </View>
        {loading && <Text style={styles.metaText}>Chargement…</Text>}
        {!loading && comments.length === 0 && <Text style={styles.metaText}>Aucun commentaire signalé.</Text>}
        {comments.map((comment) => {
          const commentReports = reportMap.get(comment.id) || [];
          return (
            <Card key={comment.id} padding="md" style={styles.card}>
              <View style={styles.cardHeader}>
                <MessageSquare size={18} color={colors.info[700]} />
                <Text style={styles.cardTitle}>{comment.author?.display_name || 'Utilisateur'}</Text>
              </View>
              <Text style={styles.cardBody}>{comment.message}</Text>
              <View style={styles.badgeRow}>
                {commentReports.map((report) => {
                  const meta = getReportReasonMeta(report.reason);
                  return (
                    <View key={report.id} style={styles.badge}>
                      <AlertTriangle size={12} color={colors.warning[700]} />
                      <Text style={styles.badgeText}>{meta.label}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.actionRow}>
                <Button
                  title="Supprimer"
                  onPress={() =>
                    setReasonModal({
                      title: 'Motif de suppression',
                      onConfirm: (note) => handleRemove(comment, note),
                    })
                  }
                  fullWidth
                />
                <Button
                  title="Avertir"
                  variant="outline"
                  onPress={() =>
                    setReasonModal({
                      title: 'Motif d’avertissement',
                      onConfirm: (note) => handleWarn(comment, note),
                    })
                  }
                  fullWidth
                />
              </View>
            </Card>
          );
        })}
      </ScrollView>

      {reasonModal && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setReasonModal(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{reasonModal.title}</Text>
              <TextInput
                placeholder="Ajouter un motif"
                placeholderTextColor={colors.neutral[400]}
                value={reason}
                onChangeText={setReason}
                style={styles.modalInput}
                multiline
              />
              <View style={styles.modalActions}>
                <Button title="Annuler" variant="outline" onPress={() => setReasonModal(null)} />
                <Button
                  title="Valider"
                  onPress={() => {
                    reasonModal.onConfirm(reason.trim());
                    setReason('');
                    setReasonModal(null);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerButtonText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  cardBody: {
    ...typography.bodySmall,
    color: colors.neutral[800],
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.warning[100],
  },
  badgeText: {
    ...typography.caption,
    color: colors.warning[700],
    fontWeight: '600',
  },
  actionRow: {
    gap: spacing.sm,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  debugCard: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
    gap: spacing.xs,
  },
  debugText: {
    ...typography.caption,
    color: colors.neutral[700],
  },
  debugError: {
    ...typography.caption,
    color: colors.error[700],
  },
  debugWarn: {
    ...typography.caption,
    color: colors.warning[700],
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  modalInput: {
    minHeight: 90,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: spacing.md,
    color: colors.neutral[900],
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
