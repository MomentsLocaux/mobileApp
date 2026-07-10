/** Discovery module feature flags — default off until Phase B rollout. */
export const DISCOVERY_ENABLED = process.env.EXPO_PUBLIC_DISCOVERY_ENABLED === 'true';

export const DISCOVERY_CAPTURE_ENABLED =
  process.env.EXPO_PUBLIC_DISCOVERY_CAPTURE_ENABLED === 'true';
