import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { BrandIcon, type BrandIconName } from '@/components/ui/BrandIcon';
import { features } from '@/config/features';
import { borderRadius, colors, minimumTouchTarget, spacing, typography } from '@/constants/theme';
import { requestProximityLocationPermissions } from '@/hooks/useProximityAlerts';
import {
  type NotifyFrequency,
  PreferencesService,
} from '@/services/preferences.service';
import { ProximityAlertService } from '@/services/proximity-alert.service';
import {
  registerForPushNotificationsAsync,
  requestNotificationPermission,
} from '@/services/push.service';
import { startProximityBackgroundAlerts } from '@/tasks/proximity-location';
import { haptics } from '@/utils/haptics';

type GrantState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export type OnboardingAlertPack = {
  radiusKm: number;
  frequency: NotifyFrequency;
  maxPerDay: number;
  quietStart: string | null;
  quietEnd: string | null;
  proximityLive: boolean;
};

export const DEFAULT_ONBOARDING_ALERT_PACK: OnboardingAlertPack = {
  radiusKm: 25,
  frequency: 'instant',
  maxPerDay: 5,
  quietStart: '22:00:00',
  quietEnd: '08:00:00',
  proximityLive: true,
};

const RADIUS_CHOICES = [10, 25, 50, 100];
const DAILY_BUDGET_CHOICES = [1, 2, 3, 5];
const FREQUENCY_CHOICES: { value: NotifyFrequency; label: string }[] = [
  { value: 'instant', label: 'Tout de suite' },
  { value: 'daily', label: 'Une fois par jour' },
  { value: 'weekly', label: 'Une fois par semaine' },
];
const QUIET_PRESETS: { label: string; start: string | null; end: string | null }[] = [
  { label: 'Désactivé', start: null, end: null },
  { label: '22h–8h', start: '22:00:00', end: '08:00:00' },
  { label: '23h–7h', start: '23:00:00', end: '07:00:00' },
  { label: '21h–9h', start: '21:00:00', end: '09:00:00' },
];

const hourLabel = (value: string) => String(Number(value.slice(0, 2)));

export function onboardingPackLines(pack: OnboardingAlertPack): string[] {
  const rhythm =
    pack.frequency === 'daily'
      ? 'une fois par jour'
      : pack.frequency === 'weekly'
        ? 'une fois par semaine'
        : 'dès qu’ils sont publiés';
  const alerts = pack.maxPerDay > 1 ? 'alertes' : 'alerte';
  const budget =
    pack.quietStart && pack.quietEnd
      ? `${pack.maxPerDay} ${alerts} par jour au plus, et silence de ${hourLabel(pack.quietStart)} h à ${hourLabel(pack.quietEnd)} h`
      : `${pack.maxPerDay} ${alerts} par jour au plus, y compris la nuit`;
  const lines = [
    `Nouveaux moments dans un rayon de ${pack.radiusKm} km, ${rhythm}`,
    'Rappel avant un moment que tu as gardé',
  ];
  if (features.socialPeers) {
    lines.push('Un nouvel abonné, ou un like');
  }
  lines.push(budget);
  return lines;
}

const fromStatus = (status: string | undefined): GrantState => {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
};

const statusLabel: Record<GrantState, string> = {
  granted: 'Autorisé',
  denied: 'Refusé',
  undetermined: 'Pas encore demandé',
  unavailable: 'Indisponible sur cet appareil',
};

async function readPhonePermissions(): Promise<{ notifications: GrantState; location: GrantState }> {
  if (Platform.OS === 'web') {
    return { notifications: 'unavailable', location: 'unavailable' };
  }
  const [notifications, location] = await Promise.allSettled([
    Notifications.getPermissionsAsync(),
    Location.getForegroundPermissionsAsync(),
  ]);
  return {
    notifications:
      notifications.status === 'fulfilled' ? fromStatus(notifications.value.status) : 'unavailable',
    location: location.status === 'fulfilled' ? fromStatus(location.value.status) : 'unavailable',
  };
}

/**
 * Asks for the system dialogs that are still unanswered, then writes the
 * recommended alert pack. A refusal does not undo the other choices.
 * The neighborhood chosen on the previous step stays the home location.
 */
