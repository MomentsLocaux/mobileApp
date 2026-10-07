import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Bell, Camera, Check, Images, MapPin } from 'lucide-react-native';
import { borderRadius, colors, minimumTouchTarget, spacing, typography } from '@/constants/theme';
import { PreferencesService } from '@/services/preferences.service';
import {
  registerForPushNotificationsAsync,
  requestNotificationPermission,
} from '@/services/push.service';
import { haptics } from '@/utils/haptics';

type PermissionId = 'notifications' | 'location' | 'camera' | 'photos';

type GrantState = 'granted' | 'limited' | 'denied' | 'undetermined' | 'unavailable';

type PermissionSnapshot = Record<PermissionId, GrantState>;

const INITIAL: PermissionSnapshot = {
  notifications: 'undetermined',
  location: 'undetermined',
  camera: 'undetermined',
  photos: 'undetermined',
};

const ROWS: {
  id: PermissionId;
  title: string;
  reason: string;
  icon: typeof Bell;
}[] = [
  {
    id: 'notifications',
    title: 'Notifications',
    reason: 'Pour te prévenir quand un moment se prépare près de toi.',
    icon: Bell,
  },
  {
    id: 'location',
    title: 'Position pendant l’utilisation',
    reason: 'Pour centrer la carte sur l’endroit où tu es. Le quartier choisi juste avant reste le tien.',
    icon: MapPin,
  },
  {
    id: 'camera',
    title: 'Appareil photo',
    reason: 'Pour prendre un portrait ou une photo d’un moment.',
    icon: Camera,
  },
  {
    id: 'photos',
    title: 'Photos',
    reason: 'Pour choisir une image déjà dans ton téléphone.',
    icon: Images,
  },
];

const fromStatus = (
  status: string | undefined,
  accessPrivileges?: string,
): GrantState => {
  if (accessPrivileges === 'limited') return 'limited';
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
};

const statusLabel: Record<GrantState, string> = {
  granted: 'Autorisé',
  limited: 'Accès limité',
  denied: 'Refusé',
  undetermined: 'Pas encore demandé',
  unavailable: 'Indisponible sur cet appareil',
};

async function readPermissions(): Promise<PermissionSnapshot> {
  if (Platform.OS === 'web') {
    return {
      notifications: 'unavailable',
      location: 'unavailable',
      camera: 'unavailable',
      photos: 'unavailable',
    };
  }

  const [notifications, location, camera, photos] = await Promise.allSettled([
    Notifications.getPermissionsAsync(),
    Location.getForegroundPermissionsAsync(),
    ImagePicker.getCameraPermissionsAsync(),
    ImagePicker.getMediaLibraryPermissionsAsync(),
  ]);

  return {
    notifications:
      notifications.status === 'fulfilled'
        ? fromStatus(notifications.value.status)
        : 'unavailable',
    location:
      location.status === 'fulfilled' ? fromStatus(location.value.status) : 'unavailable',
    camera: camera.status === 'fulfilled' ? fromStatus(camera.value.status) : 'unavailable',
    photos:
      photos.status === 'fulfilled'
        ? fromStatus(photos.value.status, photos.value.accessPrivileges)
        : 'unavailable',
  };
}

/**
 * Asks for the system notification permission when it is still unanswered,
 * then aligns `push_enabled` and the device token with the result.
 * A grant writes the token. A refusal turns the in-app switch off.
 */
export async function ensureOnboardingNotificationChoice(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const before = await Notifications.getPermissionsAsync();
    const granted =
      before.status === 'granted' ? true : await requestNotificationPermission();
    if (granted) {
      await PreferencesService.updateMine(userId, { push_enabled: true });
      await registerForPushNotificationsAsync(userId);
      return;
    }
    const after = await Notifications.getPermissionsAsync();
    if (after.status === 'denied') {
      await PreferencesService.updateMine(userId, { push_enabled: false });
    }
  } catch (error) {
    console.warn('[onboarding] notification permission sync failed', error);
  }
}

type Props = {
  userId?: string | null;
};

export function OnboardingPermissionsStep({ userId }: Props) {
  const [snapshot, setSnapshot] = useState<PermissionSnapshot>(INITIAL);
  const [busy, setBusy] = useState<PermissionId | null>(null);

  const refresh = useCallback(async () => {
    const next = await readPermissions();
    setSnapshot(next);
    return next;
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

  const ask = async (id: PermissionId) => {
    const current = snapshot[id];
    if (current === 'granted' || current === 'limited' || current === 'unavailable') return;
    haptics.selection();
    if (current === 'denied') {
      await Linking.openSettings().catch(() => undefined);
      return;
    }

    setBusy(id);
    try {
      if (id === 'notifications' && userId) {
        await ensureOnboardingNotificationChoice(userId);
      } else if (id === 'location') {
        await Location.requestForegroundPermissionsAsync();
      } else if (id === 'camera') {
        await ImagePicker.requestCameraPermissionsAsync();
      } else if (id === 'photos') {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
    } catch (error) {
      console.warn('[onboarding] permission request failed', id, error);
    } finally {
      await refresh();
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Autorise ce qui t’aide</Text>
      <Text style={styles.subtitle}>
        Chaque bouton ouvre la demande de ton téléphone. Rien n’est activé tant que tu n’as pas
        répondu à cette fenêtre. Si tu continues sans avoir choisi pour les notifications, la
        demande s’affiche à ce moment-là.
      </Text>
      <View>
        {ROWS.map((row) => {
          const Icon = row.icon;
          const state = snapshot[row.id];
          const settled = state === 'granted' || state === 'limited';
          const actionLabel = state === 'denied' ? 'Réglages' : 'Autoriser';
          return (
            <View key={row.id} style={styles.row}>
              <View style={styles.iconWrap}>
                <Icon size={20} color={colors.brand.secondary} strokeWidth={2.2} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.reason}>{row.reason}</Text>
                <Text style={[styles.status, settled && styles.statusGranted]}>
                  {statusLabel[state]}
                </Text>
              </View>
              {settled ? (
                <Check size={18} color={colors.brand.secondary} strokeWidth={2.4} />
              ) : state === 'unavailable' ? null : (
                <Pressable
                  style={styles.action}
                  onPress={() => void ask(row.id)}
                  disabled={busy !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`${actionLabel} ${row.title}`}
                >
                  {busy === row.id ? (
                    <ActivityIndicator color={colors.brand.secondary} />
                  ) : (
                    <Text style={styles.actionLabel}>{actionLabel}</Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      <Text style={styles.note}>
        L’agenda, Face ID et la position en arrière-plan ne sont demandés que plus tard, au moment
        où tu t’en sers.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
  },
  row: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand.line,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.brand.line,
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
    color: colors.brand.textSecondary,
  },
  status: {
    ...typography.label,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  statusGranted: {
    color: colors.brand.secondary,
  },
  action: {
    minHeight: minimumTouchTarget,
    minWidth: 96,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surface,
  },
  actionLabel: {
    ...typography.label,
    color: colors.brand.secondary,
  },
  note: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
});
