import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, borderRadius } from '@/constants/theme';
import { EVENT_CARD_MEDIA_HEIGHT, EVENT_CARD_RADIUS } from '@/constants/event-card-variants';
import { useReduceMotion } from '@/hooks/useReduceMotion';

type Props = {
  count?: number;
};

export function SkeletonBlock({
  height,
  width,
  radius = borderRadius.md,
  style,
}: {
  height: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: object;
}) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.55;
      return;
    }
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          height,
          width: width ?? '100%',
          borderRadius: radius,
          backgroundColor: 'rgba(255,255,255,0.08)',
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

function EventCardSkeletonItem() {
  const mediaHeight = EVENT_CARD_MEDIA_HEIGHT.discovery;

  return (
    <View style={styles.card}>
      <SkeletonBlock height={mediaHeight} radius={0} />
      <View style={styles.body}>
        <SkeletonBlock height={22} width="78%" />
        <SkeletonBlock height={14} width="92%" style={{ marginTop: spacing.sm }} />
        <SkeletonBlock height={14} width="55%" style={{ marginTop: spacing.xs }} />
        <View style={styles.footer}>
          <SkeletonBlock height={28} width={88} radius={borderRadius.full} />
          <SkeletonBlock height={40} width={120} radius={borderRadius.full} />
        </View>
      </View>
    </View>
  );
}

export function EventCardSkeleton({ count = 2 }: Props) {
  return (
    <View style={styles.list} accessibilityLabel="Chargement des événements">
      {Array.from({ length: count }).map((_, index) => (
        <EventCardSkeletonItem key={index} />
      ))}
    </View>
  );
}

export function EventDetailSkeleton() {
  return (
    <View style={styles.detail} accessibilityLabel="Chargement de l'événement">
      <SkeletonBlock height={280} radius={0} />
      <View style={styles.detailBody}>
        <SkeletonBlock height={28} width="70%" />
        <SkeletonBlock height={16} width="40%" style={{ marginTop: spacing.md }} />
        <SkeletonBlock height={14} width="100%" style={{ marginTop: spacing.lg }} />
        <SkeletonBlock height={14} width="95%" style={{ marginTop: spacing.xs }} />
        <SkeletonBlock height={14} width="88%" style={{ marginTop: spacing.xs }} />
        <SkeletonBlock height={120} style={{ marginTop: spacing.lg }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.brand.primary,
  },
  card: {
    borderRadius: EVENT_CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  body: {
    padding: spacing.md,
  },
  footer: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detail: {
    flex: 1,
    backgroundColor: colors.brand.primary,
  },
  detailBody: {
    padding: spacing.lg,
  },
});
