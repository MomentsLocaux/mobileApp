import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Laptop } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/components/ui/v2';

export default function ActiveSessionsScreen() {
  return (
    <SettingsLayout title="Connexions actives">
      <SettingsSectionCard title="Connexions actives" icon={Laptop}>
        <View style={styles.block}>
          <Text style={styles.text}>
            Consultez et gérez les appareils connectés à votre compte.
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
