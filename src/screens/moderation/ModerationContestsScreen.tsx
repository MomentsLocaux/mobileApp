import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Image } from 'react-native';
import { ArrowLeft, X, Trophy, AlertTriangle } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/components/ui/v2/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks';
import { ModerationService } from '@/services/moderation.service';
import type { ModerationContestEntry } from '@/types/moderation';
import { AppBackground, Button, Card } from '@/components/ui/v2';
import { supabase } from '@/lib/supabase/client';

export default function ModerationContestsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<ModerationContestEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jwtRole, setJwtRole] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{
    title: string;
    onConfirm: (reason: string) => void;
  } | null>(null);
  const [reason, setReason] = useState('');

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const role = (sessionData.session?.user?.app_metadata as any)?.role;
      setJwtRole(typeof role === 'string' ? role : null);
      const data = await ModerationService.listContestEntries({ limit: 50 });
      setEntries(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleStatus = async (
    entry: ModerationContestEntry,
    status: 'active' | 'hidden' | 'removed',
    note?: string
  ) => {
    if (!profile?.id) return;
    await ModerationService.updateContestEntryStatus({
      entryId: entry.id,
      status,
      moderatorId: profile.id,
      reason: note,
    });
    await loadEntries();
  };

  const handleWarnAuthor = async (entry: ModerationContestEntry, note?: string) => {
    if (!profile?.id) return;
    await ModerationService.warnUser({
      userId: entry.user_id,
      moderatorId: profile.id,
      reason: note || 'Participation concours non conforme.',
    });
    await loadEntries();
  };

  return (
    <View style={styles.container}>
      <AppBackground />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/moderation')}>
          <ArrowLeft size={18} color={colors.scale.neutral[700]} />
          <Text style={styles.headerButtonText}>Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Participations concours</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
          <X size={18} color={colors.scale.neutral[700]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadEntries} />}
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
        {!loading && entries.length === 0 && <Text style={styles.metaText}>Aucune participation trouvée.</Text>}
        {entries.map((entry) => (
          <Card key={entry.id} padding="md" style={styles.card}>
            <View style={styles.cardHeader}>
              <Trophy size={18} color={colors.scale.info[700]} />
              <Text style={styles.cardTitle}>{entry.contest?.title || 'Concours'}</Text>
            </View>
            <Text style={styles.cardMeta}>Auteur: {entry.user?.display_name || 'Utilisateur'}</Text>
            <Text style={styles.cardMeta}>Statut: {entry.status}</Text>

            {entry.content ? <Text style={styles.cardBody}>{entry.content}</Text> : null}
            {entry.media_url ? <Image source={{ uri: entry.media_url }} style={styles.entryImage} /> : null}

            <View style={styles.actionRow}>
              <Button title="Valider" onPress={() => handleStatus(entry, 'active')} fullWidth />
              <Button
                title="Masquer"
                variant="outline"
                onPress={() =>
                  setReasonModal({
                    title: 'Motif de masquage',
                    onConfirm: (note) => handleStatus(entry, 'hidden', note),
                  })
                }
                fullWidth
              />
              <Button
                title="Supprimer"
                variant="outline"
                onPress={() =>
                  setReasonModal({
                    title: 'Motif de suppression',
                    onConfirm: (note) => handleStatus(entry, 'removed', note),
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
                    onConfirm: (note) => handleWarnAuthor(entry, note),
                  })
                }
                fullWidth
              />
            </View>
            <View style={styles.warningHint}>
              <AlertTriangle size={14} color={colors.scale.warning[700]} />
              <Text style={styles.warningHintText}>Les actions sont journalisées dans la modération.</Text>
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
    color: colors.scale.neutral[900],
    fontWeight: '700',
  },
  cardMeta: {
    ...typography.bodySmall,
    color: colors.scale.neutral[600],
  },
  cardBody: {
    ...typography.bodySmall,
    color: colors.scale.neutral[800],
  },
  entryImage: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.md,
    backgroundColor: colors.scale.neutral[200],
  },
  actionRow: {
    gap: spacing.sm,
  },
  warningHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  warningHintText: {
    ...typography.caption,
    color: colors.scale.warning[700],
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
