import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { HelpCircle, X } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { formatReasonCodes } from '@/utils/discovery-reason-labels';

type Props = {
  visible: boolean;
  reasonCodes: string[];
  onClose: () => void;
};

export function WhyThisSheet({ visible, reasonCodes, onClose }: Props) {
  const reasons = formatReasonCodes(reasonCodes);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <HelpCircle size={18} color={colors.brand.secondary} />
              <Text style={styles.title}>Pourquoi cette suggestion ?</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.brand.textSecondary} />
            </TouchableOpacity>
          </View>
          {reasons.map((reason) => (
            <Text key={reason} style={styles.reason}>
              • {reason}
            </Text>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.brand.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.brand.text,
  },
  reason: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.sm,
  },
});
