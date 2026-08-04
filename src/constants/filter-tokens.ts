import { borderRadius, colors, minimumTouchTarget, spacing, typography } from './theme';

/**
 * Visual contract for the shared filter kit (discovery surfaces: home, map, search).
 * Every colour is derived from the brand palette so no filter component has to
 * hardcode a hex value.
 */

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface FilterChipTone {
  inactiveBackgroundColor: string;
  inactiveBorderColor: string;
  inactiveTextColor: string;
  activeBackgroundColor: string;
  activeBorderColor: string;
  activeTextColor: string;
}

export const filterColors = {
  accent: colors.brand.secondary,
  /** Foreground colour to use on top of `accent` (replaces hardcoded #0f1719). */
  onAccent: colors.brand.primary,
  surface: colors.brand.surface,
  background: colors.brand.primary,
  border: hexToRgba(colors.brand.text, 0.08),
  text: colors.brand.text,
  textSecondary: colors.brand.textSecondary,
  chipInactiveBackground: colors.brand.surface,
  chipInactiveBorder: hexToRgba(colors.brand.text, 0.08),
  chipInactiveText: colors.brand.textSecondary,
  chipActiveBackground: hexToRgba(colors.brand.secondary, 0.12),
  chipActiveBorder: colors.brand.secondary,
  chipActiveText: colors.brand.secondary,
} as const;

export const filterOpacity = {
  disabled: 0.45,
  pressed: 0.85,
} as const;

export const filterSpacing = {
  chipGap: spacing.xs,
  rowPaddingHorizontal: spacing.lg,
  rowPaddingVertical: spacing.xs,
  sectionGap: spacing.xs,
  sectionMarginTop: spacing.sm,
  controlGap: spacing.sm,
} as const;

export const filterSizing = {
  /** Full accessible target used by standalone controls. */
  minTouchTarget: minimumTouchTarget,
  /** Visual height of dense chips; paired with `hitSlop` to stay accessible. */
  compactChipHeight: 36,
  chipPaddingHorizontal: spacing.md,
  chipPaddingVertical: spacing.sm,
  chipCompactPaddingVertical: spacing.xs,
  chipRadius: borderRadius.full,
  chipBorderWidth: 1,
  iconButtonSize: 36,
} as const;

/** Extra touch area added around compact chips to reach the minimum target. */
export const filterHitSlop = (() => {
  const missing = Math.max(0, filterSizing.minTouchTarget - filterSizing.compactChipHeight);
  const vertical = Math.ceil(missing / 2);
  return { top: vertical, bottom: vertical, left: spacing.xs, right: spacing.xs };
})();

export const filterTypography = {
  chip: typography.caption,
  sectionTitle: typography.caption,
  sectionHint: typography.caption,
  option: typography.body,
} as const;

export const defaultFilterChipTone: FilterChipTone = {
  inactiveBackgroundColor: filterColors.chipInactiveBackground,
  inactiveBorderColor: filterColors.chipInactiveBorder,
  inactiveTextColor: filterColors.chipInactiveText,
  activeBackgroundColor: filterColors.chipActiveBackground,
  activeBorderColor: filterColors.chipActiveBorder,
  activeTextColor: filterColors.chipActiveText,
};

/** Builds a chip tone from an arbitrary accent (used for taxonomy colours). */
export function createFilterChipTone(accentColor: string, onAccentColor: string): FilterChipTone {
  return {
    inactiveBackgroundColor: hexToRgba(accentColor, 0.1),
    inactiveBorderColor: hexToRgba(accentColor, 0.2),
    inactiveTextColor: accentColor,
    activeBackgroundColor: accentColor,
    activeBorderColor: accentColor,
    activeTextColor: onAccentColor,
  };
}

export const filterTokens = {
  colors: filterColors,
  opacity: filterOpacity,
  spacing: filterSpacing,
  sizing: filterSizing,
  typography: filterTypography,
  hitSlop: filterHitSlop,
  radius: borderRadius,
} as const;
