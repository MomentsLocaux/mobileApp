import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { REPORT_REASONS, type ReportReasonCode } from '@/constants/report-reasons';

type Props = {
  visible: boolean;
  onSelect: (reason: ReportReasonCode) => void;
  onClose: () => void;
};

export default function ReportReasonModal({ visible, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Motif du signalement</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={16} color={colors.neutral[600]} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {Object.values(REPORT_REASONS).map((reason) => (
              <TouchableOpacity
                key={reason.code}
                style={styles.item}
                onPress={() => onSelect(reason.code)}
              >
                <Text style={styles.itemLabel}>{reason.label}</Text>
                <Text style={styles.itemMeta}>{reason.severity}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.body,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  list: {
    gap: spacing.sm,
  },
  item: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  itemLabel: {
    ...typography.bodySmall,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  itemMeta: {
    ...typography.caption,
    color: colors.neutral[600],
    marginTop: 4,
  },
});
