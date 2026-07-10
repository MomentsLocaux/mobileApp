import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Compass, Trash2 } from 'lucide-react-native';
import { DISCOVERY_ENABLED } from '@/config/discovery.flags';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsRow, SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';
import { useDiscoveryConsent } from '@/hooks/useDiscoveryConsent';
import { DiscoveryConsentService } from '@/services/discovery/discovery-consent.service';

function DiscoverySettingsContent() {
  const { consent, loading, isEnabled, refresh, revoke, purge } = useDiscoveryConsent();
  const [busy, setBusy] = useState(false);

  const handleToggle = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        await DiscoveryConsentService.activatePersonalization();
      } else {
        await revoke();
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
