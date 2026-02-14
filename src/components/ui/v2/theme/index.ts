import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';
import { animation } from './animation';

export const borderRadius = {
  sm: radius.sm,
  md: radius.md,
  lg: radius.lg,
  xl: radius.xl,
  full: radius.full,
} as const;

export const minimumTouchTarget = 48;

export const theme = {
  colors,
  typography,
  spacing,
  radius,
  borderRadius,
  shadows,
  animation,
  minimumTouchTarget,
} as const;

export { colors, typography, spacing, radius, shadows, animation };
export type { AppColors } from './colors';
export type { TypographyVariant } from './typography';
export * as legacyTheme from './legacy';
