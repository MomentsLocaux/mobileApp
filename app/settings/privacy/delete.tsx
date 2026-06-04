import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { AuthService } from '@/services/auth.service';
import { useAuthStore } from '@/state/auth';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const resetAuth = useAuthStore((state) => state.reset);
  const [deleting, setDeleting] = useState(false);

  const runDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    const result = await AuthService.requestAccountDeletion();
    setDeleting(false);

    if (!result.success) {
      Alert.alert(
        'Suppression impossible',
        result.error || 'Une erreur est survenue. Réessayez ou contactez le support.'
      );
      return;
    }

    resetAuth();
    Alert.alert(
      'Compte supprimé',
      'Votre compte et vos données personnelles ont été traités. Vous allez être déconnecté.',
      [{ text: 'OK', onPress: () => router.replace('/auth/login' as any) }]
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      'Supprimer définitivement',
      'Cette action est définitive. Vos données privées seront supprimées, vos contenus publics seront anonymisés et vous serez déconnecté.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer définitivement', style: 'destructive', onPress: runDelete },
      ]
    );
  };

  return (
    <SettingsLayout title="Supprimer mon compte">
      <SettingsSectionCard title="Supprimer mon compte" icon={AlertTriangle}>
        <View style={styles.dangerBlock}>
          <AlertTriangle size={24} color={colors.error[600]} />
          <Text style={styles.dangerTitle}>Action définitive</Text>
          <Text style={styles.dangerText}>
            Vos données privées seront supprimées. Les contenus publics nécessaires à la continuité du service seront anonymisés.
          </Text>
        </View>
        <View style={styles.actions}>
          <Button title="Annuler" variant="secondary" onPress={() => router.back()} disabled={deleting} />
          <Button
            title="Supprimer définitivement"
            variant="danger"
            onPress={confirmDelete}
            loading={deleting}
          />
        </View>
      </SettingsSectionCard>
    </SettingsLayout>
  );
}

const styles = StyleSheet.create({
  dangerBlock: {
    marginTop: spacing.sm,
    backgroundColor: '#FFD7D7',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  dangerTitle: {
    ...typography.h4,
    color: colors.error[700],
  },
  dangerText: {
    ...typography.body,
    color: colors.error[700],
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});
