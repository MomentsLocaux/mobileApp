import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, typography, type TypographyVariant } from '../theme';

type TypographyProps = TextProps & {
  variant?: TypographyVariant;
  color?: string;
  weight?: TextStyle['fontWeight'];
};

export function Typography({
  variant = 'body',
  color = colors.textPrimary,
  weight,
  style,
  ...props
}: TypographyProps) {
  return <Text style={[typography[variant], { color }, weight ? { fontWeight: weight } : null, style]} {...props} />;
}
