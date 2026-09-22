import { colors } from './theme';

/** Shallow, static depth for the light Moments Locaux charter. */
export const relief = {
  border: colors.neutral[200],
  edge: colors.primary[200],
  shine: 'rgba(255, 255, 255, 0.72)',
  shadow: {
    shadowColor: colors.brand.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
};
