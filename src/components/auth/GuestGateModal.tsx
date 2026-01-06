import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSignUp: () => void;
  onSignIn?: () => void;
};

export const GuestGateModal = ({ visible, title, onClose, onSignUp, onSignIn }: Props) => (
  <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>Cette fonctionnalité est réservée aux membres de Moments Locaux.</Text>
        <Text style={styles.value}>
          Créez un compte pour publier, enregistrer vos découvertes et participer à la vie locale.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={onSignUp}>
          <Text style={styles.primaryButtonText}>Créer un compte</Text>
        </TouchableOpacity>
        {onSignIn ? (
          <TouchableOpacity style={styles.linkButton} onPress={onSignIn}>
            <Text style={styles.linkText}>Se connecter</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Fermer</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.h4,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  message: {
    ...typography.body,
    color: colors.neutral[700],
  },
  value: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  primaryButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.neutral[0],
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.primary[700],
    fontWeight: '600',
  },
  closeButton: {
    alignItems: 'center',
  },
  closeText: {
    ...typography.bodySmall,
    color: colors.neutral[500],
  },
});
