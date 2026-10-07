import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { colors } from '@/constants/theme';

/** Decorative local scene, composed from the app's Duo végétal artwork. */
export function OnboardingNeighborhood({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.scene, compact && styles.compact]} accessible={false}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 320 180">
        <Circle cx="162" cy="91" r="76" fill={colors.brand.surfaceMuted} />
        <Path d="M18 136C70 159 88 88 149 113S243 160 302 98" fill="none" stroke={colors.neutral[300]} strokeWidth="2" strokeDasharray="4 7" strokeLinecap="round" />
        <Path d="M52 106c-17-5-24-17-18-29 16 2 25 11 18 29Zm4 0c-1-18 7-30 22-29 3 17-5 28-22 29M265 116c-14-5-20-15-15-25 14 2 21 10 15 25Zm4 0c0-15 7-25 19-24 3 14-4 24-19 24" fill={colors.primary[200]} />
        <Circle cx="80" cy="36" r="4" fill={colors.brand.secondary} />
        <Circle cx="274" cy="61" r="3" fill={colors.neutral[300]} />
      </Svg>
      <View style={styles.home}><BrandIcon name="home" size={52} /></View>
      <View style={styles.pin}><BrandIcon name="pin" size={70} active /></View>
      <View style={styles.calendar}><BrandIcon name="calendar" size={44} /></View>
      <View style={styles.spark}><BrandIcon name="sparkles" size={26} active /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { width: '100%', maxWidth: 320, height: 180, alignSelf: 'center' },
  compact: { height: 140 },
  home: { position: 'absolute', left: '22%', top: '44%', transform: [{ rotate: '-8deg' }] },
  pin: { position: 'absolute', left: '44%', top: '17%' },
  calendar: { position: 'absolute', left: '69%', top: '51%', transform: [{ rotate: '8deg' }] },
  spark: { position: 'absolute', left: '72%', top: '15%' },
});
