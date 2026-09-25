import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Check, ChevronDown, Compass, Crown, Sparkles, type LucideIcon } from 'lucide-react-native';
import { MotionReveal } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Motion } from '@/constants/motion';
import { haptics } from '@/utils/haptics';
import { OFFER_FEATURE_MATRIX } from '@/constants/offers';
import { ECLAIREUR_PLANS, HABITUE_PLANS } from '@/services/subscription.service';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TierTone = 'local' | 'habitue' | 'eclaireur';

type Tier = {
  id: TierTone;
  icon: LucideIcon;
  name: string;
  tagline: string;
  body: string;
  badge?: string;
};

const TIERS: Tier[] = [
  {
    id: 'local',
    icon: Compass,
    name: 'Local',
    tagline: 'L’offre gratuite',
    body: 'Carte, moments et favoris, pour explorer près de chez toi.',
    badge: 'Gratuit',
  },
  {
    id: 'habitue',
    icon: Sparkles,
    name: 'Habitué',
    tagline: 'Pour sortir souvent',
    body: `L’offre gratuite, plus des avantages quand tu participes sur place. ${HABITUE_PLANS.monthly.priceLabel}/mois · ${HABITUE_PLANS.annual.priceLabel}/an.`,
    badge: 'Abonnement',
  },
  {
    id: 'eclaireur',
    icon: Crown,
    name: 'Éclaireur',
    tagline: 'Pour aller plus loin',
    body: `L’offre Habitué, plus des idées précises selon tes sorties. ${ECLAIREUR_PLANS.monthly.priceLabel}/mois · ${ECLAIREUR_PLANS.annual.priceLabel}/an.`,
    badge: 'Abonnement',
  },
];

const PLAIN_DETAILS: Record<string, string> = {
  map: 'Carte, fil et recherche',
  create: 'Proposer un moment',
  social: 'Favoris, j’aime et membres',
  notifs: 'Notifications',
  report: 'Signaler un contenu',
  checkin: 'Pointer ta présence sur place',
  lumo: 'Gagner des points en sortant',
  shop: 'Boutique de petits plus',
  missions: 'Défis à accomplir',
  pass: 'Avantages chez des partenaires',
  early: 'Voir certains moments en avant-première',
  ambassador: 'Un badge visible sur ton profil',
  boost: 'Mettre en avant un moment que tu publies',
  right_now: 'Idées de moments à rejoindre tout de suite',
  radius: 'Carte des endroits où tu sors',
  reco: 'Suggestions selon tes sorties passées',
  loop: 'Idées en dehors de tes habitudes',
  insights: 'Un résumé de ce que tu as découvert',
  premium_badge: 'Un badge sur ton portrait',
};

function toneColor(tone: TierTone) {
  if (tone === 'eclaireur') return colors.warning[700];
  if (tone === 'habitue') return colors.brand.success;
  return colors.brand.secondary;
}

function detailsFor(tier: TierTone): string[] {
  return OFFER_FEATURE_MATRIX.filter((row) => row[tier]).map(
    (row) => PLAIN_DETAILS[row.id] ?? row.label,
  );
}

export function OnboardingTiersStep() {
  const [expandedId, setExpandedId] = useState<TierTone | null>(null);

  const toggleTier = (id: TierTone) => {
    haptics.selection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <MotionReveal style={styles.wrap}>
      <Text style={styles.title}>Trois façons d’utiliser l’app</Text>
      <Text style={styles.subtitle}>
        Chaque offre inclut la précédente. Touche une carte pour le détail. Tu peux rester sur
        l’offre gratuite.
      </Text>

      <View style={styles.list}>
        {TIERS.map((tier, index) => {
          const Icon = tier.icon;
          const expanded = expandedId === tier.id;
          const accent = toneColor(tier.id);
          const details = detailsFor(tier.id);

          return (
            <MotionReveal key={tier.id} delay={index * Motion.stagger.content}>
              <TouchableOpacity
                style={[
                  styles.card,
                  expanded && styles.cardExpanded,
                  expanded && tier.id === 'eclaireur' && styles.cardExpandedPremium,
                  expanded && tier.id === 'habitue' && styles.cardExpandedHabitue,
                  expanded && tier.id === 'local' && styles.cardExpandedLocal,
                ]}
                onPress={() => toggleTier(tier.id)}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${tier.name}. ${expanded ? 'Masquer' : 'Afficher'} le détail`}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, styles[`icon_${tier.id}`]]}>
                    <Icon size={20} color={accent} strokeWidth={2.2} />
                  </View>
                  <View style={styles.copy}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{tier.name}</Text>
                      {tier.badge ? (
                        <View
                          style={[
                            styles.badge,
                            tier.id === 'eclaireur' && styles.badgePremium,
                            tier.id === 'habitue' && styles.badgeSoon,
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              tier.id === 'eclaireur' && styles.badgeTextPremium,
                              tier.id === 'habitue' && styles.badgeTextSoon,
                            ]}
                          >
                            {tier.badge}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.tagline}>{tier.tagline}</Text>
                    {!expanded ? <Text style={styles.body}>{tier.body}</Text> : null}
                  </View>
                  <View style={[styles.chevronWrap, expanded && styles.chevronWrapOpen]}>
                    <ChevronDown
                      size={18}
                      color={expanded ? accent : colors.brand.textSecondary}
                      style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
                    />
                  </View>
                </View>

                {expanded ? (
                  <View style={styles.details}>
                    <Text style={styles.detailsLabel}>Inclus dans {tier.name}</Text>
                    {details.map((item) => (
                      <View key={item} style={styles.detailRow}>
                        <View style={[styles.checkWrap, { borderColor: `${accent}55` }]}>
                          <Check size={12} color={accent} strokeWidth={3} />
                        </View>
                        <Text style={styles.detailText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </TouchableOpacity>
            </MotionReveal>
          );
        })}
      </View>
    </MotionReveal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    marginBottom: spacing.lg,
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
  list: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  card: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand.line,
  },
  cardExpanded: {},
  cardExpandedLocal: {},
  cardExpandedHabitue: {},
  cardExpandedPremium: {},
  cardTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon_local: {
    backgroundColor: 'rgba(124, 181, 24, 0.14)',
  },
  icon_habitue: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  icon_eclaireur: {
    backgroundColor: colors.brand.premiumMuted,
  },
  copy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  name: {
    ...typography.h6,
    color: colors.brand.text,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(124, 181, 24, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24, 0.35)',
  },
  badgePremium: {
    backgroundColor: colors.brand.premiumMuted,
    borderColor: colors.brand.premiumBorder,
  },
  badgeSoon: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  badgeText: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  badgeTextPremium: {
    color: colors.brand.text,
  },
  badgeTextSoon: {
    color: colors.brand.text,
  },
  tagline: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  body: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    lineHeight: 18,
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surfaceMuted,
    marginTop: 8,
  },
  chevronWrapOpen: {
    backgroundColor: colors.brand.surface,
  },
  details: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing.sm,
  },
  detailsLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: colors.brand.surface,
    marginTop: 1,
  },
  detailText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    flex: 1,
    lineHeight: 20,
  },
});
