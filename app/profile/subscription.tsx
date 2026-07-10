import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Crown, RefreshCw } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { DISCOVERY_ENABLED } from '@/config/discovery.flags';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsRow, SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { Button } from '@/components/ui';
import { PremiumPaywallSheet } from '@/components/discovery/PremiumPaywallSheet';
import { colors, spacing, typography } from '@/constants/theme';
import { usePremiumEntitlement } from '@/hooks/usePremiumEntitlement';
import { PREMIUM_PLANS } from '@/services/subscription.service';

function SubscriptionContent() {
  const router = useRouter();
  const { entitlement, isPremium, loading, refresh } = usePremiumEntitlement();
  const [paywallVisible, setPaywallVisible] = React.useState(false);

  const statusLabel = (() => {
    if (loading) return 'Chargement…';
    if (isPremium) return 'Actif';
    if (entitlement?.status === 'grace_period') return 'Période de grâce';
    if (entitlement?.status === 'trialing') return 'Essai';
    return 'Gratuit';
  })();

  return (
    <SettingsLayout title="Moments Locaux+">
      <SettingsSectionCard
        title="Statut"
        icon={Crown}
        description="Votre abonnement Discovery Premium est géré côté serveur."
      >
        {loading ? (
          <ActivityIndicator color={colors.brand.secondary} style={styles.loader} />
        ) : (
          <>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Statut</Text>
              <Text style={[styles.statusValue, isPremium && styles.statusActive]}>{statusLabel}</Text>
            </View>
            {entitlement?.expires_at && (
              <Text style={styles.meta}>
                {isPremium ? 'Renouvellement' : 'Expire'} le{' '}
                {new Date(entitlement.expires_at).toLocaleDateString('fr-FR')}
              </Text>
            )}
            {entitlement?.auto_renew && isPremium && (
              <Text style={styles.meta}>Renouvellement automatique activé</Text>
            )}
          </>
        )}
        <SettingsRow
          label="Actualiser le statut"
          icon={RefreshCw}
          onPress={async () => {
            await refresh();
            Toast.show({ type: 'success', text1: 'Statut mis à jour' });
          }}
          noBorder
        />
      </SettingsSectionCard>

      {!isPremium && (
        <SettingsSectionCard title="Offres" icon={Crown}>
          <Text style={styles.offerCopy}>
            {PREMIUM_PLANS.monthly.priceLabel}
            {PREMIUM_PLANS.monthly.periodLabel} · {PREMIUM_PLANS.annual.priceLabel}
            {PREMIUM_PLANS.annual.periodLabel}
          </Text>
          <Button title="Voir Moments Locaux+" onPress={() => setPaywallVisible(true)} fullWidth />
        </SettingsSectionCard>
      )}

      {DISCOVERY_ENABLED && (
        <Button
          title="Retour à Discovery"
          variant="outline"
          onPress={() => router.push('/discovery' as any)}
          fullWidth
        />
      )}

      <PremiumPaywallSheet
        visible={paywallVisible}
        source="subscription"
        onClose={() => setPaywallVisible(false)}
      />
    </SettingsLayout>
  );
}

export default function SubscriptionScreen() {
  if (!DISCOVERY_ENABLED) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return <SubscriptionContent />;
}

const styles = StyleSheet.create({
  loader: {
    marginVertical: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusLabel: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  statusValue: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
  },
  statusActive: {
    color: colors.brand.secondary,
  },
  meta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  offerCopy: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
