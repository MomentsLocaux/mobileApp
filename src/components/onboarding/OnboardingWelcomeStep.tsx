import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Briefcase, Compass, Heart, Sparkles } from 'lucide-react-native';
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
  'Choisir où tu traines',
  'Dire ce que tu aimes',
  'Explorer les moments près de toi',
];

const PARTICULIER_NEXT = [
  'Choisir où tu traines',
  'Dire ce que tu aimes (et ce que tu proposes)',
  'Explorer — Habitué si tu sors vraiment',
];

const PROFESSIONNEL_NEXT = [
  'Préciser votre typologie d’organisation',
  'Connecter votre SIT ou demander un connecteur',
  'Accéder à votre tableau de bord de présence',
];

export const MVP_PROMISE =
  'Ici, on crée du lien avec le monde qui nous entoure.';

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
        <View style={[styles.panel, styles.panelFun, styles.panelActive]}>
          <Text style={styles.lumiaIntro}>{LUMIA_INTRO}</Text>
          <View style={styles.bullets}>
            {MVP_NEXT.map((line) => (
              <View key={line} style={styles.bulletRow}>
                <Sparkles size={14} color={colors.brand.secondary} />
                <Text style={styles.bulletFun}>{line}</Text>
              </View>
            ))}
          </View>
          <View style={styles.chipRow}>
            <View style={styles.miniChip}>
              <Heart size={12} color={colors.brand.primary} />
              <Text style={styles.miniChipText}>Découvrir</Text>
            </View>
            <View style={styles.miniChip}>
              <Text style={styles.miniChipText}>Participer</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.hero}>Moments Locaux</Text>
      <Text style={styles.lead}>Deux portes d’entrée — choisis celle qui te ressemble.</Text>

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
        <Text style={styles.panelPromiseFun}>{MVP_PROMISE}</Text>
        <Text style={styles.lumiaIntro}>{LUMIA_INTRO}</Text>
        <View style={styles.bullets}>
          {PARTICULIER_NEXT.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <Sparkles size={14} color={colors.brand.secondary} />
              <Text style={styles.bulletFun}>{line}</Text>
            </View>
          ))}
        </View>
        <View style={styles.chipRow}>
          <View style={styles.miniChip}>
            <Heart size={12} color={colors.brand.primary} />
            <Text style={styles.miniChipText}>Découvrir</Text>
          </View>
          <View style={styles.miniChip}>
            <Text style={styles.miniChipText}>Participer</Text>
          </View>
          <View style={styles.miniChip}>
            <Text style={styles.miniChipText}>Créer (optionnel)</Text>
          </View>
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
          Diffusez une fois — Moments Locaux devient votre tableau de bord de présence réelle et
          d’interactions temps réel.
        </Text>
        <View style={styles.bullets}>
          {PROFESSIONNEL_NEXT.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <Text style={styles.bulletFormalMark}>—</Text>
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
  hero: {
    ...typography.h1,
    color: colors.brand.text,
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
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  panelFormal: {
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  panelActive: {
    borderColor: colors.brand.secondary,
  },
  panelActiveFormal: {
    borderColor: colors.brand.primary,
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
  bulletFormalMark: {
    ...typography.caption,
    color: colors.brand.primary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  miniChipText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontSize: 11,
  },
});
