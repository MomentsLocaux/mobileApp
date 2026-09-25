import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  CheckCircle2,
  Compass,
  MapPinned,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { MotionReveal } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Motion } from '@/constants/motion';
import { PREMIUM_PLANS } from '@/services/subscription.service';
import { ActivityLogService } from '@/services/activity-log.service';

const BENEFITS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Sparkles,
    title: 'Idées pour tout de suite',
    body: 'Des moments à rejoindre maintenant, près de toi.',
  },
  {
    icon: MapPinned,
    title: 'La carte de tes sorties',
    body: 'Vois où tu sors, et les coins à explorer à côté.',
  },
  {
    icon: Compass,
    title: 'Des suggestions pour toi',
    body: 'Des idées calées sur tes sorties passées.',
  },
  {
    icon: CheckCircle2,
    title: 'Sortir de tes habitudes',
    body: 'Des idées nouvelles, et un résumé de ce que tu as découvert. Inclut l’offre Habitué.',
  },
];

type Props = {
  onUnlock: (plan: 'monthly' | 'annual') => void;
};

export function OnboardingEclaireurCtaStep({ onUnlock }: Props) {
  useEffect(() => {
    ActivityLogService.log('premium_paywall_view', { source: 'onboarding' }).catch(() => undefined);
  }, []);

  const monthlyEquivalent = '1,67 €';

  return (
    <MotionReveal style={styles.wrap}>
      <Text style={styles.brand}>Offre Éclaireur</Text>
      <Text style={styles.headline}>Va plus loin dans ce qui se passe près de toi</Text>
      <Text style={styles.proofText}>D’abord ton quartier, ensuite des idées plus précises.</Text>

      <View style={styles.benefits}>
        {BENEFITS.map((item, index) => {
          const Icon = item.icon;
          return (
            <MotionReveal
              key={item.title}
              delay={index * Motion.stagger.content}
              style={styles.benefitRow}
            >
              <View style={styles.benefitIcon}>
                <Icon size={18} color={colors.brand.secondary} strokeWidth={2.2} />
              </View>
              <View style={styles.benefitCopy}>
                <Text style={styles.benefitTitle}>{item.title}</Text>
                <Text style={styles.benefitBody}>{item.body}</Text>
              </View>
            </MotionReveal>
          );
        })}
      </View>

      <View style={styles.pricing}>
        <Text style={styles.priceAnnual}>
          {PREMIUM_PLANS.annual.priceLabel}/an
          <Text style={styles.priceSave}> · tu économises par rapport au mois</Text>
        </Text>
        <Text style={styles.priceMonthly}>
          <Text style={styles.priceStrike}>
            {PREMIUM_PLANS.monthly.priceLabel}
            {PREMIUM_PLANS.monthly.periodLabel}
          </Text>
          {'  '}
          <Text style={styles.priceHighlight}>
            {monthlyEquivalent}/mois
          </Text>
        </Text>
      </View>

      <View style={styles.planRow}>
        <TouchableOpacity
          style={styles.planChip}
          onPress={() => onUnlock('monthly')}
          accessibilityRole="button"
          accessibilityLabel={`Choisir l'offre mensuelle ${PREMIUM_PLANS.monthly.priceLabel}`}
        >
          <Text style={styles.planChipLabel}>{PREMIUM_PLANS.monthly.label}</Text>
          <Text style={styles.planChipPrice}>
            {PREMIUM_PLANS.monthly.priceLabel}
            {PREMIUM_PLANS.monthly.periodLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.planChip, styles.planChipActive]}
          onPress={() => onUnlock('annual')}
          accessibilityRole="button"
          accessibilityLabel={`Choisir l'offre annuelle ${PREMIUM_PLANS.annual.priceLabel}`}
        >
          <Text style={[styles.planChipLabel, styles.planChipLabelActive]}>
            {PREMIUM_PLANS.annual.label}
          </Text>
          <Text style={[styles.planChipPrice, styles.planChipPriceActive]}>
            {PREMIUM_PLANS.annual.priceLabel}
            {PREMIUM_PLANS.annual.periodLabel}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.legal}>Sans engagement. Tu peux annuler quand tu veux. Les achats dans l’app arrivent bientôt.</Text>
    </MotionReveal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  brand: {
    ...typography.h6,
    color: colors.brand.secondary,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headline: {
    ...typography.h2,
    color: colors.brand.text,
    lineHeight: 34,
  },
  proofText: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
  },
  benefits: {
    gap: spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 181, 24, 0.12)',
  },
  benefitCopy: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  benefitBody: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    lineHeight: 18,
  },
  pricing: {
    gap: 4,
    marginTop: spacing.xs,
  },
  priceAnnual: {
    ...typography.h5,
    color: colors.brand.text,
  },
  priceSave: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '500',
  },
  priceMonthly: {
    ...typography.body,
  },
  priceStrike: {
    color: colors.brand.textSecondary,
    textDecorationLine: 'line-through',
  },
  priceHighlight: {
    color: colors.brand.text,
    fontWeight: '800',
  },
  planRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  planChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: 2,
    minHeight: 56,
    justifyContent: 'center',
  },
  planChipActive: {
    backgroundColor: colors.brand.secondary,
    borderColor: colors.brand.secondary,
  },
  planChipLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  planChipLabelActive: {
    color: colors.brand.onAccent,
  },
  planChipPrice: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  planChipPriceActive: {
    color: colors.brand.onAccent,
  },
  legal: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
