import React from 'react';
import { View } from 'react-native';
import { AnimatedBrandMark } from './AnimatedBrandMark';

type Props = {
  size?: number;
  accessibilityLabel?: string;
};

/** Shared Signature B loading mark, including discovery and analysis surfaces. */
export function BrandLogoSpinner({ size = 72, accessibilityLabel = 'Chargement' }: Props) {
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel}>
      <AnimatedBrandMark size={size} variant="loading" />
    </View>
  );
}
