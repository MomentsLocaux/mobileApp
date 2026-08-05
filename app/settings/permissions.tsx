import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  Bell,
  Camera as CameraIcon,
  ExternalLink,
  Images,
  MapPin,
  ShieldCheck,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsRow, SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';

type PermissionTone = 'allowed' | 'limited' | 'denied' | 'unknown';

type PermissionDisplay = {
  label: string;
  tone: PermissionTone;
};

type PermissionState = {
  location: PermissionDisplay;
  notifications: PermissionDisplay;
  camera: PermissionDisplay;
  photos: PermissionDisplay;
};

const UNKNOWN_PERMISSION: PermissionDisplay = {
  label: 'Indisponible',
  tone: 'unknown',
};

const INITIAL_STATE: PermissionState = {
  location: UNKNOWN_PERMISSION,
  notifications: UNKNOWN_PERMISSION,
  camera: UNKNOWN_PERMISSION,
  photos: UNKNOWN_PERMISSION,
};

const permissionFromStatus = (
  status: string,
  labels: { granted: string; denied: string; undetermined: string },
): PermissionDisplay => {
  if (status === 'granted') return { label: labels.granted, tone: 'allowed' };
  if (status === 'denied') return { label: labels.denied, tone: 'denied' };
  return { label: labels.undetermined, tone: 'unknown' };
};

const PermissionBadge: React.FC<PermissionDisplay> = ({ label, tone }) => (
  <View style={[styles.badge, styles[`badge_${tone}`]]}>
    <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>{label}</Text>
  </View>
);

export default function PermissionsSettingsScreen() {
  const [permissions, setPermissions] = useState<PermissionState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);

  const refreshPermissions = useCallback(async () => {
    setLoading(true);

    const [foregroundResult, backgroundResult, notificationsResult, cameraResult, photosResult] =
      await Promise.allSettled([
        Location.getForegroundPermissionsAsync(),
        Location.getBackgroundPermissionsAsync(),
        Notifications.getPermissionsAsync(),
        ImagePicker.getCameraPermissionsAsync(),
        ImagePicker.getMediaLibraryPermissionsAsync(),
      ]);

    let location = UNKNOWN_PERMISSION;
    if (foregroundResult.status === 'fulfilled') {
      if (foregroundResult.value.granted) {
        location =
          backgroundResult.status === 'fulfilled' && backgroundResult.value.granted
            ? { label: 'Toujours', tone: 'allowed' }
            : { label: 'Pendant l’utilisation', tone: 'allowed' };
      } else {
        location = permissionFromStatus(foregroundResult.value.status, {
          granted: 'Autorisée',
          denied: 'Non autorisée',
          undetermined: 'Non demandée',
        });
      }
    }

    const notificationPermission =
      notificationsResult.status === 'fulfilled'
        ? permissionFromStatus(notificationsResult.value.status, {
            granted: 'Autorisées',
            denied: 'Non autorisées',
            undetermined: 'Non demandées',
          })
        : UNKNOWN_PERMISSION;

    const cameraPermission =
      cameraResult.status === 'fulfilled'
        ? permissionFromStatus(cameraResult.value.status, {
            granted: 'Autorisé',
            denied: 'Non autorisé',
            undetermined: 'Non demandé',
          })
        : UNKNOWN_PERMISSION;

    let photosPermission = UNKNOWN_PERMISSION;
    if (photosResult.status === 'fulfilled') {
      if (photosResult.value.accessPrivileges === 'limited') {
        photosPermission = { label: 'Accès limité', tone: 'limited' };
      } else {
        photosPermission = permissionFromStatus(photosResult.value.status, {
          granted: 'Toutes les photos',
          denied: 'Non autorisé',
          undetermined: 'Non demandé',
        });
      }
    }

    setPermissions({
      location,
      notifications: notificationPermission,
      camera: cameraPermission,
      photos: photosPermission,
    });
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPermissions();
    }, [refreshPermissions]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refreshPermissions();
    });
    return () => subscription.remove();
  }, [refreshPermissions]);

  const handleOpenSettings = async () => {
    if (Platform.OS === 'web') {
      Toast.show({
        type: 'info',
        text1: 'Réglages indisponibles',
        text2: 'Cette action est disponible depuis l’application mobile.',
      });
      return;
    }

    try {
      await Linking.openSettings();
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Impossible d’ouvrir les réglages',
        text2: 'Ouvrez les réglages du téléphone et sélectionnez Moments Locaux.',
      });
    }
  };

  return (
    <SettingsLayout title="Autorisations">
      <SettingsSectionCard
        title="Accès de l’application"
        icon={ShieldCheck}
        description="Ces accès sont contrôlés par les réglages de votre téléphone."
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.brand.secondary} />
            <Text style={styles.loadingText}>Vérification des autorisations…</Text>
          </View>
        ) : (
          <>
            <SettingsRow
              label="Localisation"
              icon={MapPin}
              right={<PermissionBadge {...permissions.location} />}
              showChevron={false}
              noBorder
            />
            <SettingsRow
              label="Notifications"
              icon={Bell}
              right={<PermissionBadge {...permissions.notifications} />}
              showChevron={false}
            />
            <SettingsRow
              label="Appareil photo"
              icon={CameraIcon}
              right={<PermissionBadge {...permissions.camera} />}
              showChevron={false}
            />
            <SettingsRow
              label="Photos"
              icon={Images}
              right={<PermissionBadge {...permissions.photos} />}
              showChevron={false}
            />
          </>
        )}
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Modifier les accès"
        icon={ExternalLink}
        description="Vous pourrez autoriser, limiter ou retirer chaque accès."
      >
        <SettingsRow
          label="Ouvrir les réglages de Moments Locaux"
          icon={ExternalLink}
          onPress={handleOpenSettings}
          noBorder
        />
      </SettingsSectionCard>

      <Text style={styles.helperText}>
        Moments Locaux ne peut pas modifier ces autorisations à votre place. Les changements sont
        appliqués directement par iOS ou Android.
      </Text>
    </SettingsLayout>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  badge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    maxWidth: 150,
  },
  badge_allowed: {
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderColor: 'rgba(16,185,129,0.45)',
  },
  badge_limited: {
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderColor: 'rgba(245,158,11,0.45)',
  },
  badge_denied: {
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderColor: 'rgba(239,68,68,0.45)',
  },
  badge_unknown: {
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderColor: 'rgba(148,163,184,0.35)',
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
  badgeText_allowed: {
    color: colors.brand.success,
  },
  badgeText_limited: {
    color: colors.brand.warning,
  },
  badgeText_denied: {
    color: colors.brand.error,
  },
  badgeText_unknown: {
    color: colors.brand.textSecondary,
  },
  helperText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
});
