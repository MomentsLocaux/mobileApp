import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    title: 'Idées maintenant',
    body: 'Des moments à rejoindre tout de suite, près de vous.',
  },
  {
    icon: MapPinned,
    title: 'Carte de votre zone',
    body: 'Voyez où vous sortez et les coins à explorer à proximité.',
  },
  {
    icon: Compass,
    title: 'Recommandations adaptées',
    body: 'Des propositions calées sur vos sorties passées.',
  },
  {
    icon: CheckCircle2,
    title: 'Routine & bilans',
    body: 'Idées hors habitudes + résumé de vos découvertes. Inclut tout Habitué.',
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
      <Text style={styles.brand}>Éclaireur</Text>
      <Text style={styles.headline}>
        <Text style={styles.headlineCyan}>Débloquez </Text>
        <Text style={styles.headlineGold}>une découverte locale plus profonde</Text>
      </Text>

      <View style={styles.proofCard}>
        <LinearGradient
          colors={['rgba(43,191,227,0.18)', 'rgba(212,175,55,0.14)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Compass size={18} color={colors.brand.secondary} />
        <Text style={styles.proofText}>Explore ton quartier → découvre autrement</Text>
      </View>

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
          <Text style={styles.priceSave}> · Économisez vs mensuel</Text>
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

      <Text style={styles.legal}>Sans engagement. Annulez à tout moment. Achats in-app bientôt.</Text>
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
    color: colors.brand.premiumLight,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headline: {
    ...typography.h2,
    lineHeight: 34,
  },
  headlineCyan: {
    color: colors.brand.secondary,
    fontWeight: '800',
  },
  headlineGold: {
    color: colors.brand.premiumLight,
    fontWeight: '800',
  },
  proofCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  proofText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
    flex: 1,
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
    backgroundColor: 'rgba(43, 191, 227, 0.12)',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 2,
    minHeight: 56,
    justifyContent: 'center',
  },
  planChipActive: {
    backgroundColor: colors.brand.premiumMuted,
    borderColor: colors.brand.premiumBorder,
  },
  planChipLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  planChipLabelActive: {
    color: colors.brand.premiumLight,
  },
  planChipPrice: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  planChipPriceActive: {
    color: colors.brand.text,
  },
  legal: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
