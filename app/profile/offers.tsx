import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, Crown, Sparkles, X } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { AppBackground, Button, MotionReveal } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import {
  DISCOVERY_BENEFITS_FR,
  OFFER_FEATURE_MATRIX,
} from '@/constants/offers';
import {
  ECLAIREUR_PLANS,
  HABITUE_PLANS,
} from '@/services/subscription.service';
import { useOfferEntitlements } from '@/hooks/useOfferEntitlements';
import { ActivityLogService } from '@/services/activity-log.service';
import { haptics } from '@/utils/haptics';

type PlanFocus = 'habitue' | 'eclaireur';

export default function OffersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasHabitue, hasEclaireur } = useOfferEntitlements();
  const [focus, setFocus] = useState<PlanFocus>('eclaireur');

  React.useEffect(() => {
    ActivityLogService.log('premium_paywall_view', { source: 'offers_screen' }).catch(
      () => undefined,
    );
  }, []);

  const plans = focus === 'habitue' ? HABITUE_PLANS : ECLAIREUR_PLANS;
  const focusLabel = focus === 'habitue' ? 'Habitué' : 'Éclaireur';

  const statusLabel = useMemo(() => {
    if (hasEclaireur) return 'Vous êtes Éclaireur';
    if (hasHabitue) return 'Vous êtes Habitué';
    return 'Vous êtes en Local (gratuit)';
  }, [hasEclaireur, hasHabitue]);

  const toastPurchase = (tier: PlanFocus, period: 'monthly' | 'annual') => {
    haptics.light();
    const pack = tier === 'habitue' ? HABITUE_PLANS[period] : ECLAIREUR_PLANS[period];
    Toast.show({
      type: 'info',
      text1: 'Achats in-app bientôt disponibles',
      text2: `${tier === 'habitue' ? 'Habitué' : 'Éclaireur'} ${pack.label} — intégration store en cours.`,
    });
  };

  return (
    <View style={styles.root}>
      <AppBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Retour"
        >
          <ChevronLeft size={22} color={colors.brand.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nos offres</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Fermer"
        >
          <X size={20} color={colors.brand.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <MotionReveal style={styles.hero}>
          <Text style={styles.heroTitle}>Passez au niveau supérieur</Text>
          <Text style={styles.heroBody}>
            Trois paliers incrémentaux : Local ⊂ Habitué ⊂ Éclaireur. Chaque niveau inclut tout ce qui
            précède.
          </Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </MotionReveal>

        <View style={styles.tierSwitch}>
          <TouchableOpacity
            style={[styles.tierChip, focus === 'habitue' && styles.tierChipActiveHabitue]}
            onPress={() => {
              haptics.selection();
              setFocus('habitue');
            }}
          >
            <Sparkles
              size={14}
              color={focus === 'habitue' ? colors.brand.success : colors.brand.textSecondary}
            />
            <Text style={[styles.tierChipText, focus === 'habitue' && styles.tierChipTextHabitue]}>
              Habitué
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tierChip, focus === 'eclaireur' && styles.tierChipActiveEclaireur]}
            onPress={() => {
              haptics.selection();
              setFocus('eclaireur');
            }}
          >
            <Crown
              size={14}
              color={focus === 'eclaireur' ? colors.brand.premiumLight : colors.brand.textSecondary}
            />
            <Text
              style={[styles.tierChipText, focus === 'eclaireur' && styles.tierChipTextEclaireur]}
            >
              Éclaireur
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.priceBlock}>
          <Text style={styles.priceTitle}>{focusLabel}</Text>
          <Text style={styles.priceLine}>
            {plans.annual.priceLabel}/an · {plans.monthly.priceLabel}
            {plans.monthly.periodLabel}
          </Text>
          <Text style={styles.priceHint}>
            {focus === 'habitue'
              ? 'Inclut Local + check-in, Lumo, missions, Pass, accès anticipé.'
              : 'Inclut Habitué + idées maintenant, carte de zone, recommandations, bilans.'}
          </Text>
        </View>

        <View style={styles.matrixCard}>
          <View style={styles.matrixHeader}>
            <Text style={[styles.matrixCorner, styles.matrixHead]}>Fonctionnalité</Text>
            <Text style={styles.matrixHead}>Local</Text>
            <Text style={styles.matrixHead}>Hab.</Text>
            <Text style={styles.matrixHead}>Écl.</Text>
          </View>
          {OFFER_FEATURE_MATRIX.map((row) => (
            <View key={row.id} style={styles.matrixRow}>
              <Text style={styles.matrixLabel} numberOfLines={2}>
                {row.label}
              </Text>
              <Cell on={row.local} />
              <Cell on={row.habitue} />
              <Cell on={row.eclaireur} />
            </View>
          ))}
        </View>

        {focus === 'eclaireur' ? (
          <View style={styles.discoveryBlock}>
            <Text style={styles.sectionTitle}>Ce qu’apporte Éclaireur</Text>
            {DISCOVERY_BENEFITS_FR.map((item) => (
              <View key={item.title} style={styles.benefitRow}>
                <Check size={16} color={colors.brand.premiumLight} strokeWidth={2.5} />
                <View style={styles.benefitCopy}>
                  <Text style={styles.benefitTitle}>{item.title}</Text>
                  <Text style={styles.benefitBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.ctaRow}>
          <Button
            title={`Débloquer ${focusLabel} (annuel)`}
            size="sm"
            onPress={() => toastPurchase(focus, 'annual')}
            style={[
              styles.cta,
              focus === 'eclaireur' ? styles.ctaEclaireur : styles.ctaHabitue,
            ]}
          />
          <Button
            title={`Essayer le mensuel (${plans.monthly.priceLabel})`}
            size="sm"
            variant="outline"
            onPress={() => toastPurchase(focus, 'monthly')}
            style={styles.cta}
          />
        </View>
        <Text style={styles.legal}>Sans engagement affiché. Achats in-app bientôt disponibles.</Text>
      </ScrollView>
    </View>
  );
}

function Cell({ on }: { on: boolean }) {
  return (
    <View style={styles.matrixCell}>
      {on ? (
        <Check size={16} color={colors.brand.secondary} strokeWidth={3} />
      ) : (
        <Text style={styles.matrixCross}>—</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    ...typography.h5,
    color: colors.brand.text,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  hero: { gap: spacing.sm },
  heroTitle: {
    ...typography.h3,
    color: colors.brand.text,
  },
  heroBody: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(43,191,227,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(43,191,227,0.35)',
  },
  statusText: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  tierSwitch: { flexDirection: 'row', gap: spacing.sm },
  tierChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tierChipActiveHabitue: {
    borderColor: 'rgba(16,185,129,0.45)',
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  tierChipActiveEclaireur: {
    borderColor: colors.brand.premiumBorder,
    backgroundColor: colors.brand.premiumMuted,
  },
  tierChipText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  tierChipTextHabitue: { color: '#6EE7B7' },
  tierChipTextEclaireur: { color: colors.brand.premiumLight },
  priceBlock: {
    gap: 4,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  priceTitle: { ...typography.h5, color: colors.brand.text },
  priceLine: { ...typography.body, color: colors.brand.text, fontWeight: '700' },
  priceHint: { ...typography.caption, color: colors.brand.textSecondary, lineHeight: 18 },
  matrixCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  matrixHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  matrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  matrixCorner: { flex: 1.6 },
  matrixHead: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
    width: 36,
    textAlign: 'center',
  },
  matrixLabel: {
    ...typography.caption,
    color: colors.brand.text,
    flex: 1.6,
    paddingRight: spacing.xs,
  },
  matrixCell: { width: 36, alignItems: 'center', justifyContent: 'center' },
  matrixCross: { ...typography.caption, color: colors.brand.textSecondary },
  discoveryBlock: { gap: spacing.sm },
  sectionTitle: { ...typography.h6, color: colors.brand.text, marginBottom: spacing.xs },
  benefitRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  benefitCopy: { flex: 1, gap: 2 },
  benefitTitle: { ...typography.bodySmall, color: colors.brand.text, fontWeight: '700' },
  benefitBody: { ...typography.caption, color: colors.brand.textSecondary, lineHeight: 18 },
  ctaRow: { gap: spacing.sm, marginTop: spacing.sm },
  cta: { width: '100%', minHeight: 48, maxHeight: 48 },
  ctaHabitue: { backgroundColor: colors.brand.success },
  ctaEclaireur: { backgroundColor: colors.brand.premium },
  legal: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
