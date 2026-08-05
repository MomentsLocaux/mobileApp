import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop, Path, G } from 'react-native-svg';
import { colors } from '@/constants/theme';

interface AppBackgroundProps {
  style?: StyleProp<ViewStyle>;
  opacity?: number;
  /** Soft identity wash over the light page chrome. */
  accentColor?: string;
}

function withAlpha(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const PAGE = colors.brand.page as string;
const SURFACE = colors.brand.surfaceMuted as string;

export const AppBackground: React.FC<AppBackgroundProps> = ({
  style,
  opacity = 1,
  accentColor,
}) => {
  const accent = accentColor || (colors.brand.secondary as string);
  const ids = useMemo(() => {
    const suffix = accent.replace('#', '');
    return {
      bg: `bgGradient_${suffix}`,
      orbPrimary: `orbPrimary_${suffix}`,
      orbSecondary: `orbSecondary_${suffix}`,
      orbSoft: `orbSoft_${suffix}`,
      stripe: `stripeGradient_${suffix}`,
    };
  }, [accent]);

  return (
    <View pointerEvents="none" style={[styles.container, style, { opacity }]}>
      <Svg width="100%" height="100%" viewBox="0 0 1440 3200" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={ids.bg} x1="0" y1="0" x2="0" y2="3200">
            <Stop offset="0" stopColor={PAGE} />
            <Stop offset="0.45" stopColor={SURFACE} />
            <Stop offset="1" stopColor={PAGE} />
          </LinearGradient>
          <RadialGradient
            id={ids.orbPrimary}
            cx="1210"
            cy="420"
            rx="620"
            ry="620"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={accent} stopOpacity="0.16" />
            <Stop offset="1" stopColor={accent} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id={ids.orbSecondary}
            cx="220"
            cy="920"
            rx="520"
            ry="520"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={accent} stopOpacity="0.1" />
            <Stop offset="1" stopColor={accent} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id={ids.orbSoft}
            cx="1080"
            cy="1980"
            rx="520"
            ry="520"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={accent} stopOpacity="0.08" />
            <Stop offset="1" stopColor={accent} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id={ids.stripe} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.brand.ink as string} stopOpacity="0.04" />
            <Stop offset="1" stopColor={colors.brand.ink as string} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="1440" height="3200" fill={`url(#${ids.bg})`} />
        <Circle cx="1210" cy="420" r="620" fill={`url(#${ids.orbPrimary})`} />
        <Circle cx="220" cy="920" r="520" fill={`url(#${ids.orbSecondary})`} />
        <Circle cx="1080" cy="1980" r="520" fill={`url(#${ids.orbSoft})`} />

        <G opacity="0.35">
          <Path
            d="M-120 300C280 80 460 220 840 120C1080 58 1280 90 1560 240V340C1280 200 1080 170 840 230C460 330 280 180 -120 400V300Z"
            fill={`url(#${ids.stripe})`}
          />
          <Path
            d="M-140 1580C240 1430 520 1540 860 1450C1110 1385 1290 1440 1570 1580V1660C1290 1525 1110 1485 860 1540C520 1630 240 1510 -140 1670V1580Z"
            fill={`url(#${ids.stripe})`}
          />
          <Path
            d="M-100 2520C250 2380 560 2500 900 2410C1120 2350 1295 2390 1540 2520V2610C1295 2490 1120 2460 900 2515C560 2605 250 2485 -100 2650V2520Z"
            fill={`url(#${ids.stripe})`}
          />
        </G>

        <G opacity="0.1">
          <Circle cx="180" cy="210" r="6" fill={accent} />
          <Circle cx="380" cy="340" r="4" fill={accent} />
          <Circle cx="1280" cy="640" r="5" fill={accent} />
          <Circle cx="1160" cy="820" r="3" fill={accent} />
          <Circle cx="260" cy="1320" r="4" fill={accent} />
          <Circle cx="960" cy="1560" r="5" fill={accent} />
          <Circle cx="1180" cy="1860" r="4" fill={accent} />
          <Circle cx="420" cy="2300" r="5" fill={accent} />
          <Circle cx="1300" cy="2720" r="6" fill={accent} />
          <Circle cx="680" cy="3000" r="4" fill={accent} />
        </G>

        <Rect x="0" y="0" width="1440" height="420" fill={withAlpha(accent, 0.04)} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});
