import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Briefcase, Compass } from 'lucide-react-native';
import type { AccountKind } from '@/constants/accountIdentity';
import { LUMIA_INTRO } from '@/constants/lumiaTour';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';

type Props = {
  preferredKind: AccountKind | null;
  onSelectKind: (kind: AccountKind) => void;
  /** When false (MVP / FEATURE_DIFFUSEUR off), single discovery pitch — no Particulier/Pro choice. */
  showProfessionnel?: boolean;
};

const MVP_NEXT = [
  'Dire comment t’appeler',
  'Choisir ton quartier',
  'Indiquer ce qui t’attire',
  'Ajouter un portrait, si tu veux',
];

const PARTICULIER_NEXT = [
  'Choisir ton quartier et tes thèmes',
  'Ajouter un portrait pour les autres membres',
  'Proposer des moments, seulement si tu le souhaites',
];

const PROFESSIONNEL_NEXT = [
  'Préciser ton type d’activité',
  'Relier ton agenda existant, si tu en as un',
  'Suivre les réactions à tes moments',
];

export const MVP_PROMISE =
  'Quelques étapes pour voir les moments près de chez toi.';

/**
 * Welcome — dual door when Diffuseur is on; single discovery pitch otherwise (MVP).
 */
export function OnboardingWelcomeStep({
  preferredKind,
  onSelectKind,
  showProfessionnel = true,
}: Props) {
  useEffect(() => {
    if (!showProfessionnel) {
      onSelectKind('particulier');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lock MVP identity once
  }, [showProfessionnel]);

  if (!showProfessionnel) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.lumiaIntro}>{LUMIA_INTRO}</Text>
        <View style={styles.bullets}>
          {MVP_NEXT.map((line, index) => (
            <View key={line} style={styles.bulletRow}>
              <Text style={styles.stepMark}>{index + 1}</Text>
              <Text style={styles.bulletFun}>{line}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>Deux portes — choisis celle qui te correspond.</Text>

      <TouchableOpacity
        style={[styles.panel, styles.panelFun, preferredKind === 'particulier' && styles.panelActive]}
        onPress={() => {
          haptics.selection();
          onSelectKind('particulier');
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: preferredKind === 'particulier' }}
      >
        <View style={styles.panelHeader}>
          <Compass size={22} color={colors.brand.secondary} strokeWidth={2.2} />
          <Text style={styles.panelTitleFun}>Particulier</Text>
        </View>
        <Text style={styles.panelPromiseFun}>
          Tu explores les moments près de chez toi, et tu peux en proposer si tu veux.
        </Text>
        <Text style={styles.lumiaIntro}>{LUMIA_INTRO}</Text>
        <View style={styles.bullets}>
          {PARTICULIER_NEXT.map((line, index) => (
            <View key={line} style={styles.bulletRow}>
              <Text style={styles.stepMark}>{index + 1}</Text>
              <Text style={styles.bulletFun}>{line}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.panel,
          styles.panelFormal,
          preferredKind === 'professionnel' && styles.panelActiveFormal,
        ]}
        onPress={() => {
          haptics.selection();
          onSelectKind('professionnel');
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: preferredKind === 'professionnel' }}
      >
        <View style={styles.panelHeader}>
          <Briefcase size={22} color={colors.brand.primary} strokeWidth={2.2} />
          <Text style={styles.panelTitleFormal}>Professionnel</Text>
        </View>
        <Text style={styles.panelPromiseFormal}>
          Tu publies tes moments une fois, puis tu suis les réactions sur ton territoire.
        </Text>
        <View style={styles.bullets}>
          {PROFESSIONNEL_NEXT.map((line, index) => (
            <View key={line} style={styles.bulletRow}>
              <Text style={styles.stepMark}>{index + 1}</Text>
              <Text style={styles.bulletFormal}>{line}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
  },
  lead: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
  },
  panel: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  panelFun: {
    borderColor: colors.neutral[200],
    backgroundColor: colors.brand.surface,
  },
  panelFormal: {
    borderColor: colors.neutral[200],
    backgroundColor: colors.brand.surface,
  },
  panelActive: {
    borderColor: colors.brand.secondary,
  },
  panelActiveFormal: {
    borderColor: colors.brand.secondary,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  panelTitleFun: {
    ...typography.h3,
    color: colors.brand.text,
  },
  panelTitleFormal: {
    ...typography.h3,
    color: colors.brand.text,
    letterSpacing: 0.3,
  },
  panelPromiseFun: {
    ...typography.body,
    color: colors.brand.text,
    lineHeight: 22,
  },
  panelPromiseFormal: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
  },
  lumiaIntro: {
    ...typography.body,
    color: colors.brand.text,
    lineHeight: 22,
  },
  bullets: {
    gap: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletFun: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  bulletFormal: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  stepMark: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
    width: 16,
    lineHeight: 18,
  },
});
