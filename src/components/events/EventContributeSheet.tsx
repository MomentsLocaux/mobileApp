import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Briefcase, Sparkles, Camera, Pencil, X, ChevronRight } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { FloatingPressable } from '@/components/ui/FloatingPressable';
import { haptics } from '@/utils/haptics';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { useEventPublishSurfaces } from '@/hooks/useEventPublishSurfaces';
import type { EventSubmissionSource } from '@/types/event-submission';

type Step = 'intent' | 'method';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called when guest taps contribute — parent opens GuestGateModal. */
  onRequireAuth?: (title: string) => void;
  isGuest?: boolean;
};

/**
 * Unified contribute sheet behind the tab-bar "+".
 * Intent (orga vs suggest) when both available, then method (affiche IA vs manuel).
 */
export function EventContributeSheet({ visible, onClose, onRequireAuth, isGuest }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const { canOrganize, eventSuggest, needsIntentChooser, routes } = useEventPublishSurfaces();
  const resetStore = useCreateEventStore((s) => s.reset);
  const setSubmissionSource = useCreateEventStore((s) => s.setSubmissionSource);

  const [step, setStep] = useState<Step>('intent');
  const [intent, setIntent] = useState<EventSubmissionSource>('community_suggest');

  useEffect(() => {
    if (!visible) {
      progress.value = 0;
      return;
    }
    const initialIntent: EventSubmissionSource = canOrganize
      ? needsIntentChooser
        ? 'organizer_create'
        : 'organizer_create'
      : 'community_suggest';
    setIntent(initialIntent);
    setStep(needsIntentChooser ? 'intent' : 'method');
    progress.value = reduceMotion ? 1 : withSpring(1, Motion.spring.sheet);
  }, [visible, canOrganize, needsIntentChooser, progress, reduceMotion]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 40 }],
    opacity: 0.94 + progress.value * 0.06,
  }));

  const closeAnimated = () => {
    if (reduceMotion) {
      onClose();
      return;
    }
    progress.value = withTiming(0, {
      duration: Motion.duration.fast,
      easing: Motion.easing.exit,
    });
    setTimeout(onClose, Motion.duration.fast);
  };

  const ensureAuth = (title: string) => {
    if (isGuest) {
      closeAnimated();
      onRequireAuth?.(title);
      return false;
    }
    return true;
  };

  const goPoster = (source: EventSubmissionSource) => {
    if (!ensureAuth(source === 'community_suggest' ? 'Proposer un événement' : 'Créer un événement')) {
      return;
    }
    if (!eventSuggest) {
      goManual(source);
      return;
    }
    haptics.selection();
    resetStore();
    setSubmissionSource(source);
    closeAnimated();
    router.push(`${routes.posterSuggest}?source=${source}` as any);
  };

  const goManual = (source: EventSubmissionSource) => {
    if (!ensureAuth(source === 'community_suggest' ? 'Proposer un événement' : 'Créer un événement')) {
      return;
    }
    haptics.selection();
    resetStore();
    setSubmissionSource(source);
    closeAnimated();
    router.push(routes.eventFormStepper as any);
  };

  const chooseIntent = (source: EventSubmissionSource) => {
    haptics.selection();
    setIntent(source);
    // Organizer-only without suggest flag: skip method, go straight to form.
    if (source === 'organizer_create' && !eventSuggest) {
      goManual(source);
      return;
    }
    setStep('method');
  };

  // Direct open path when only organizer create (no suggest): skip sheet UI for method if needed.
  // Parent may still open sheet; we render method for suggest or both.

  const title =
    step === 'intent'
      ? 'Que souhaitez-vous faire ?'
      : intent === 'community_suggest'
        ? 'Proposer un événement'
        : 'Créer un événement';

  const subtitle =
    step === 'intent'
      ? 'Choisissez votre rôle pour cet événement.'
      : 'Préremplir avec une affiche, ou saisir vous-même.';

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={closeAnimated}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdropWrap, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAnimated} accessibilityLabel="Fermer">
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.androidDim]} />
            )}
            <View style={styles.backdropTint} />
          </Pressable>
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm },
          ]}
        >
          <View style={styles.handleRow}>
            <View style={styles.handle} />
            <FloatingPressable
              onPress={closeAnimated}
              accessibilityLabel="Fermer"
              style={styles.closeBtn}
            >
              <X size={18} color={colors.brand.textSecondary} />
            </FloatingPressable>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {step === 'intent' ? (
            <View style={styles.options}>
              <OptionRow
                icon={Briefcase}
                title="Je suis l’organisateur"
                subtitle="Créer et publier mon événement"
                onPress={() => chooseIntent('organizer_create')}
              />
              <OptionRow
                icon={Sparkles}
                title="Je propose un événement"
                subtitle="Événement repéré (affiche, flyer…)"
                onPress={() => chooseIntent('community_suggest')}
              />
            </View>
          ) : (
            <View style={styles.options}>
              {eventSuggest ? (
                <OptionRow
                  icon={Camera}
                  title="Scanner une affiche"
                  subtitle="L’IA préremplit le formulaire"
                  onPress={() => goPoster(intent)}
                />
              ) : null}
              <OptionRow
                icon={Pencil}
                title="Saisie manuelle"
                subtitle="Remplir le formulaire soi-même"
                onPress={() => goManual(intent)}
              />
              {needsIntentChooser ? (
                <TouchableOpacity
                  onPress={() => setStep('intent')}
                  style={styles.backLink}
                  accessibilityRole="button"
                >
                  <Text style={styles.backLinkText}>← Changer d’intention</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function OptionRow({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: typeof Briefcase;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.option}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.optionIcon}>
        <Icon size={20} color={colors.brand.secondary} />
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={18} color={colors.brand.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  androidDim: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 25, 0.35)',
  },
  sheet: {
    backgroundColor: colors.brand.page,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.08)',
  },
  handleRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 51, 41, 0.2)',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: -4,
    padding: spacing.sm,
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.sm,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
    backgroundColor: colors.brand.surface,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 181, 24, 0.12)',
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.brand.text,
  },
  optionSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  backLink: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  backLinkText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
});
