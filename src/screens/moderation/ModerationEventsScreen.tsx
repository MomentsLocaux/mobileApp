import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { X, ArrowLeft, CalendarCheck2, MapPin } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks';
import { ModerationService } from '@/services/moderation.service';
import type { ModerationEvent } from '@/types/moderation';
import { Button, Card } from '@/components/ui';

export default function ModerationEventsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<ModerationEvent[]>([]);
  const [reasonModal, setReasonModal] = useState<{
    title: string;
    onConfirm: (reason: string) => void;
  } | null>(null);
  const [reason, setReason] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ModerationService.listPendingEvents({ limit: 50 });
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const updateStatus = async (eventId: string, status: 'published' | 'refused' | 'draft' | 'archived', action: 'approve' | 'refuse' | 'request_changes' | 'archive', note?: string) => {
    if (!profile?.id) return;
    await ModerationService.updateEventStatus({
      eventId,
      status,
      moderatorId: profile.id,
      actionType: action,
      note,
    });
    await loadEvents();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/moderation')}>
          <ArrowLeft size={18} color={colors.neutral[700]} />
          <Text style={styles.headerButtonText}>Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Événements à vérifier</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
          <X size={18} color={colors.neutral[700]} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading && <Text style={styles.metaText}>Chargement…</Text>}
        {!loading && events.length === 0 && <Text style={styles.metaText}>Aucun événement en attente.</Text>}
        {events.map((event) => (
          <Card key={event.id} padding="md" style={styles.card}>
            <View style={styles.cardHeader}>
              <CalendarCheck2 size={18} color={colors.info[700]} />
              <Text style={styles.cardTitle}>{event.title}</Text>
            </View>
            <View style={styles.cardMetaRow}>
              <MapPin size={14} color={colors.neutral[500]} />
              <Text style={styles.cardMetaText}>{event.city || event.address || 'Lieu inconnu'}</Text>
            </View>
            <Text style={styles.cardMetaText}>{event.creator?.display_name || 'Créateur'}</Text>
            <View style={styles.actionRow}>
              <Button title="Approuver" onPress={() => updateStatus(event.id, 'published', 'approve')} fullWidth />
              <Button
                title="Refuser"
                variant="outline"
                onPress={() => {
                  setReason('');
                  setReasonModal({
                    title: 'Motif du refus',
                    onConfirm: (note) => updateStatus(event.id, 'refused', 'refuse', note),
                  });
                }}
                fullWidth
              />
              <Button
                title="Demander des modifs"
                variant="ghost"
                onPress={() => {
                  setReason('');
                  setReasonModal({
                    title: 'Demander des modifications',
                    onConfirm: (note) => updateStatus(event.id, 'draft', 'request_changes', note),
                  });
                }}
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
  cardTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.neutral[900],
    flex: 1,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardMetaText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
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
