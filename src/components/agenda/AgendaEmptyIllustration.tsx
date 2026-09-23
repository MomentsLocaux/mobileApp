import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@/constants/theme';

/** Line-art empty for Mon agenda — pin + leaf spark, not a Lucide glyph. */
export function AgendaEmptyIllustration({ size = 132 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]} accessibilityElementsHidden>
      <Svg width={size} height={size} viewBox="0 0 132 132">
        <Circle cx="28" cy="38" r="10" fill="rgba(124, 181, 24, 0.12)" />
        <Circle cx="108" cy="44" r="7" fill="rgba(124, 181, 24, 0.16)" />
        <Path
          d="M22 48c12-8 22-4 28 2M96 36c8-6 18-4 22 3"
          fill="none"
          stroke={colors.primary[200]}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <Path
          d="M66 22c18 0 32 14 32 32 0 24-32 52-32 52S34 78 34 54c0-18 14-32 32-32Z"
          fill="rgba(124, 181, 24, 0.16)"
          stroke={colors.brand.ink}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <Circle cx="66" cy="54" r="12" fill={colors.brand.secondary} stroke={colors.brand.ink} strokeWidth="2" />
        <Path
          d="M66 46.5 68.4 52l6 .6-4.6 4 1.4 5.9L66 59.6 60.8 62.5l1.4-5.9-4.6-4 6-.6Z"
          fill={colors.brand.page}
        />
        <Path
          d="M86 24 88 29l5 .4-3.8 3.2 1.2 4.8L86 35.2 81.6 37.4l1.2-4.8-3.8-3.2 5-.4Z"
          fill={colors.brand.secondary}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
