import {
  Bell,
  CalendarClock,
  Gift,
  Heart,
  Info,
  MapPin,
  Moon,
  Navigation,
  Sparkles,
  Users,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsRow, SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { CATEGORY_VISUAL_SLUGS, type CategoryVisualSlug } from '@/constants/category-visuals';
import { DISCOVERY_ENABLED } from '@/config/discovery.flags';
import { features } from '@/config/features';
import { useOfferEntitlements } from '@/hooks/useOfferEntitlements';
import { requestProximityLocationPermissions } from '@/hooks/useProximityAlerts';
import {
  DEFAULT_PREFERENCES,
  type NotifyFrequency,
  PreferencesService,
  THEME_CHIP_LABELS,
  type UserPreferences,
} from '@/services/preferences.service';
import { ProximityAlertService } from '@/services/proximity-alert.service';
import { clearHomeLocation, syncHomeLocation } from '@/services/push.service';
import {
  startProximityBackgroundAlerts,
  stopProximityBackgroundAlerts,
} from '@/tasks/proximity-location';
import { useAuthStore } from '@/state/auth';
import { router } from 'expo-router';

const RADIUS_CHOICES = [10, 25, 50, 100];
const DAILY_BUDGET_CHOICES = [1, 2, 3, 5];
const DISCOVERY_MAX_PUSH_CHOICES = [1, 3, 5, 7, 10];
const FREQUENCY_CHOICES: { value: NotifyFrequency; label: string }[] = [
  { value: 'instant', label: 'Instantané' },
  { value: 'daily', label: 'Quotidien' },
  { value: 'weekly', label: 'Hebdo' },
];

const QUIET_PRESETS: { label: string; start: string | null; end: string | null }[] = [
  { label: 'Off', start: null, end: null },
  { label: '22h–8h', start: '22:00:00', end: '08:00:00' },
  { label: '23h–7h', start: '23:00:00', end: '07:00:00' },
  { label: '21h–9h', start: '21:00:00', end: '09:00:00' },
];

export default function NotificationsSettingsScreen() {
  const userId = useAuthStore((state) => state.user?.id);
  const { hasEclaireur, loading: entitlementLoading } = useOfferEntitlements();
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

  const handleProximityLiveToggle = async (value: boolean) => {
    if (value) {
      const granted = await requestProximityLocationPermissions();
      if (!granted) {
        Toast.show({
          type: 'error',
          text1: 'Permission requise',
          text2: 'Autorisez la localisation « Toujours » pour les alertes à proximité.',
        });
        return;
      }
      await persist({ notify_proximity_live: true });
      await ProximityAlertService.clearLocalThrottle();
      try {
        await startProximityBackgroundAlerts();
      } catch {
        Toast.show({
          type: 'info',
          text1: 'Build natif requis',
          text2: 'Les alertes à proximité nécessitent une build iOS/Android (pas Expo Go).',
        });
      }
      return;
    }

    await persist({ notify_proximity_live: false });
    await stopProximityBackgroundAlerts();
  };

  const toggleTheme = (slug: CategoryVisualSlug) => {
    if (!prefs) return;
    const current = new Set(prefs.preferred_category_slugs);
    if (current.has(slug)) current.delete(slug);
    else current.add(slug);
    void persist({ preferred_category_slugs: [...current] });
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

  const quietActive = QUIET_PRESETS.find(
    (p) => p.start === prefs.quiet_hours_start && p.end === prefs.quiet_hours_end,
  );

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
        title="Combien et quand"
        description="Pour ne pas être dérangé trop souvent. Les messages importants (refus d’un événement, compte) passent toujours."
        icon={Moon}
      >
        <ChoiceGroup label="Alertes par jour (max)" noBorder>
          {DAILY_BUDGET_CHOICES.map((count) => (
            <Chip
              key={count}
              label={`${count}`}
              active={prefs.max_push_per_day === count}
              onPress={() => persist({ max_push_per_day: count })}
            />
          ))}
        </ChoiceGroup>
        <View style={styles.infoBox}>
          <Info size={16} color={colors.brand.secondary} />
          <Text style={styles.infoText}>
            Au-delà, l’alerte reste visible dans l’onglet Notifications, sans bannière sur
            l’écran verrouillé.
          </Text>
        </View>
        <ChoiceGroup label="Ne pas déranger">
          {QUIET_PRESETS.map((preset) => (
            <Chip
              key={preset.label}
              label={preset.label === 'Off' ? 'Désactivé' : preset.label}
              active={
                quietActive
                  ? quietActive.label === preset.label
                  : preset.start === null &&
                    prefs.quiet_hours_start === null &&
                    prefs.quiet_hours_end === null
              }
              onPress={() =>
                persist({
                  quiet_hours_start: preset.start,
                  quiet_hours_end: preset.end,
                })
              }
            />
          ))}
        </ChoiceGroup>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Types d'alertes"
        description="Activez seulement ce qui vous intéresse."
        icon={Bell}
      >
        <SettingsRow
          label="Nouveaux moments près de moi"
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
                On utilise votre position quand vous ouvrez l’app (pas de suivi en
                arrière-plan). Vous êtes alerté quand un nouveau moment est publié dans ce
                rayon — pas quand vous passez devant en marchant.
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
          label="Moments en cours / bientôt près de moi"
          icon={Navigation}
          right={
            <Switch
              value={prefs.notify_proximity_live}
              onValueChange={handleProximityLiveToggle}
            />
          }
        />
        {prefs.notify_proximity_live && (
          <View style={styles.infoBox}>
            <Info size={16} color={colors.brand.secondary} />
            <Text style={styles.infoText}>
              Localisation en arrière-plan (opt-in). On vous prévient quand vous vous
              approchez d’un moment déjà publié, en cours ou bientôt. Distinct de Discovery
              et des alertes « nouveaux moments ». Désactivez à tout moment.
            </Text>
          </View>
        )}

        <SettingsRow
          label="Créateurs que je suis"
          icon={Users}
          right={
            <Switch
              value={prefs.notify_followed_creator}
              onValueChange={(value) => persist({ notify_followed_creator: value })}
            />
          }
        />
        <SettingsRow
          label="Rappels avant le début"
          icon={CalendarClock}
          right={
            <Switch
              value={prefs.notify_event_reminders}
              onValueChange={(value) => persist({ notify_event_reminders: value })}
            />
          }
        />
        <SettingsRow
          label="Likes et nouveaux abonnés"
          icon={Heart}
          right={
            <Switch
              value={prefs.notify_social}
              onValueChange={(value) => persist({ notify_social: value })}
            />
          }
        />
        <SettingsRow
          label="Récompenses et missions"
          icon={Gift}
          right={
            <Switch
              value={prefs.notify_rewards}
              onValueChange={(value) => persist({ notify_rewards: value })}
            />
          }
        />
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Mes thèmes"
        description="Aidez-nous à prioriser les bons moments. Sans choix, on vous propose tout le rayon."
        icon={Sparkles}
      >
        <ChoiceGroup label="Centres d’intérêt" noBorder>
          {CATEGORY_VISUAL_SLUGS.map((slug) => (
            <Chip
              key={slug}
              label={THEME_CHIP_LABELS[slug]}
              active={prefs.preferred_category_slugs.includes(slug)}
              onPress={() => toggleTheme(slug)}
            />
          ))}
        </ChoiceGroup>
      </SettingsSectionCard>

      {DISCOVERY_ENABLED && !entitlementLoading && hasEclaireur && (
      <SettingsSectionCard
        title="Suggestions Discovery"
        description="Idées personnalisées selon vos habitudes (Éclaireur)."
        icon={Sparkles}
      >
        <SettingsRow
          label="Suggestions personnalisées"
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
              label="Idées pour maintenant"
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
              label="Tendances de vos sorties"
              icon={Info}
              right={
                <Switch
                  value={prefs.life_insight_push_enabled}
                  onValueChange={(value) => persist({ life_insight_push_enabled: value })}
                />
              }
            />
            <ChoiceGroup label="Suggestions max par semaine">
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

      {DISCOVERY_ENABLED && features.offers && !entitlementLoading && !hasEclaireur && (
        <SettingsSectionCard
          title="Suggestions Discovery"
          description="Réservé aux Éclaireurs — idées selon vos habitudes de sortie."
          icon={Sparkles}
        >
          <SettingsRow
            label="Découvrir Éclaireur"
            icon={Sparkles}
            onPress={() => router.push('/profile/offers' as any)}
            noBorder
          />
        </SettingsSectionCard>
      )}

      <SettingsSectionCard
        title="Rythme des alertes"
        description="Pour les nouveaux moments près de vous et les publications des créateurs suivis. Les rappels « ça commence bientôt » restent tout de suite."
        icon={CalendarClock}
      >
        <ChoiceGroup label="Quand m’alerter ?" noBorder>
          {FREQUENCY_CHOICES.map((option) => (
            <Chip
              key={option.value}
              label={
                option.value === 'instant'
                  ? 'Tout de suite'
                  : option.value === 'daily'
                    ? 'Une fois par jour'
                    : 'Une fois par semaine'
              }
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
