import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Compass, Crown, MapPin, Trash2 } from 'lucide-react-native';
import { DISCOVERY_CAPTURE_ENABLED, DISCOVERY_ENABLED } from '@/config/discovery.flags';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsRow, SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';
import { useDiscoveryConsent } from '@/hooks/useDiscoveryConsent';
import { DiscoveryConsentService } from '@/services/discovery/discovery-consent.service';
import { requestDiscoveryLocationPermissions } from '@/hooks/useDiscoveryCapture';
import { stopDiscoveryBackgroundCapture } from '@/tasks/discovery-location.task';
import { useRouter } from 'expo-router';

function DiscoverySettingsContent() {
  const router = useRouter();
  const { consent, loading, isEnabled, refresh, revoke, purge } = useDiscoveryConsent();
  const [busy, setBusy] = useState(false);

  const handleLocationToggle = async (next: boolean) => {
    if (!DISCOVERY_CAPTURE_ENABLED) {
      Toast.show({ type: 'info', text1: 'La collecte passive n’est pas encore activée dans cette build.' });
      return;
    }

    setBusy(true);
    try {
      if (next) {
        const granted = await requestDiscoveryLocationPermissions();
        if (!granted) {
          Toast.show({
            type: 'error',
            text1: 'Permission refusée',
            text2: 'La localisation en arrière-plan est nécessaire pour enrichir Discovery.',
          });
          return;
        }
        await DiscoveryConsentService.enableLocationCapture();
      } else {
        await DiscoveryConsentService.disableLocationCapture();
        await stopDiscoveryBackgroundCapture();
      }
      await refresh();
      Toast.show({
        type: 'success',
        text1: next ? 'Collecte de lieux activée' : 'Collecte de lieux désactivée',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Mise à jour impossible',
        text2: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        await DiscoveryConsentService.activatePersonalization();
      } else {
        await revoke();
        await stopDiscoveryBackgroundCapture();
      }
      await refresh();
      Toast.show({
        type: 'success',
        text1: next ? 'Discovery activé' : 'Discovery désactivé',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Mise à jour impossible',
        text2: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePurge = () => {
    Alert.alert(
      'Supprimer les données Discovery',
      'Cette action efface vos lieux, visites, profils et recommandations Discovery. Elle est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await purge();
              Toast.show({ type: 'success', text1: 'Données Discovery supprimées' });
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Suppression impossible',
                text2: error instanceof Error ? error.message : undefined,
              });
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SettingsLayout title="Discovery">
      <SettingsSectionCard
        title="Personnalisation"
        icon={Compass}
        description="Contrôlez l’utilisation de vos signaux pour les recommandations."
      >
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleLabel}>Activer Discovery</Text>
            <Text style={styles.toggleHint}>
              Recommandations personnalisées basées sur vos interactions et votre position actuelle.
            </Text>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={handleToggle}
            disabled={loading || busy}
            trackColor={{ false: colors.neutral[600], true: colors.brand.secondary }}
          />
        </View>
        {consent?.granted_at && (
          <Text style={styles.meta}>
            Consentement v{consent.consent_version} · activé le{' '}
            {new Date(consent.granted_at).toLocaleDateString('fr-FR')}
          </Text>
        )}
      </SettingsSectionCard>

      {DISCOVERY_CAPTURE_ENABLED && (
        <SettingsSectionCard
          title="Lieux visités"
          icon={MapPin}
          description="Collecte passive optionnelle pour enrichir Mon territoire (arrêts ≥ 12 min)."
        >
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleLabel}>Localisation passive</Text>
              <Text style={styles.toggleHint}>
                Nécessite l’autorisation « Toujours ». Aucune trace GPS brute n’est conservée longtemps sur
                le serveur.
              </Text>
            </View>
            <Switch
              value={consent?.location_enabled === true}
              onValueChange={handleLocationToggle}
              disabled={!isEnabled || loading || busy}
              trackColor={{ false: colors.neutral[600], true: colors.brand.secondary }}
            />
          </View>
        </SettingsSectionCard>
      )}

      <SettingsSectionCard title="Premium" icon={Crown}>
        <SettingsRow
          label="Moments Locaux+"
          icon={Crown}
          onPress={() => router.push('/profile/subscription' as any)}
          noBorder
        />
      </SettingsSectionCard>

      <SettingsSectionCard title="Données" icon={Trash2} accent>
        <SettingsRow
          label="Supprimer mes données Discovery"
          icon={Trash2}
          onPress={handlePurge}
          danger
          noBorder
        />
        <Text style={styles.purgeHint}>
          Lieux, visites, profils calculés et historique de recommandations seront effacés.
        </Text>
      </SettingsSectionCard>
    </SettingsLayout>
  );
}

export default function DiscoverySettingsScreen() {
  if (!DISCOVERY_ENABLED) {
    return <Redirect href="/settings" />;
  }

  return <DiscoverySettingsContent />;
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleCopy: {
    flex: 1,
  },
  toggleLabel: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  toggleHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  meta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: spacing.sm,
  },
  purgeHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
