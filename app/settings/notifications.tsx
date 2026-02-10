import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import Toast from 'react-native-toast-message';
import { Bell, MapPin, Star } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard, SettingsRow } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';
import { useLocationStore } from '@/store';

export default function NotificationsSettingsScreen() {
  const { permissionGranted } = useLocationStore();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [localEnabled, setLocalEnabled] = useState(true);
  const [recommendEnabled, setRecommendEnabled] = useState(true);

  useEffect(() => {
    if (!permissionGranted) {
      setLocalEnabled(false);
    }
  }, [permissionGranted]);

  const showToast = () => {
    Toast.show({ type: 'success', text1: 'Notifications mises à jour' });
  };

  return (
    <SettingsLayout title="Notifications">
      <SettingsSectionCard title="Notifications" icon={Bell}>
        <SettingsRow
          label="Notifications push"
          icon={Bell}
          right={
            <Switch
              value={pushEnabled}
              onValueChange={(value) => {
                setPushEnabled(value);
                showToast();
              }}
            />
          }
          noBorder
        />
        <SettingsRow
          label="Notifications locales"
          icon={MapPin}
          right={
            <Switch
              value={localEnabled}
              onValueChange={(value) => {
                if (!permissionGranted) return;
                setLocalEnabled(value);
                showToast();
              }}
              disabled={!permissionGranted}
            />
          }
          disabled={!permissionGranted}
        />
        <SettingsRow
          label="Recommandations personnalisées"
          icon={Star}
          right={
            <Switch
              value={recommendEnabled}
              onValueChange={(value) => {
                setRecommendEnabled(value);
                showToast();
              }}
            />
          }
        />
      </SettingsSectionCard>

      {!permissionGranted && (
        <View style={styles.helper}>
          <Text style={styles.helperText}>
            Activez la localisation pour gérer les notifications locales.
          </Text>
        </View>
      )}
    </SettingsLayout>
  );
}

const styles = StyleSheet.create({
  helper: {
    paddingHorizontal: spacing.md,
  },
  helperText: {
    ...typography.caption,
    color: colors.neutral[500],
  },
});
