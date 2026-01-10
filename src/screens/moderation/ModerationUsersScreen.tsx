import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { ArrowLeft, X, User, ShieldAlert } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks';
import { ModerationService } from '@/services/moderation.service';
import type { ModerationWarning } from '@/types/moderation';
import { Button, Card } from '@/components/ui';

export default function ModerationUsersScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<ModerationWarning[]>([]);
  const [reasonModal, setReasonModal] = useState<{
    title: string;
    onConfirm: (reason: string) => void;
  } | null>(null);
  const [reason, setReason] = useState('');

  const loadWarnings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ModerationService.listWarnings({ limit: 50 });
      setWarnings(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWarnings();
  }, [loadWarnings]);

  const handleWarn = async (userId: string, note?: string) => {
    if (!profile?.id) return;
    await ModerationService.warnUser({ userId, level: 1, moderatorId: profile.id, reason: note });
    await loadWarnings();
  };

  const handleBan = async (userId: string, note?: string) => {
    if (!profile?.id) return;
    await ModerationService.banUser({ userId, moderatorId: profile.id, reason: note });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/moderation')}>
          <ArrowLeft size={18} color={colors.neutral[700]} />
          <Text style={styles.headerButtonText}>Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Utilisateurs à problèmes</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
          <X size={18} color={colors.neutral[700]} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading && <Text style={styles.metaText}>Chargement…</Text>}
        {!loading && warnings.length === 0 && <Text style={styles.metaText}>Aucun utilisateur signalé.</Text>}
        {warnings.map((warning) => (
          <Card key={warning.id} padding="md" style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.avatarPlaceholder}>
                <User size={16} color={colors.neutral[500]} />
              </View>
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle}>{warning.user?.display_name || 'Utilisateur'}</Text>
                <Text style={styles.cardMeta}>Niveau {warning.level}</Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <ShieldAlert size={14} color={colors.warning[700]} />
              <Text style={styles.statusText}>Récidiviste</Text>
            </View>
            <View style={styles.actionRow}>
              <Button
                title="Avertir"
                onPress={() =>
                  setReasonModal({
                    title: 'Motif d’avertissement',
                    onConfirm: (note) => handleWarn(warning.user_id, note),
                  })
                }
                fullWidth
              />
              <Button
                title="Bloquer"
                variant="outline"
                onPress={() =>
                  setReasonModal({
                    title: 'Motif du blocage',
                    onConfirm: (note) => handleBan(warning.user_id, note),
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
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    ...typography.body,
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
  cardHeaderInfo: {
    flex: 1,
  },
  cardTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  cardMeta: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusText: {
    ...typography.bodySmall,
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
