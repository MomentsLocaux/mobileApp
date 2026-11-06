import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { BRAND_MARK_ARROW, BRAND_MARK_BASE, BRAND_MARK_ROUTE } from '@/constants/brand-mark';
import { colors } from '@/constants/theme';

/** Decorative mark; its containing control or brand row provides the accessible name. */
export function BrandMark({ size = 32, treatment = 'color' }: { size?: number; treatment?: 'color' | 'leaf' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessible={false}>
      <Path d={BRAND_MARK_BASE} fill="none" stroke={treatment === 'leaf' ? colors.brand.secondary : colors.brand.text} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={`${BRAND_MARK_ROUTE}${BRAND_MARK_ARROW}`} fill="none" stroke={colors.brand.secondary} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
