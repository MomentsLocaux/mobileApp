import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { Button, colors, radius, spacing, typography } from '@/components/ui/v2';

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
          <AlertTriangle size={24} color={colors.danger} />
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
    backgroundColor: 'rgba(255, 90, 102, 0.18)',
    borderRadius: radius.element,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 102, 0.35)',
  },
  dangerTitle: {
    ...typography.subsection,
    color: colors.danger,
  },
  dangerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});
