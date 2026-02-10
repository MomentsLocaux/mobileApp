import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FileText } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';

export default function PrivacyPolicyScreen() {
  return (
    <SettingsLayout title="Politique de confidentialité">
      <SettingsSectionCard title="Politique de confidentialité" icon={FileText}>
        <View style={styles.block}>
          <Text style={styles.heading}>1. Données collectées</Text>
          <Text style={styles.text}>
            Nous collectons les informations nécessaires à la création de votre profil et à l’utilisation des services.
          </Text>
          <Text style={styles.heading}>2. Utilisation</Text>
          <Text style={styles.text}>
            Les données servent à personnaliser votre expérience, sécuriser la plateforme et améliorer nos services.
          </Text>
          <Text style={styles.heading}>3. Conservation</Text>
          <Text style={styles.text}>
            Les données sont conservées tant que votre compte est actif ou selon les obligations légales.
          </Text>
        </View>
      </SettingsSectionCard>
    </SettingsLayout>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  heading: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  text: {
    ...typography.body,
    color: colors.neutral[600],
    lineHeight: 20,
  },
});
