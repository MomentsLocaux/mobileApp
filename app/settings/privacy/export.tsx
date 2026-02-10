import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Download } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';

export default function ExportDataScreen() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Toast.show({ type: 'success', text1: 'Un lien de téléchargement vous sera envoyé.' });
    }, 800);
  };

  return (
    <SettingsLayout title="Exporter mes données">
      <SettingsSectionCard title="Exporter mes données" icon={Download}>
        <View style={styles.block}>
          <Text style={styles.text}>
            Vous pouvez télécharger une copie de vos données personnelles (profil, événements, interactions).
          </Text>
          <View style={styles.buttonRow}>
            <Button title="Exporter mes données" variant="secondary" onPress={handleExport} loading={loading} />
          </View>
        </View>
      </SettingsSectionCard>
    </SettingsLayout>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  text: {
    ...typography.body,
    color: colors.neutral[600],
  },
  buttonRow: {
    alignItems: 'flex-start',
  },
});
