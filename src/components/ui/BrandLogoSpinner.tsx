import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const LOGO_MARK = require('../../../assets/images/logo-mark.png');

type Props = {
  size?: number;
  accessibilityLabel?: string;
};

export function BrandLogoSpinner({
  size = 72,
  accessibilityLabel = 'Chargement',
}: Props) {
  const reduceMotion = useReduceMotion();
  const outerRotation = useSharedValue(0);
  const innerRotation = useSharedValue(0);
  const breathe = useSharedValue(0);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      outerRotation.value = 0;
      innerRotation.value = 0;
      breathe.value = 0;
      halo.value = 0;
      return;
    }

    outerRotation.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.linear }),
      -1,
      false,
    );
    innerRotation.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      false,
    );
    halo.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(outerRotation);
      cancelAnimation(innerRotation);
      cancelAnimation(breathe);
      cancelAnimation(halo);
    };
  }, [breathe, halo, innerRotation, outerRotation, reduceMotion]);

  const outerOrbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerRotation.value * 360}deg` }],
  }));

  const innerOrbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerRotation.value * -360}deg` }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -breathe.value * size * 0.018 },
      { scale: 0.96 + breathe.value * 0.055 },
    ],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: (1 - halo.value) * 0.24,
    transform: [{ scale: 0.68 + halo.value * 0.46 }],
  }));

  const centerSize = size * 0.68;
  const logoSize = size * 0.47;
  const innerOrbitSize = size * 0.84;
  const orbitBorderWidth = Math.max(1.5, size * 0.025);

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[
          styles.halo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          haloStyle,
        ]}
      />

      <Animated.View
        style={[
          styles.orbit,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: orbitBorderWidth,
          },
          outerOrbitStyle,
        ]}
      >
        <View
          style={[
            styles.orbitDot,
            {
              width: orbitBorderWidth * 2.7,
              height: orbitBorderWidth * 2.7,
              borderRadius: orbitBorderWidth * 1.35,
              top: -orbitBorderWidth * 0.85,
            },
          ]}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.innerOrbit,
          {
            width: innerOrbitSize,
            height: innerOrbitSize,
            borderRadius: innerOrbitSize / 2,
            borderWidth: Math.max(1, orbitBorderWidth * 0.72),
            marginLeft: -innerOrbitSize / 2,
            marginTop: -innerOrbitSize / 2,
          },
          innerOrbitStyle,
        ]}
      />

      <Animated.View
        style={[
          styles.logoDisc,
          {
            width: centerSize,
            height: centerSize,
            borderRadius: centerSize / 2,
            marginLeft: -centerSize / 2,
            marginTop: -centerSize / 2,
          },
          logoStyle,
        ]}
      >
        <Image
          source={LOGO_MARK}
          resizeMode="contain"
          fadeDuration={0}
          accessible={false}
          style={{ width: logoSize, height: logoSize }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    backgroundColor: colors.brand.secondary,
  },
  orbit: {
    position: 'absolute',
    borderColor: 'transparent',
    borderTopColor: colors.brand.secondary,
    borderRightColor: colors.brand.secondary,
  },
  orbitDot: {
    position: 'absolute',
    left: '50%',
    backgroundColor: colors.brand.secondary,
  },
  innerOrbit: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderColor: 'transparent',
    borderBottomColor: colors.primary[200],
    borderLeftColor: colors.primary[200],
  },
  logoDisc: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.primary[100],
    shadowColor: colors.brand.text,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
});
