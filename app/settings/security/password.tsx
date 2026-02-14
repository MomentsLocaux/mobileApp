import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Key } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/components/ui/v2';

export default function ChangePasswordScreen() {
  return (
    <SettingsLayout title="Changer le mot de passe">
      <SettingsSectionCard title="Mot de passe" icon={Key}>
        <View style={styles.block}>
          <Text style={styles.text}>
            Mettez à jour votre mot de passe pour sécuriser votre compte.
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
    color: colors.textSecondary,
  },
});
