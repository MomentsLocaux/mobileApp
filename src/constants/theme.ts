import { brandFonts } from './fonts';

type ColorScale = Record<string | number, string>;

export { brandFonts };

/**
 * Canonical palette = website charter (docs/charte-graphique.md / globals.css).
 * Light UI: mint page, ink text, leaf accent.
 *
 * Semantic brand roles:
 * - page          → app chrome / screen fill
 * - primary       → ink (strong dark) — kept for legacy icon/text usages
 * - secondary     → leaf accent / CTA fill
 * - onAccent      → text/icons on secondary CTAs
 */
const PAGE = '#F4FBF6';
const INK = '#1A3329';
const ACCENT = '#7CB518';
const SURFACE = '#E8F5E9';
const MUTED = '#5B7A6A';
const CARD = '#FFFFFF';
const BERRY = '#E63946';
const FOREST = '#243F34';

export const colors: Record<string, ColorScale> = {
  primary: {
    0: '#F4FBF6',
    50: '#E8F5E9',
    100: '#D4EBD8',
    200: '#B5DDBB',
    300: '#8FCA98',
    400: '#6BB86F',
    500: '#7CB518',
    600: '#6A9A14',
    700: '#557C10',
    800: '#3F5C0C',
    900: '#1A3329',
  },
  secondaryAccent: {
    0: '#FFFFFF',
    50: '#FFFFFF',
    100: '#FFFFFF',
    200: '#FFFFFF',
    300: '#FFFFFF',
    400: '#FFFFFF',
    500: '#FFFFFF',
    600: '#FFFFFF',
    700: '#FFFFFF',
    800: '#FFFFFF',
    900: '#FFFFFF',
  },
  background: {
    0: PAGE,
    50: PAGE,
    100: PAGE,
    200: PAGE,
    300: PAGE,
    400: PAGE,
    500: PAGE,
    600: PAGE,
    700: PAGE,
    800: PAGE,
    900: PAGE,
  },
  textPrimary: {
    0: INK,
    50: INK,
    100: INK,
    200: INK,
    300: INK,
    400: INK,
    500: INK,
    600: INK,
    700: INK,
    800: INK,
    900: INK,
  },
  textSecondary: {
    0: MUTED,
    50: MUTED,
    100: MUTED,
    200: MUTED,
    300: MUTED,
    400: MUTED,
    500: MUTED,
    600: MUTED,
    700: MUTED,
    800: MUTED,
    900: MUTED,
  },
  secondary: {
    0: '#F4FBF6',
    50: '#E8F5E9',
    100: '#D4EBD8',
    200: '#B5DDBB',
    300: '#8FCA98',
    400: '#6BB86F',
    500: '#7CB518',
    600: '#6A9A14',
    700: '#557C10',
    800: '#3F5C0C',
    900: '#1A3329',
  },
  neutral: {
    0: CARD,
    50: PAGE,
    100: SURFACE,
    200: '#D5E6DA',
    300: '#B7CFBE',
    400: '#8AA896',
    500: MUTED,
    600: '#4A6556',
    700: FOREST,
    800: '#1E3A30',
    900: INK,
  },
  error: {
    0: '#fff2f2',
    50: '#ffe9e9',
    500: BERRY,
    700: '#c92d36',
  },
  success: {
    0: '#edfdf3',
    50: '#e5fbef',
    500: ACCENT,
    700: '#557C10',
  },
  warning: {
    0: '#fff8e8',
    50: '#fff4dc',
    500: '#f6b93b',
    700: '#ad7b1d',
  },
  info: {
    0: '#ecf4ff',
    50: '#e5f0ff',
    500: '#5f87ff',
    700: '#2f57cc',
  },
  brand: {
    /** Light app chrome / screen fill. */
    page: PAGE,
    /**
     * Strong ink. Legacy screens used `primary` as dark chrome;
     * for fills prefer `page`. Icons/text may keep using `primary`.
     */
    primary: INK,
    /** CTA / accent (leaf green). */
    secondary: ACCENT,
    /** Cards and elevated surfaces. */
    surface: CARD,
    /** Soft green wash behind cards. */
    surfaceMuted: SURFACE,
    /** Alias of ink. */
    ink: INK,
    /** Text on light surfaces. */
    text: INK,
    textSecondary: MUTED,
    /**
     * Text/icons on accent buttons.
     * Charter prefers ink on leaf for WCAG; white kept for large CTAs if needed.
     */
    onAccent: INK,
    success: ACCENT,
    error: BERRY,
    warning: '#f59e0b',
    premium: '#D4AF37',
    premiumLight: '#F0D060',
    premiumMuted: 'rgba(212, 175, 55, 0.16)',
    premiumBorder: 'rgba(212, 175, 55, 0.55)',
    /** Dark forest for rare inverted chips / phone chrome. */
    forest: FOREST,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  l: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const borderRadius = {
  sm: 16,
  md: 16,
  lg: 24,
  xl: 24,
  full: 9999,
};

export const typography = {
  h1: {
    fontFamily: brandFonts.bold,
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 38,
  },
  h2: {
    fontFamily: brandFonts.bold,
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
  },
  h3: {
    fontFamily: brandFonts.semibold,
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 30,
  },
  h4: {
    fontFamily: brandFonts.semibold,
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 26,
  },
  h5: {
    fontFamily: brandFonts.semibold,
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  h6: {
    fontFamily: brandFonts.semibold,
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  body: {
    fontFamily: brandFonts.regular,
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyBold: {
    fontFamily: brandFonts.bold,
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily: brandFonts.regular,
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodyLarge: {
    fontFamily: brandFonts.regular,
    fontSize: 18,
    fontWeight: '400' as const,
    lineHeight: 26,
  },
  label: {
    fontFamily: brandFonts.semibold,
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  caption: {
    fontFamily: brandFonts.regular,
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  subtitle: {
    fontFamily: brandFonts.medium,
    fontSize: 15,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
};

export const shadows = {
  sm: {
    shadowColor: '#1A3329',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  md: {
    shadowColor: '#1A3329',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 2,
  },
  lg: {
    shadowColor: '#1A3329',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 3,
  },
};

export const designTokens = {
  primary: ACCENT,
  secondaryAccent: CARD,
  background: PAGE,
  textPrimary: INK,
  textSecondary: MUTED,
  success: ACCENT,
} as const;

export const minimumTouchTarget = 48;
