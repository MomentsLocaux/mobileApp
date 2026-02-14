import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/components/ui/v2';

export default function AccountSecurityScreen() {
  return (
    <SettingsLayout title="Sécurité du compte">
      <SettingsSectionCard title="Sécurité du compte" icon={ShieldCheck}>
        <View style={styles.block}>
          <Text style={styles.text}>
            Contrôlez les réglages de sécurité avancés de votre compte.
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
