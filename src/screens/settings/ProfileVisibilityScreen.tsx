import React, { useCallback, useState } from 'react';
import { Alert, Text, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Lock, Globe } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsRow, SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { ProfileService } from '@/services/profile.service';
import { CommunityService } from '@/services/community.service';
import { useAuthStore } from '@/state/auth';
import { normalizeProfileVisibility, type ProfileMessagingVisibility } from '@/utils/messaging-access';

const OPTIONS: { value: ProfileMessagingVisibility; label: string; description: string; icon: typeof Globe }[] = [
  {
    value: 'public',
    label: 'Public',
    description: 'Les membres connectés peuvent t’écrire sans être amis.',
    icon: Globe,
  },
  {
    value: 'private',
    label: 'Privé',
    description: 'Il faut devenir ami (suivi mutuel) avant d’envoyer un message.',
    icon: Lock,
  },
];

export default function ProfileVisibilityScreen() {
  const { profile } = useAuth();
  const setProfile = useAuthStore((state) => state.setProfile);
  const [value, setValue] = useState<ProfileMessagingVisibility>(
    normalizeProfileVisibility(profile?.profile_visibility),
  );
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) return;
      let cancelled = false;
      void CommunityService.getProfileVisibility(profile.id)
        .then((next) => {
          if (!cancelled) setValue(next);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [profile?.id]),
  );

  const select = async (next: ProfileMessagingVisibility) => {
    if (!profile?.id || saving || next === value) return;
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      const updated = await ProfileService.updateProfile(profile.id, { profile_visibility: next });
      if (updated) setProfile({ ...profile, ...updated, profile_visibility: next });
    } catch (error) {
      setValue(previous);
      Alert.alert(
        'Enregistrement impossible',
        error instanceof Error
          ? error.message
          : 'La visibilité du profil sera active après mise à jour serveur.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsLayout title="Visibilité du profil">
      <SettingsSectionCard
        title="Qui peut t’écrire"
        icon={Lock}
        description="Un ami est une personne que tu suis et qui te suit en retour. Ton profil reste trouvable dans Membres."
      >
        <View style={styles.stack}>
          {OPTIONS.map((option, index) => (
            <SettingsRow
              key={option.value}
              label={option.label}
              icon={option.icon}
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
