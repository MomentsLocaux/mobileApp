import type { TextStyle } from 'react-native';

export const typography = {
  displayLarge: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  subsection: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  h1: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
  h2: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  h3: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
  },
  h4: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
  },
  h5: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  h6: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  bodyBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  bodyLarge: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '400',
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  small: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