export async function applyOnboardingPermissionPack(
  userId: string,
  pack: OnboardingAlertPack,
): Promise<void> {
  const base = {
    notify_event_nearby: true,
    notify_radius_km: pack.radiusKm,
    notify_frequency: pack.frequency,
    notify_event_reminders: true,
    notify_social: true,
    max_push_per_day: pack.maxPerDay,
    quiet_hours_start: pack.quietStart,
    quiet_hours_end: pack.quietEnd,
    notify_proximity_live: false,
  };

  try {
    if (Platform.OS === 'web') {
      await PreferencesService.updateMine(userId, base);
      return;
    }

    let pushEnabled: boolean | undefined;
    try {
      const before = await Notifications.getPermissionsAsync();
      const granted = before.status === 'granted' ? true : await requestNotificationPermission();
      if (granted) {
        pushEnabled = true;
      } else {
        const after = await Notifications.getPermissionsAsync();
        if (after.status === 'denied') pushEnabled = false;
      }
    } catch (error) {
      console.warn('[onboarding] notification permission sync failed', error);
    }

    await PreferencesService.updateMine(userId, {
      ...base,
      ...(pushEnabled === undefined ? {} : { push_enabled: pushEnabled }),
    });
    if (pushEnabled) {
      await registerForPushNotificationsAsync(userId);
    }

    try {
      const foreground = await Location.getForegroundPermissionsAsync();
      if (foreground.status !== 'granted' && foreground.status !== 'denied') {
        await Location.requestForegroundPermissionsAsync();
      }
    } catch (error) {
      console.warn('[onboarding] foreground location request failed', error);
    }

    if (!pack.proximityLive) return;

    const backgroundGranted = await requestProximityLocationPermissions();
    if (!backgroundGranted) return;
    await PreferencesService.updateMine(userId, { notify_proximity_live: true });
    await ProximityAlertService.clearLocalThrottle();
    try {
      await startProximityBackgroundAlerts();
    } catch (error) {
      console.warn('[onboarding] proximity task start failed', error);
    }
  } catch (error) {
    console.warn('[onboarding] alert pack save failed', error);
  }
}

type Props = {
  pack: OnboardingAlertPack;
  onChange: (pack: OnboardingAlertPack) => void;
};

export function OnboardingPermissionsStep({ pack, onChange }: Props) {
  const [phone, setPhone] = useState<{ notifications: GrantState; location: GrantState }>({
    notifications: 'undetermined',
    location: 'undetermined',
  });
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    const next = await readPhonePermissions();
    setPhone(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const notificationsSettled = phone.notifications === 'granted';
  const locationSettled = phone.location === 'granted';
  const bothSettled = notificationsSettled && locationSettled;
  const canAsk =
    phone.notifications === 'undetermined' || phone.location === 'undetermined';
  const actionLabel = canAsk ? 'Activer' : 'Réglages';

  const activate = async () => {
    haptics.selection();
    if (!canAsk) {
      await Linking.openSettings().catch(() => undefined);
      return;
    }
    setBusy(true);
    try {
      if (phone.notifications === 'undetermined') {
        await requestNotificationPermission();
      }
      if (phone.location === 'undetermined') {
        await Location.requestForegroundPermissionsAsync();
      }
    } catch (error) {
      console.warn('[onboarding] phone permission request failed', error);
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const patch = (next: Partial<OnboardingAlertPack>) => {
    haptics.selection();
    onChange({ ...pack, ...next });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">On te prévient au bon moment</Text>
      <Text style={styles.subtitle}>
        Des nouvelles près de toi, à ton rythme. Tout reste ajustable dans Paramètres.
      </Text>

      <PhoneRow
        icon="bell"
        title="Notifications"
        reason="Pour les découvertes et les rappels de tes moments."
        status={phone.notifications}
      />
      <PhoneRow
        icon="pin"
        title="Position pendant l’usage"
        reason="Pour centrer la carte. Ton quartier reste ton point de départ."
        status={phone.location}
      />
      {Platform.OS !== 'web' && !bothSettled ? (
        <Pressable
          style={styles.action}
          onPress={() => void activate()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          {busy ? (
            <ActivityIndicator color={colors.brand.secondary} />
          ) : (
            <Text style={styles.actionLabel}>{actionLabel}</Text>
          )}
        </Pressable>
      ) : null}

      <View style={styles.summary}>
        <Text style={styles.section}>Tes alertes</Text>
        <Text style={styles.summaryTitle}>
          Autour de toi, à {pack.radiusKm} km
        </Text>
        <Text style={styles.reason}>
          {FREQUENCY_CHOICES.find((choice) => choice.value === pack.frequency)?.label}
          {' · '}{pack.maxPerDay} alerte{pack.maxPerDay > 1 ? 's' : ''}/jour maximum
          {pack.quietStart && pack.quietEnd
            ? ` · Silence de ${hourLabel(pack.quietStart)} h à ${hourLabel(pack.quietEnd)} h`
            : ' · Y compris la nuit'}
        </Text>
        <Text style={styles.reason}>
          Rappels de tes moments{features.socialPeers ? ', nouveaux abonnés et j’aime' : ''} inclus.
        </Text>
      </View>
      <Pressable
        onPress={() => {
          haptics.selection();
          setExpanded((value) => !value);
        }}
        style={styles.adjust}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Replier les réglages' : 'Ajuster les alertes'}
      >
        <View style={styles.adjustCopy}>
          <Text style={styles.adjustLabel}>{expanded ? 'Replier' : 'Ajuster'}</Text>
          <Text style={styles.adjustHint}>Rayon, rythme, nuit, nombre d’alertes</Text>
        </View>
        {expanded ? (
          <ChevronUp size={20} color={colors.brand.secondary} strokeWidth={2.4} />
        ) : (
          <ChevronDown size={20} color={colors.brand.secondary} strokeWidth={2.4} />
        )}
      </Pressable>
      {expanded ? (
        <View style={styles.adjustPanel}>
          {onboardingPackLines(pack).map((line) => (
            <View key={line} style={styles.checkRow}>
              <Check size={16} color={colors.brand.text} strokeWidth={2.6} />
              <Text style={styles.checkText}>{line}</Text>
            </View>
          ))}
          <ChoiceGroup label="Rayon">
            {RADIUS_CHOICES.map((km) => (
              <Chip
                key={km}
                label={`${km} km`}
                active={pack.radiusKm === km}
                onPress={() => patch({ radiusKm: km })}
              />
            ))}
          </ChoiceGroup>
          <ChoiceGroup label="Rythme des nouveaux moments">
            {FREQUENCY_CHOICES.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={pack.frequency === option.value}
                onPress={() => patch({ frequency: option.value })}
              />
            ))}
          </ChoiceGroup>
          <ChoiceGroup label="La nuit">
            {QUIET_PRESETS.map((preset) => (
              <Chip
                key={preset.label}
                label={preset.label}
                active={pack.quietStart === preset.start && pack.quietEnd === preset.end}
                onPress={() => patch({ quietStart: preset.start, quietEnd: preset.end })}
              />
            ))}
          </ChoiceGroup>
          <ChoiceGroup label="Alertes par jour">
            {DAILY_BUDGET_CHOICES.map((count) => (
              <Chip
                key={count}
                label={`${count}`}
                active={pack.maxPerDay === count}
                onPress={() => patch({ maxPerDay: count })}
              />
            ))}
          </ChoiceGroup>
        </View>
      ) : null}

      <View style={styles.proximity}>
        <View style={styles.proximityCopy}>
          <View style={styles.proximityTitleRow}>
            <BrandIcon name="navigation" size={22} />
            <Text style={styles.proximityTitle}>Quand je passe à côté</Text>
          </View>
          <Text style={styles.reason}>
            Si un moment est en cours à moins de 500 m, on te le signale. Ça utilise la
            localisation en arrière-plan, uniquement pour ça. Tu coupes quand tu veux.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Quand je passe à côté"
          value={pack.proximityLive}
          onValueChange={(proximityLive) => patch({ proximityLive })}
          trackColor={{ false: colors.neutral[300], true: colors.primary[200] }}
          thumbColor={pack.proximityLive ? colors.brand.secondary : colors.neutral[100]}
        />
      </View>

      <Text style={styles.note}>
        Les photos et l’appareil photo seront demandés quand tu ajouteras un portrait.
      </Text>
    </View>
  );
}

function PhoneRow({
  icon,
  title,
  reason,
  status,
}: {
  icon: BrandIconName;
  title: string;
  reason: string;
  status: GrantState;
}) {
  const settled = status === 'granted';
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <BrandIcon name={icon} size={28} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.reason}>{reason}</Text>
        <Text style={[styles.status, settled && styles.statusGranted]}>{statusLabel[status]}</Text>
      </View>
      {settled ? <Check size={18} color={colors.brand.secondary} strokeWidth={2.4} /> : null}
    </View>
  );
}

function ChoiceGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.choiceGroup}>
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
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  summary: { gap: spacing.sm, paddingTop: spacing.md },
  summaryTitle: { ...typography.h5, color: colors.brand.text },
  title: {
    ...typography.h2,
    letterSpacing: -0.6,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
  },
  section: {
    ...typography.label,
    color: colors.brand.textSecondary,
    marginTop: spacing.xs,
  },
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand.line,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.h6,
    color: colors.brand.text,
  },
  reason: {
    ...typography.bodySmall,
    lineHeight: 21,
    color: colors.brand.textSecondary,
  },
  status: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  statusGranted: {
    color: colors.brand.text,
  },
  action: {
    minHeight: minimumTouchTarget,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surface,
  },
  actionLabel: {
    ...typography.label,
    color: colors.brand.text,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    flex: 1,
    lineHeight: 20,
  },
  adjust: {
    minHeight: minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.brand.secondary,
    backgroundColor: colors.brand.surfaceMuted,
  },
  adjustCopy: {
    flex: 1,
    gap: 2,
  },
  adjustLabel: {
    ...typography.h6,
    color: colors.brand.text,
  },
  adjustHint: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  adjustPanel: {
    gap: spacing.md,
  },
  choiceGroup: {
    gap: spacing.sm,
  },
  choiceLabel: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.brand.line,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: colors.brand.onAccent,
  },
  proximity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brand.line,
  },
  proximityCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  proximityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  proximityTitle: {
    ...typography.h6,
    flex: 1,
    color: colors.brand.text,
  },
  note: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
});
