import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';

type AppBackgroundProps = {
  style?: StyleProp<ViewStyle>;
  opacity?: number;
};

export function AppBackground({ style, opacity = 1 }: AppBackgroundProps) {
  return (
    <View pointerEvents="none" style={[styles.container, style, { opacity }]}>
      <Svg width="100%" height="100%" viewBox="0 0 1440 3200" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="v2BgGradient" x1="0" y1="0" x2="0" y2="3200">
            <Stop offset="0" stopColor={colors.background} />
            <Stop offset="0.55" stopColor="#0c1416" />
            <Stop offset="1" stopColor="#091012" />
          </LinearGradient>
          <RadialGradient id="v2OrbPrimaryTop" cx="1140" cy="380" rx="620" ry="620" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.22" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="v2OrbPrimaryBottom" cx="220" cy="2520" rx="560" ry="560" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.16" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="v2OrbAccent" cx="260" cy="980" rx="460" ry="460" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.18" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="1440" height="3200" fill="url(#v2BgGradient)" />
        <Circle cx="1140" cy="380" r="620" fill="url(#v2OrbPrimaryTop)" />
        <Circle cx="220" cy="2520" r="560" fill="url(#v2OrbPrimaryBottom)" />
        <Circle cx="260" cy="980" r="460" fill="url(#v2OrbAccent)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});
