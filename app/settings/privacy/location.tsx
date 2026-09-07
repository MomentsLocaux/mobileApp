import React, { useCallback, useState } from 'react';
import { Alert, Text, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MapPin } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsRow, SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import {
  PreferencesService,
  type LocationVisibility,
} from '@/services/preferences.service';

const OPTIONS: { value: LocationVisibility; label: string; description: string }[] = [
  {
    value: 'nobody',
    label: 'Personne',
    description: 'Votre position n’est visible par aucun autre membre.',
  },
  {
    value: 'followers',
    label: 'Mes abonnés',
    description: 'Seules les personnes qui vous suivent peuvent la consulter.',
  },
  {
    value: 'public',
    label: 'Tout le monde',
    description: 'Les membres connectés peuvent la consulter.',
  },
];

export default function LocationVisibilityScreen() {
  const { profile } = useAuth();
  const [value, setValue] = useState<LocationVisibility>('nobody');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) return;
      let cancelled = false;
      void PreferencesService.getMine(profile.id)
        .then((prefs) => {
          if (!cancelled) setValue(prefs.location_visibility);
        })
        .catch((error) => {
          console.warn('load location visibility', error);
        });
      return () => {
        cancelled = true;
      };
    }, [profile?.id]),
  );

  const select = async (next: LocationVisibility) => {
    if (!profile?.id || saving || next === value) return;
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      await PreferencesService.updateMine(profile.id, { location_visibility: next });
    } catch (error) {
      setValue(previous);
      Alert.alert(
        'Enregistrement impossible',
        error instanceof Error ? error.message : 'Réessayez dans un instant.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsLayout title="Visibilité de ma position">
      <SettingsSectionCard
        title="Qui peut voir ma position"
        icon={MapPin}
        description="Cela concerne uniquement le partage social de votre position. Les alertes d’événements près de chez vous restent un réglage séparé, dans Notifications."
      >
        <View style={styles.stack}>
          {OPTIONS.map((option, index) => (
            <SettingsRow
              key={option.value}
              label={option.label}
              icon={MapPin}
              onPress={() => void select(option.value)}
              disabled={saving}
              showChevron={false}
              noBorder={index === 0}
              right={
                <Text style={[styles.badge, value === option.value && styles.badgeActive]}>
                  {value === option.value ? 'Sélectionné' : ''}
                </Text>
              }
            />
          ))}
        </View>
        <Text style={styles.help}>{OPTIONS.find((option) => option.value === value)?.description}</Text>
      </SettingsSectionCard>
    </SettingsLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    marginTop: spacing.sm,
  },
  badge: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
    minWidth: 84,
    textAlign: 'right',
  },
  badgeActive: {
    color: colors.brand.secondary,
  },
  help: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginTop: spacing.md,
  },
});
