import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Cookie } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';

export default function CookiesPolicyScreen() {
  return (
    <SettingsLayout title="Politique des cookies">
      <SettingsSectionCard title="Politique des cookies" icon={Cookie}>
        <View style={styles.block}>
          <Text style={styles.text}>
            Découvrez comment Moments Locaux utilise les cookies et technologies similaires.
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
