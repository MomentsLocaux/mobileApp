import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { User } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';

export default function PersonalInfoScreen() {
  return (
    <SettingsLayout title="Informations personnelles">
      <SettingsSectionCard title="Profil" icon={User}>
        <View style={styles.block}>
          <Text style={styles.text}>
            Mettez à jour votre nom, photo, bio et informations visibles sur votre profil.
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
