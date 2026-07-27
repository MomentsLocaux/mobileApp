import React from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Building2, CreditCard, Package, RefreshCw, Sparkles } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsRow, SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { Button } from '@/components/ui';
import { colors, spacing, typography } from '@/constants/theme';
import {
  DIFFUSEUR_BILLING_PORTAL_URL,
  DIFFUSEUR_PLANS,
  DIFFUSEUR_SKUS,
  type DiffuseurSku,
} from '@/constants/diffuseur';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import { useDiffuseur } from '@/hooks/useDiffuseur';
import { DiffuseurService } from '@/services/diffuseur.service';

function formatEurHt(cents: number | null): string {
  if (cents == null) return '—';
  return `${(cents / 100).toFixed(0)} € HT`;
}

function DiffuseurBillingContent() {
  const router = useRouter();
  const { accent } = useAccountIdentity();
  const {
    organization,
    entitlements,
    plan,
    isPro,
    memberCount,
    loading,
    ledger,
    applyingSku,
    applySkuMock,
    refresh,
  } = useDiffuseur();

  const onMockPurchase = (sku: DiffuseurSku) => {
    const item = DIFFUSEUR_SKUS[sku];
    Alert.alert(
      'Simulation paiement',
      `${item.label}\n${item.description}\n${formatEurHt(item.amountCentsHt)}\n\nAucun encaissement réel — provider=mock. Stripe appellera le même RPC plus tard.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Simuler',
          onPress: () => {
            void (async () => {
              try {
                await applySkuMock(sku);
                Toast.show({ type: 'success', text1: 'Entitlement appliqué (mock)' });
              } catch (e) {
                Toast.show({
                  type: 'error',
                  text1: 'Échec simulation',
                  text2: e instanceof Error ? e.message : 'Erreur',
                });
              }
            })();
          },
        },
      ]
    );
  };

  const onOpenPortal = async () => {
    const opened = await DiffuseurService.openBillingPortal();
    if (!opened) {
      Toast.show({
        type: 'info',
        text1: 'Portail web pas encore configuré',
        text2: 'Utilisez la simulation DEV ci-dessous, ou EXPO_PUBLIC_DIFFUSEUR_BILLING_URL.',
      });
    }
  };

  if (loading && !organization) {
    return (
      <SettingsLayout title="Moments Diffuseur">
        <ActivityIndicator color={accent.accent} style={styles.loader} />
      </SettingsLayout>
    );
  }

  if (!organization) {
    return (
      <SettingsLayout title="Moments Diffuseur">
        <SettingsSectionCard
          title="Organisation"
          icon={Building2}
          description="Aucune organisation liée à ce compte Professionnel. Tirez pour actualiser, ou créez-la maintenant."
        >
          <Button
            title={loading ? 'Création…' : 'Créer mon organisation'}
            onPress={() => {
              void refresh().then(() => {
                Toast.show({
                  type: 'info',
                  text1: 'Actualisation',
                  text2: 'Si rien n’apparaît, vérifiez que le compte est bien Professionnel.',
                });
              });
            }}
            fullWidth
            disabled={loading}
          />
          <View style={{ height: spacing.sm }} />
          <Button title="Retour profil" variant="outline" onPress={() => router.back()} fullWidth />
        </SettingsSectionCard>
      </SettingsLayout>
    );
  }

  const subscriptionSkus = (Object.keys(DIFFUSEUR_SKUS) as DiffuseurSku[]).filter(
    (k) => DIFFUSEUR_SKUS[k].kind === 'subscription' || DIFFUSEUR_SKUS[k].kind === 'downgrade'
  );
  const packSkus = (Object.keys(DIFFUSEUR_SKUS) as DiffuseurSku[]).filter(
    (k) => DIFFUSEUR_SKUS[k].kind === 'pack'
  );

  return (
    <SettingsLayout title="Moments Diffuseur">
      <SettingsSectionCard
        title="Entitlements"
        icon={Sparkles}
        description="Le mobile consomme l’offre ; la facturation est web (ADR 006)."
      >
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Offre</Text>
          <Text style={[styles.statusValue, isPro && styles.statusActive]}>
            {DIFFUSEUR_PLANS[plan].label}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Organisation</Text>
          <Text style={styles.statusValue}>{organization.name}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Sièges</Text>
          <Text style={styles.statusValue}>
            {memberCount} / {organization.seat_limit}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Crédits boost</Text>
          <Text style={styles.statusValue}>{organization.boost_credits_balance ?? 0}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Early-access / mois</Text>
          <Text style={styles.statusValue}>{organization.early_access_slots_monthly ?? 0}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Highlight</Text>
          <Text style={styles.statusValue}>{organization.highlight_credits_balance ?? 0}</Text>
        </View>
        {organization.verified_at ? (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Badge</Text>
            <Text style={[styles.statusValue, styles.statusActive]}>Vérifié</Text>
          </View>
        ) : (
          <Text style={styles.meta}>
            Badge Vérifié : validation manuelle WebConsole (éligible Pro).
          </Text>
        )}
        {organization.current_period_end ? (
          <Text style={styles.meta}>
            Période jusqu’au{' '}
            {new Date(organization.current_period_end).toLocaleDateString('fr-FR')}
            {organization.billing_provider ? ` · ${organization.billing_provider}` : ''}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          Analytics avancées : {entitlements.advancedAnalytics ? 'oui' : 'non'} · Priorité
          modération : {entitlements.priorityModeration ? 'oui' : 'non'}
        </Text>
        <SettingsRow
          label="Actualiser"
          icon={RefreshCw}
          onPress={() => {
            void refresh().then(() =>
              Toast.show({ type: 'success', text1: 'Statut mis à jour' })
            );
          }}
          noBorder
        />
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Facturation"
        icon={CreditCard}
        description={
          DIFFUSEUR_BILLING_PORTAL_URL
            ? 'Portail web configuré.'
            : 'Stub prêt Stripe — pas de Checkout live. Simulation mock pour DEV.'
        }
      >
        <Button
          title="Ouvrir le portail web"
          variant="outline"
          onPress={() => void onOpenPortal()}
          fullWidth
        />
        <Text style={[styles.meta, styles.metaSpaced]}>
          Quand Stripe sera branché : Checkout → webhook → RPC apply_diffuseur_sku(provider=stripe).
        </Text>
      </SettingsSectionCard>

      <SettingsSectionCard title="Abonnement (simulation)" icon={CreditCard}>
        {subscriptionSkus.map((sku, index) => {
          const item = DIFFUSEUR_SKUS[sku];
          return (
            <SettingsRow
              key={sku}
              label={`${item.label} · ${formatEurHt(item.amountCentsHt)}`}
              icon={CreditCard}
              disabled={applyingSku}
              onPress={() => onMockPurchase(sku)}
              noBorder={index === subscriptionSkus.length - 1}
            />
          );
        })}
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Packs Diffuseur (simulation)"
        icon={Package}
        description="Packs € B2B — distincts de la Boutique Lumo (Habitué). Facturation web / mock DEV."
      >
        {packSkus.map((sku, index) => {
          const item = DIFFUSEUR_SKUS[sku];
          const disabled = applyingSku || (item.proOnly && !isPro);
          return (
            <SettingsRow
              key={sku}
              label={`${item.label} · ${formatEurHt(item.amountCentsHt)}`}
              icon={Package}
              disabled={disabled}
              onPress={() => onMockPurchase(sku)}
              noBorder={index === packSkus.length - 1}
            />
          );
        })}
      </SettingsSectionCard>

      {ledger.length > 0 ? (
        <SettingsSectionCard title="Historique récent" icon={RefreshCw}>
          {ledger.slice(0, 8).map((row, index) => (
            <View
              key={row.id}
              style={[styles.ledgerRow, index === Math.min(ledger.length, 8) - 1 && styles.rowNoBorder]}
            >
              <Text style={styles.ledgerSku}>{row.sku}</Text>
              <Text style={styles.ledgerMeta}>
                {row.provider} · {new Date(row.created_at).toLocaleDateString('fr-FR')}
              </Text>
            </View>
          ))}
        </SettingsSectionCard>
      ) : null}
    </SettingsLayout>
  );
}

export default function DiffuseurBillingScreen() {
  const { accountKind } = useAccountIdentity();
  if (accountKind !== 'professionnel') {
    return <Redirect href="/(tabs)/profile" />;
  }
  return <DiffuseurBillingContent />;
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  statusLabel: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    flexShrink: 0,
  },
  statusValue: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  statusActive: {
    color: colors.brand.secondary,
  },
  meta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginBottom: spacing.sm,
  },
  metaSpaced: {
    marginTop: spacing.md,
  },
  ledgerRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.25)',
  },
  rowNoBorder: {
    borderBottomWidth: 0,
  },
  ledgerSku: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  ledgerMeta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
});
