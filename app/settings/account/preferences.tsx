import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Compass } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';

export default function PreferencesScreen() {
  return (
    <SettingsLayout title="Préférences utilisateur">
      <SettingsSectionCard title="Préférences" icon={Compass}>
        <View style={styles.block}>
          <Text style={styles.text}>
            Définissez vos préférences d’affichage, langues et centres d’intérêt.
          </Text>
        </View>
      </SettingsSectionCard>
    </SettingsLayout>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingTop: spacing.sm,
  },
  text: {
    ...typography.body,
    color: colors.neutral[600],
  },
});
