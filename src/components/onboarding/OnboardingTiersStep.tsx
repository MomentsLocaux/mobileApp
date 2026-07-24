import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Check, ChevronDown, Compass, Crown, Sparkles, type LucideIcon } from 'lucide-react-native';
import { MotionReveal } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Motion } from '@/constants/motion';
import { haptics } from '@/utils/haptics';

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
  details: string[];
};

const TIERS: Tier[] = [
  {
    id: 'local',
    icon: Compass,
    name: 'Local',
    tagline: 'Explore ton quartier',
    body: 'Carte, moments, création, check-in et social — l’expérience complète, gratuite.',
    badge: 'Gratuit',
    details: [
      'Voir les moments autour de vous (carte + fil)',
      'Créer un événement et le soumettre pour validation',
      'Garder des favoris, liker et suivre des créateurs',
      'Valider votre présence sur place (check-in)',
      'Gérer votre profil et signaler un contenu',
    ],
  },
  {
    id: 'habitue',
    icon: Sparkles,
    name: 'Habitué',
    tagline: 'Plus tu sors, plus tu débloques',
    body: 'Offre d’engagement local (Lumo, missions, Pass). Payante — tarif bientôt annoncé.',
    badge: 'Payant',
    details: [
      'Gagner des Lumo en sortant et en contribuant (points d’engagement)',
      'Missions courtes pour progresser chaque jour / semaine',
      'Débloquer des Pass partenaires (avantages IRL locaux)',
      'Accéder plus tôt à certains événements (avant le public)',
      'Gagner un statut de quartier (badge Ambassadeur)',
      'Tarif d’abonnement : à confirmer (non figé dans l’ADR)',
    ],
  },
  {
    id: 'eclaireur',
    icon: Crown,
    name: 'Éclaireur',
    tagline: 'Découvre autrement',
    body: 'Abonnement Discovery : suggestions plus riches et carte de votre zone. 2,99 €/mois ou 19,99 €/an.',
    badge: 'Abo',
    details: [
      'Suggestions « maintenant » plus complètes (au-delà de l’aperçu gratuit)',
      'Carte de votre zone habituelle et des nouveaux coins à explorer',
      'Recommandations plus adaptées à vos sorties',
      'Bientôt : idées pour sortir de vos routines + bilans de découverte',
      'Indépendant d’Habitué : aide à découvrir, pas un boost de Lumo',
    ],
  },
];

function toneColor(tone: TierTone) {
  if (tone === 'eclaireur') return colors.brand.premiumLight;
  if (tone === 'habitue') return colors.brand.success;
  return colors.brand.secondary;
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
      <Text style={styles.title}>Trois façons de vivre Moments Locaux</Text>
      <Text style={styles.subtitle}>
        Touchez une carte pour voir le détail. Local est gratuit. Habitué et Éclaireur sont des
        offres payantes (Éclaireur déjà tarifé ; Habitué à venir).
      </Text>

      <View style={styles.list}>
        {TIERS.map((tier, index) => {
          const Icon = tier.icon;
          const expanded = expandedId === tier.id;
          const accent = toneColor(tier.id);

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
                    <Text style={styles.detailsLabel}>Contenu inclus</Text>
                    {tier.details.map((item) => (
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
    ...typography.h3,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
  list: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardExpanded: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardExpandedLocal: {
    borderColor: 'rgba(43, 191, 227, 0.35)',
  },
  cardExpandedHabitue: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  cardExpandedPremium: {
    borderColor: colors.brand.premiumBorder,
  },
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
    backgroundColor: 'rgba(43, 191, 227, 0.14)',
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
    backgroundColor: 'rgba(43, 191, 227, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(43, 191, 227, 0.35)',
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
    color: colors.brand.premiumLight,
  },
  badgeTextSoon: {
    color: '#6EE7B7',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 8,
  },
  chevronWrapOpen: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  details: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginTop: 1,
  },
  detailText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    flex: 1,
    lineHeight: 20,
  },
});
