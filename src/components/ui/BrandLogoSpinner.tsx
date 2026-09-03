import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const LOGO = require('../../../assets/images/icon.png');

type Props = {
  size?: number;
  accessibilityLabel?: string;
};

export function BrandLogoSpinner({ size = 72, accessibilityLabel = 'Chargement' }: Props) {
  const reduceMotion = useReduceMotion();
  const fill = useSharedValue(reduceMotion ? 1 : 0.12);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      fill.value = 1;
      pulse.value = 1;
      return;
    }

    fill.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.12, { duration: 750, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1200, easing: Easing.inOut(Easing.cubic) }),
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      false
    );
  }, [fill, pulse, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    height: fill.value * size,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View
      style={[{ width: size, height: size }, pulseStyle]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image source={LOGO} resizeMode="cover" style={{ width: size, height: size, opacity: 0.2 }} />
        <View style={styles.fillAnchor}>
          <Animated.View style={[{ width: size, overflow: 'hidden' }, fillStyle]}>
            <Image
              source={LOGO}
              resizeMode="cover"
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                width: size,
                height: size,
              }}
            />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  disc: {
    overflow: 'hidden',
    backgroundColor: colors.brand.surfaceMuted,
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24, 0.28)',
  },
  fillAnchor: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
});
