import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { brandIconArtwork, type BrandIconName } from '@/constants/brand-icon-artwork';
import { colors } from '@/constants/theme';

export type { BrandIconName };
export type BrandIconProps = {
  name: BrandIconName;
  size?: number;
  /** Leaf fill instead of mint — tab focus, liked heart, drawer current row. */
  active?: boolean;
  color?: string;
  fillColor?: string;
};

const MINT = colors.primary[200];
const LEAF = colors.brand.secondary;
const INK = colors.brand.ink;

/** Duo végétal: mint (or leaf) fill, ink stroke. No gradient, filter or 3D. */
export const BrandIcon = React.memo(function BrandIcon({
  name,
  size = 26,
  active = false,
  color,
  fillColor,
}: BrandIconProps) {
  const glyph = brandIconArtwork[name];
  const stroke = color || INK;
  const isHeart = name === 'heart';
  const fill =
    fillColor ??
    (isHeart ? (active ? LEAF : 'transparent') : active ? LEAF : MINT);

  return (
    <Svg width={size} height={size} viewBox="-1 -1 26 26" accessible={false}>
      {glyph.body ? (
        <Path
          d={glyph.body}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {glyph.detail && !isHeart ? (
        <Path
          d={glyph.detail}
          fill="none"
          stroke={stroke}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </Svg>
  );
});
