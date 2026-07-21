import { Bell, CalendarClock, Gift, Heart, Info, MapPin, Sparkles, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsRow, SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { DISCOVERY_ENABLED } from '@/config/discovery.flags';
import {
  DEFAULT_PREFERENCES,
  type NotifyFrequency,
  PreferencesService,
  type UserPreferences,
} from '@/services/preferences.service';
import { clearHomeLocation, syncHomeLocation } from '@/services/push.service';
import { useAuthStore } from '@/state/auth';

const RADIUS_CHOICES = [10, 25, 50, 100];
const DISCOVERY_MAX_PUSH_CHOICES = [1, 3, 5, 7, 10];
const FREQUENCY_CHOICES: { value: NotifyFrequency; label: string }[] = [
  { value: 'instant', label: 'Instantané' },
  { value: 'daily', label: 'Quotidien' },
  { value: 'weekly', label: 'Hebdo' },
];

export default function NotificationsSettingsScreen() {
  const userId = useAuthStore((state) => state.user?.id);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!userId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await PreferencesService.getMine(userId);
        if (mounted) setPrefs(data);
      } catch {
        if (mounted) {
          setPrefs({ user_id: userId, ...DEFAULT_PREFERENCES });
          Toast.show({ type: 'error', text1: 'Impossible de charger les préférences' });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const persist = async (patch: Partial<Omit<UserPreferences, 'user_id'>>) => {
    if (!prefs || !userId) return;
    const previous = prefs;
    setPrefs({ ...prefs, ...patch });
    try {
      await PreferencesService.updateMine(userId, patch);
    } catch {
      setPrefs(previous);
      Toast.show({ type: 'error', text1: 'Échec de la mise à jour' });
    }
  };

  const handleNearbyToggle = async (value: boolean) => {
    await persist({ notify_event_nearby: value });
    if (value) {
      const ok = await syncHomeLocation({ prompt: true });
      if (!ok) {
        Toast.show({
          type: 'info',
          text1: 'Localisation requise',
          text2: 'Autorisez la localisation pour recevoir les alertes de proximité.',
        });
      }
    } else {
      clearHomeLocation();
    }
  };

  if (loading) {
    return (
      <SettingsLayout title="Notifications">
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand.secondary} />
        </View>
      </SettingsLayout>
    );
  }

  if (!prefs) {
    return (
      <SettingsLayout title="Notifications">
        <View style={styles.helper}>
          <Text style={styles.helperText}>Connectez-vous pour gérer vos notifications.</Text>
        </View>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="Notifications">
      <SettingsSectionCard
        title="Notifications push"
        description="Recevez les alertes directement sur votre téléphone."
        icon={Bell}
      >
        <SettingsRow
          label="Activer les notifications push"
          icon={Bell}
          noBorder
          right={
            <Switch
              value={prefs.push_enabled}
              onValueChange={(value) => persist({ push_enabled: value })}
            />
          }
        />
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Types d'alertes"
        description="Choisissez les événements qui déclenchent une notification."
        icon={Bell}
      >
        <SettingsRow
          label="Événements près de chez moi"
          icon={MapPin}
          noBorder
          right={
            <Switch value={prefs.notify_event_nearby} onValueChange={handleNearbyToggle} />
          }
        />

        {prefs.notify_event_nearby && (
          <>
            <View style={styles.infoBox}>
              <Info size={16} color={colors.brand.secondary} />
              <Text style={styles.infoText}>
                Autorisez la localisation « Pendant l'utilisation ». Nous mémorisons votre dernière
                position à l'ouverture de l'app pour vous alerter — la localisation en arrière-plan
                n'est pas nécessaire.
              </Text>
            </View>
            <ChoiceGroup label="Rayon">
              {RADIUS_CHOICES.map((km) => (
                <Chip
                  key={km}
                  label={`${km} km`}
                  active={prefs.notify_radius_km === km}
                  onPress={() => persist({ notify_radius_km: km })}
                />
              ))}
            </ChoiceGroup>
          </>
        )}

        <SettingsRow
          label="Créateurs suivis"
          icon={Users}
          right={
            <Switch
              value={prefs.notify_followed_creator}
              onValueChange={(value) => persist({ notify_followed_creator: value })}
            />
          }
        />
        <SettingsRow
          label="Rappels d'événements"
          icon={CalendarClock}
          right={
            <Switch
              value={prefs.notify_event_reminders}
              onValueChange={(value) => persist({ notify_event_reminders: value })}
            />
          }
        />
        <SettingsRow
          label="Activité sociale"
          icon={Heart}
          right={
            <Switch
              value={prefs.notify_social}
              onValueChange={(value) => persist({ notify_social: value })}
            />
          }
        />
        <SettingsRow
          label="Récompenses"
          icon={Gift}
          right={
            <Switch
              value={prefs.notify_rewards}
              onValueChange={(value) => persist({ notify_rewards: value })}
            />
          }
        />
      </SettingsSectionCard>

      {DISCOVERY_ENABLED && (
        <SettingsSectionCard
          title="Suggestions Discovery"
          description="Alertes personnalisées basées sur vos habitudes (Moments Locaux+)."
          icon={Sparkles}
        >
          <SettingsRow
            label="Notifications Discovery"
            icon={Sparkles}
            noBorder={!prefs.discovery_push_enabled}
            right={
              <Switch
                value={prefs.discovery_push_enabled}
                onValueChange={(value) =>
                  persist({
                    discovery_push_enabled: value,
                    ...(value
                      ? {}
                      : {
                          right_now_push_enabled: false,
                          break_loop_push_enabled: false,
                          life_insight_push_enabled: false,
                        }),
                  })
                }
              />
            }
          />

          {prefs.discovery_push_enabled && (
            <>
              <SettingsRow
                label="Opportunités immédiates"
                icon={MapPin}
                right={
                  <Switch
                    value={prefs.right_now_push_enabled}
                    onValueChange={(value) => persist({ right_now_push_enabled: value })}
                  />
                }
              />
              <SettingsRow
                label="Sortir de la routine"
                icon={Heart}
                right={
                  <Switch
                    value={prefs.break_loop_push_enabled}
                    onValueChange={(value) => persist({ break_loop_push_enabled: value })}
                  />
                }
              />
              <SettingsRow
                label="Insights de vie"
                icon={Info}
                right={
                  <Switch
                    value={prefs.life_insight_push_enabled}
                    onValueChange={(value) => persist({ life_insight_push_enabled: value })}
                  />
                }
              />
              <ChoiceGroup label="Maximum par semaine">
                {DISCOVERY_MAX_PUSH_CHOICES.map((count) => (
                  <Chip
                    key={count}
                    label={`${count}`}
                    active={prefs.discovery_max_push_per_week === count}
                    onPress={() => persist({ discovery_max_push_per_week: count })}
                  />
                ))}
              </ChoiceGroup>
            </>
          )}
        </SettingsSectionCard>
      )}

      <SettingsSectionCard
        title="Fréquence"
        description="À quelle cadence souhaitez-vous être notifié ?"
        icon={CalendarClock}
      >
        <ChoiceGroup label="Cadence" noBorder>
          {FREQUENCY_CHOICES.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              active={prefs.notify_frequency === option.value}
              onPress={() => persist({ notify_frequency: option.value })}
            />
          ))}
        </ChoiceGroup>
      </SettingsSectionCard>
    </SettingsLayout>
  );
}

function ChoiceGroup({
  label,
  children,
  noBorder,
}: {
  label: string;
  children: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <View style={[styles.choiceGroup, noBorder && styles.choiceGroupNoBorder]}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.chipRow}>{children}</View>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  helper: {
    paddingHorizontal: spacing.md,
  },
  helperText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(43,191,227,0.08)',
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  infoText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    flex: 1,
    flexShrink: 1,
    lineHeight: 18,
  },
  choiceGroup: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: spacing.sm,
  },
  choiceGroupNoBorder: {
    borderTopWidth: 0,
  },
  choiceLabel: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.brand.secondary,
    borderColor: colors.brand.secondary,
  },
  chipText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.brand.primary,
  },
});
