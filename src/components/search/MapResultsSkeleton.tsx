import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { borderRadius, colors, spacing } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';

type Props = {
  variant: 'peek' | 'list';
};

function PulseBlock({
  height,
  width,
  radius = borderRadius.sm,
}: {
  height: number;
  width: number | `${number}%`;
  radius?: number;
}) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.62;
      return;
    }
    opacity.value = withRepeat(
      withTiming(0.95, {
        duration: 850,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.block,
        { height, width, borderRadius: radius },
        animatedStyle,
      ]}
    />
  );
}

export function MapResultsSkeleton({ variant }: Props) {
  if (variant === 'peek') {
    return (
      <View
        style={styles.peek}
        accessibilityRole="progressbar"
        accessibilityLabel="Recherche des événements dans cette zone"
      >
        <PulseBlock height={28} width={28} radius={borderRadius.full} />
        <View style={styles.peekLines}>
          <PulseBlock height={12} width="48%" />
          <PulseBlock height={9} width="72%" />
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.list}
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement des résultats de la carte"
    >
      {[0, 1].map((index) => (
        <View key={index} style={styles.card}>
          <PulseBlock height={132} width="100%" radius={borderRadius.lg} />
          <View style={styles.cardLines}>
            <PulseBlock height={15} width="76%" />
            <PulseBlock height={11} width="52%" />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.brand.surfaceMuted,
  },
  peek: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  peekLines: {
    flex: 1,
    gap: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  card: {
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surface,
    gap: spacing.sm,
  },
  cardLines: {
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
});
