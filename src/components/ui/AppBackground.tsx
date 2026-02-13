import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop, Path, G } from 'react-native-svg';

interface AppBackgroundProps {
  style?: StyleProp<ViewStyle>;
  opacity?: number;
}

export const AppBackground: React.FC<AppBackgroundProps> = ({ style, opacity = 1 }) => {
  return (
    <View pointerEvents="none" style={[styles.container, style, { opacity }]}>
      <Svg width="100%" height="100%" viewBox="0 0 1440 3200" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="bgGradient" x1="0" y1="0" x2="0" y2="3200">
            <Stop offset="0" stopColor="#EEF3FF" />
            <Stop offset="0.45" stopColor="#F7F8FC" />
            <Stop offset="1" stopColor="#F3F3F3" />
          </LinearGradient>
          <RadialGradient id="orbBlue" cx="1210" cy="420" rx="620" ry="620" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#2A4FE3" stopOpacity="0.24" />
            <Stop offset="1" stopColor="#2A4FE3" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="orbCyan" cx="220" cy="920" rx="520" ry="520" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#48B9FF" stopOpacity="0.19" />
            <Stop offset="1" stopColor="#48B9FF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="orbMint" cx="1080" cy="1980" rx="520" ry="520" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#34C759" stopOpacity="0.14" />
            <Stop offset="1" stopColor="#34C759" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="stripeGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="1440" height="3200" fill="url(#bgGradient)" />
        <Circle cx="1210" cy="420" r="620" fill="url(#orbBlue)" />
        <Circle cx="220" cy="920" r="520" fill="url(#orbCyan)" />
        <Circle cx="1080" cy="1980" r="520" fill="url(#orbMint)" />

        <G opacity="0.55">
          <Path d="M-120 300C280 80 460 220 840 120C1080 58 1280 90 1560 240V340C1280 200 1080 170 840 230C460 330 280 180 -120 400V300Z" fill="url(#stripeGradient)" />
          <Path d="M-140 1580C240 1430 520 1540 860 1450C1110 1385 1290 1440 1570 1580V1660C1290 1525 1110 1485 860 1540C520 1630 240 1510 -140 1670V1580Z" fill="url(#stripeGradient)" />
          <Path d="M-100 2520C250 2380 560 2500 900 2410C1120 2350 1295 2390 1540 2520V2610C1295 2490 1120 2460 900 2515C560 2605 250 2485 -100 2650V2520Z" fill="url(#stripeGradient)" />
        </G>

        <G opacity="0.18">
          <Circle cx="180" cy="210" r="6" fill="#2A4FE3" />
          <Circle cx="380" cy="340" r="4" fill="#2A4FE3" />
          <Circle cx="1280" cy="640" r="5" fill="#2A4FE3" />
          <Circle cx="1160" cy="820" r="3" fill="#2A4FE3" />
          <Circle cx="260" cy="1320" r="4" fill="#2A4FE3" />
          <Circle cx="960" cy="1560" r="5" fill="#2A4FE3" />
          <Circle cx="1180" cy="1860" r="4" fill="#2A4FE3" />
          <Circle cx="420" cy="2300" r="5" fill="#2A4FE3" />
          <Circle cx="1300" cy="2720" r="6" fill="#2A4FE3" />
          <Circle cx="680" cy="3000" r="4" fill="#2A4FE3" />
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});

