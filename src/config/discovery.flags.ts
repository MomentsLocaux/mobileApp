import { features } from '@/config/features';

/** Discovery Engine (V2). Prefer EXPO_PUBLIC_FEATURE_DISCOVERY. */
export const DISCOVERY_ENABLED = features.discovery;

/** Background capture — requires discovery. Prefer EXPO_PUBLIC_FEATURE_DISCOVERY_CAPTURE. */
export const DISCOVERY_CAPTURE_ENABLED = features.discoveryCapture;
