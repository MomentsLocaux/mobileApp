type ColorScale = Record<string | number, string>;

export const colors: Record<string, ColorScale> = {
  primary: {
    0: '#e4faff',
    50: '#cef4ff',
    100: '#afeafe',
    200: '#8addf2',
    300: '#63d0ea',
    400: '#45c6e5',
    500: '#2bbfe3',
    600: '#24a6c6',
    700: '#1d8ca7',
    800: '#176f85',
    900: '#115767',
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
    0: '#0f1719',
    50: '#0f1719',
    100: '#0f1719',
    200: '#0f1719',
    300: '#0f1719',
    400: '#0f1719',
    500: '#0f1719',
    600: '#0f1719',
    700: '#0f1719',
    800: '#0f1719',
    900: '#0f1719',
  },
  textPrimary: {
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
  textSecondary: {
    0: '#94a3b8',
    50: '#94a3b8',
    100: '#94a3b8',
    200: '#94a3b8',
    300: '#94a3b8',
    400: '#94a3b8',
    500: '#94a3b8',
    600: '#94a3b8',
    700: '#94a3b8',
    800: '#94a3b8',
    900: '#94a3b8',
  },
  secondary: {
    0: '#edf1ff',
    50: '#e5ebff',
    100: '#cfdafd',
    200: '#b8c9fb',
    300: '#9bb1f7',
    400: '#7f97f1',
    500: '#6380ea',
    600: '#2a4fe3',
    700: '#2341ba',
    800: '#1d3492',
    900: '#172871',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#0f1719',
    100: '#1a2426',
    200: '#243133',
    300: '#334346',
    400: '#53646a',
    500: '#6b7c85',
    600: '#94a3b8',
    700: '#b7c3cf',
    800: '#d4dde6',
    900: '#FFFFFF',
  },
  error: {
    0: '#3b1a1f',
    50: '#4a1f25',
    500: '#ff5a66',
    700: '#ff8991',
  },
  success: {
    0: '#153022',
    50: '#1d3c2b',
    500: '#34C759',
    700: '#74d993',
  },
  warning: {
    0: '#3b2c11',
    50: '#4a3816',
    500: '#f6b93b',
    700: '#f5cf83',
  },
  info: {
    0: '#132334',
    50: '#1a2d42',
    500: '#5f87ff',
    700: '#9ab3ff',
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
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 38,
  },
  h2: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 30,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 26,
  },
  h5: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  h6: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodyLarge: {
    fontSize: 18,
    fontWeight: '400' as const,
    lineHeight: 26,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
};

export const designTokens = {
  primary: '#2bbfe3',
  secondaryAccent: '#FFFFFF',
  background: '#0f1719',
  textPrimary: '#FFFFFF',
  textSecondary: '#94a3b8',
  success: '#34C759',
} as const;

export const minimumTouchTarget = 48;
