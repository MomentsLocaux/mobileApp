import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function DeleteAccountScreen() {
  const confirmDelete = () => {
    Alert.alert(
      'Supprimer définitivement',
      'Cette action est définitive. Vos données personnelles seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer définitivement', style: 'destructive' },
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
            Cette action est définitive. Vos données personnelles seront supprimées.
          </Text>
        </View>
        <View style={styles.actions}>
          <Button title="Annuler" variant="secondary" onPress={() => {}} />
          <Button title="Supprimer définitivement" variant="danger" onPress={confirmDelete} />
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
