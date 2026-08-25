import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import {
  LUMIA_AVATAR_LOCAL,
  LUMIA_NAME,
  type LumiaTourStep,
  type LumiaTourTargetRect,
} from '@/constants/lumiaTour';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useLumiaTourStore } from '@/store/lumiaTourStore';
import { haptics } from '@/utils/haptics';

const SCRIM = 'rgba(26, 51, 41, 0.72)';
const BUBBLE_MAX_WIDTH = 280;
const AVATAR_SIZE = 84;
const TYPE_MS = 16;

type Props = {
  visible: boolean;
  steps: LumiaTourStep[];
  onDismiss: (reason: 'done' | 'skipped') => void;
  onStepChange?: (step: LumiaTourStep) => void;
};

function SpotlightScrim({ hole }: { hole: LumiaTourTargetRect | null }) {
  const { width: W, height: H } = Dimensions.get('window');

  if (!hole || hole.width <= 0 || hole.height <= 0) {
    return <View style={[StyleSheet.absoluteFill, styles.scrimFull]} pointerEvents="auto" />;
  }

  const radius = hole.radius ?? Math.min(hole.width, hole.height) / 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <Mask id="lumiaTourHole" x="0" y="0" width={W} height={H}>
            <Rect x="0" y="0" width={W} height={H} fill="#ffffff" />
            <Rect
              x={hole.x}
              y={hole.y}
              width={hole.width}
              height={hole.height}
              rx={radius}
              ry={radius}
              fill="#000000"
            />
          </Mask>
        </Defs>
        <Rect x="0" y="0" width={W} height={H} fill={SCRIM} mask="url(#lumiaTourHole)" />
      </Svg>
    </View>
  );
}

export function LumiaTourOverlay({ visible, steps, onDismiss, onStepChange }: Props) {
  const insets = useSafeAreaInsets();
  const targets = useLumiaTourStore((s) => s.targets);
  const [index, setIndex] = useState(0);
  const [typedLen, setTypedLen] = useState(0);
  const step = steps[index];
  const isLast = index >= steps.length - 1;
  const { width: windowW, height: windowH } = Dimensions.get('window');
  const spoken = step?.body ?? '';
  const typedComplete = typedLen >= spoken.length;

  const progressLabel = useMemo(
    () => (steps.length ? `${index + 1} / ${steps.length}` : ''),
    [index, steps.length],
  );

  useEffect(() => {
    if (!visible) {
      setIndex(0);
      setTypedLen(0);
      return;
    }
    setIndex(0);
  }, [visible]);

  useEffect(() => {
    if (!visible || !step) return;
    onStepChange?.(step);
  }, [visible, step, onStepChange]);

  useEffect(() => {
    setTypedLen(0);
  }, [index, visible]);

  useEffect(() => {
    if (!visible || !spoken.length || typedLen >= spoken.length) return;
    const timer = setTimeout(() => setTypedLen((n) => n + 1), TYPE_MS);
    return () => clearTimeout(timer);
  }, [visible, spoken, typedLen]);

  if (!steps.length || !step) return null;

  const hole = step.target ? targets[step.target] ?? null : null;

  const finishTyping = () => {
    if (!typedComplete) setTypedLen(spoken.length);
  };

  const goNext = () => {
    haptics.selection();
    if (!typedComplete) {
      finishTyping();
      return;
    }
    if (isLast) {
      onDismiss('done');
      return;
    }
    setIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const skip = () => {
    haptics.light();
    onDismiss('skipped');
  };

  const bubbleWidth = Math.min(BUBBLE_MAX_WIDTH, windowW - spacing.lg * 2);
  const avatarLeft = Math.max(insets.left, spacing.md);
  const avatarTop = (windowH - AVATAR_SIZE) / 2;
  const centeredLeft = (windowW - bubbleWidth) / 2;
  const minBubbleLeft = avatarLeft + AVATAR_SIZE + spacing.sm;
  const bubbleLeft = Math.min(
    Math.max(centeredLeft, minBubbleLeft),
    windowW - bubbleWidth - spacing.md,
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={skip}
      statusBarTranslucent
    >
      <View style={styles.root} pointerEvents="box-none">
        <SpotlightScrim hole={hole} />

        <Image
          source={LUMIA_AVATAR_LOCAL}
          style={[styles.avatar, { left: avatarLeft, top: avatarTop }]}
          accessibilityLabel={LUMIA_NAME}
        />

        <View
          style={[styles.bubbleWrap, { left: bubbleLeft, width: bubbleWidth }]}
          pointerEvents="box-none"
        >
          <Pressable onPress={finishTyping} accessibilityRole="text">
            <View style={styles.bubble}>
              <View style={styles.bubbleHeader}>
                <Text style={styles.name}>{LUMIA_NAME}</Text>
                <Text style={styles.progress}>{progressLabel}</Text>
              </View>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.body}>
                {spoken.slice(0, typedLen)}
                {!typedComplete ? <Text style={styles.caret}>|</Text> : null}
              </Text>
              <View style={styles.dots}>
                {steps.map((item, i) => (
                  <View key={item.id} style={[styles.dot, i === index && styles.dotActive]} />
                ))}
              </View>
              <Button
                title={isLast ? 'C’est compris' : 'Suivant'}
                onPress={goNext}
                fullWidth
                size="sm"
              />
              <Pressable
                onPress={skip}
                accessibilityRole="button"
                accessibilityLabel="Passer le tour Lumia"
                style={styles.skipWrap}
              >
                <Text style={styles.skip}>Passer · ne plus afficher</Text>
              </Pressable>
              <View style={styles.tail} />
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrimFull: {
    backgroundColor: SCRIM,
  },
  avatar: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2.5,
    borderColor: colors.brand.secondary,
    backgroundColor: colors.brand.surfaceMuted,
    zIndex: 2,
  },
  bubbleWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 3,
  },
  bubble: {
    width: '100%',
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.brand.secondary,
    gap: spacing.xs,
    shadowColor: '#1A3329',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    ...typography.h6,
    color: colors.brand.text,
  },
  progress: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  title: {
    ...typography.h5,
    color: colors.brand.text,
  },
  body: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
    minHeight: 44,
  },
  caret: {
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.neutral[200],
  },
  dotActive: {
    backgroundColor: colors.brand.secondary,
    width: 16,
  },
  skipWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    minHeight: 40,
    justifyContent: 'center',
  },
  skip: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textDecorationLine: 'underline',
  },
  tail: {
    position: 'absolute',
    left: -8,
    top: '46%',
    width: 16,
    height: 16,
    backgroundColor: colors.brand.surface,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.brand.secondary,
    transform: [{ rotate: '45deg' }],
  },
});
