import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Mail } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';

export default function EmailAuthScreen() {
  return (
    <SettingsLayout title="Email & authentification">
      <SettingsSectionCard title="Email" icon={Mail}>
        <View style={styles.block}>
          <Text style={styles.text}>
            Gérez votre email principal et vos options d’authentification.
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
