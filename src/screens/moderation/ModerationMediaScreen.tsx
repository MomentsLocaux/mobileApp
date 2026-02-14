import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Image, RefreshControl } from 'react-native';
import { ArrowLeft, X, Image as ImageIcon, AlertTriangle } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/components/ui/v2/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks';
import { ModerationService } from '@/services/moderation.service';
import type { ModerationMediaSubmission } from '@/types/moderation';
import { AppBackground, Button, Card } from '@/components/ui/v2';
import { supabase } from '@/lib/supabase/client';

export default function ModerationMediaScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<ModerationMediaSubmission[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jwtRole, setJwtRole] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{
    title: string;
    onConfirm: (reason: string) => void;
  } | null>(null);
  const [reason, setReason] = useState('');

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const session = await supabase.auth.getSession();
      const role = (session.data.session?.user?.app_metadata as any)?.role || null;
      setJwtRole(typeof role === 'string' ? role : null);
      console.log('[ModerationMedia] session role', role);
      const data = await ModerationService.listMediaSubmissions({ status: 'pending', includeReported: true, limit: 50 });
      console.log('[ModerationMedia] submissions pending', data.length, data.map((row) => ({ id: row.id, status: row.status })));
      setSubmissions(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleApprove = async (submissionId: string) => {
    if (!profile?.id) return;
    await ModerationService.approveMediaSubmission({ submissionId, moderatorId: profile.id });
    await loadSubmissions();
  };

  const handleReject = async (submissionId: string, note?: string) => {
    if (!profile?.id) return;
    await ModerationService.rejectMediaSubmission({ submissionId, moderatorId: profile.id, reason: note });
    await loadSubmissions();
  };

  const handleWarnAuthor = async (submissionId: string, note?: string) => {
    if (!profile?.id) return;
    await ModerationService.warnMediaAuthor({ submissionId, moderatorId: profile.id, reason: note });
    await loadSubmissions();
  };

  const handleEscalate = async (submissionId: string, note?: string) => {
    if (!profile?.id) return;
    await ModerationService.escalateMediaReports({ submissionId, moderatorId: profile.id, reason: note });
    await loadSubmissions();
  };

  return (
    <View style={styles.container}>
      <AppBackground />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/moderation')}>
          <ArrowLeft size={18} color={colors.scale.neutral[700]} />
          <Text style={styles.headerButtonText}>Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Photos de la communauté</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
          <X size={18} color={colors.scale.neutral[700]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadSubmissions} />}
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
        {!loading && submissions.length === 0 && <Text style={styles.metaText}>Aucune photo en attente.</Text>}
        {submissions.map((submission) => (
          <Card key={submission.id} padding="md" style={styles.card}>
            <View style={styles.cardHeader}>
              <ImageIcon size={18} color={colors.scale.info[700]} />
              <Text style={styles.cardTitle}>{submission.event?.title || 'Événement'}</Text>
            </View>
            <View style={styles.mediaRow}>
              <Image source={{ uri: submission.url }} style={styles.mediaThumb} />
              <View style={styles.mediaInfo}>
                <Text style={styles.cardMeta}>{submission.author?.display_name || 'Utilisateur'}</Text>
                <Text style={styles.cardMeta}>Statut: {submission.status}</Text>
                {submission.report_count ? (
                  <View style={styles.reportMetaRow}>
                    <AlertTriangle size={14} color={colors.scale.warning[700]} />
                    <Text style={styles.cardMeta}>
                      {submission.report_count} signalement{submission.report_count > 1 ? 's' : ''}
                      {submission.report_severity ? ` · ${submission.report_severity}` : ''}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.actionRow}>
              <Button
                title="Approuver"
                onPress={() => handleApprove(submission.id)}
                disabled={submission.status === 'approved'}
                fullWidth
              />
              <Button
                title="Refuser"
                variant="outline"
                onPress={() =>
                  setReasonModal({
                    title: 'Motif du refus',
                    onConfirm: (note) => handleReject(submission.id, note),
                  })
                }
                fullWidth
              />
              <Button
                title="Avertir auteur"
                variant="ghost"
                onPress={() =>
                  setReasonModal({
                    title: "Motif de l'avertissement",
                    onConfirm: (note) => handleWarnAuthor(submission.id, note),
                  })
                }
                fullWidth
              />
              <Button
                title="Escalader"
                variant="ghost"
                onPress={() =>
                  setReasonModal({
                    title: "Motif d'escalade",
                    onConfirm: (note) => handleEscalate(submission.id, note),
                  })
                }
                fullWidth
              />
            </View>
          </Card>
        ))}
      </ScrollView>

      {reasonModal && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setReasonModal(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{reasonModal.title}</Text>
              <TextInput
                placeholder="Ajouter un motif"
                placeholderTextColor={colors.scale.neutral[400]}
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
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.scale.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.scale.neutral[200],
  },
  headerTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.scale.neutral[900],
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerButtonText: {
    ...typography.bodySmall,
    color: colors.scale.neutral[700],
    fontWeight: '600',
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.scale.neutral[100],
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
    color: colors.scale.neutral[900],
  },
  cardMeta: {
    ...typography.bodySmall,
    color: colors.scale.neutral[600],
  },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  mediaThumb: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    backgroundColor: colors.scale.neutral[200],
  },
  mediaInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  reportMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionRow: {
    gap: spacing.sm,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.scale.neutral[600],
  },
  debugCard: {
    borderWidth: 1,
    borderColor: colors.scale.neutral[200],
    borderRadius: borderRadius.md,
    backgroundColor: colors.scale.neutral[0],
    padding: spacing.md,
    gap: spacing.xs,
  },
  debugText: {
    ...typography.caption,
    color: colors.scale.neutral[700],
  },
  debugError: {
    ...typography.caption,
    color: colors.scale.error[700],
  },
  debugWarn: {
    ...typography.caption,
    color: colors.scale.warning[700],
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
    backgroundColor: colors.scale.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.scale.neutral[900],
  },
  modalInput: {
    minHeight: 90,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.scale.neutral[200],
    padding: spacing.md,
    color: colors.scale.neutral[900],
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
