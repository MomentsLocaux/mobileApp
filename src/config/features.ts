/**
 * Mobile feature flags — single source of truth for MVP / V1 / V2 surface gates.
 *
 * Store-ready MVP defaults (when env unset):
 * - socialPeers ON
 * - eventCreate / checkin / offers / diffuseur OFF (V1)
 * - gamification / discovery / contests OFF (V2)
 *
 * Convention:
 * - EXPO_PUBLIC_FEATURE_<NAME>=true to enable
 * - EXPO_PUBLIC_FEATURE_<NAME>=false to force off (wins over legacy aliases)
 * Restart Metro after changing any flag.
 */

/** Prefer FEATURE_* ; legacy only if FEATURE_* unset. Explicit false always wins. */
const featureOrLegacy = (
  featureValue: string | undefined,
  legacyValue: string | undefined,
): boolean => {
  if (featureValue === 'true') return true;
  if (featureValue === 'false') return false;
  return legacyValue === 'true';
};

export const features = {
  /**
   * MVP — peer social: find/follow members + “aimé par mes suivis” on events.
   * Default ON. Set EXPO_PUBLIC_FEATURE_SOCIAL_PEERS=false to hide.
   * Not creator-follow / not creator directory rankings.
   */
  socialPeers: process.env.EXPO_PUBLIC_FEATURE_SOCIAL_PEERS !== 'false',
  /** V1 — event creation, ModeSwitch, mes events, create hub */
  eventCreate: process.env.EXPO_PUBLIC_FEATURE_EVENT_CREATE === 'true',
  /** V1 — QR / geo check-in + creator QR share */
  checkin: process.env.EXPO_PUBLIC_FEATURE_CHECKIN === 'true',
  /** V1 — Nos offres / Habitué–Éclaireur paywall surfaces */
  offers: process.env.EXPO_PUBLIC_FEATURE_OFFERS === 'true',
  /** V1 — Professionnel onboarding + Diffuseur packs / analytics */
  diffuseur: process.env.EXPO_PUBLIC_FEATURE_DIFFUSEUR === 'true',
  /** V2 — Lumo wallet, shop, missions, pass */
  gamification: featureOrLegacy(
    process.env.EXPO_PUBLIC_FEATURE_GAMIFICATION,
    process.env.EXPO_PUBLIC_GAMIFICATION_ENABLED,
  ),
  /** V2 — Discovery Engine module */
  discovery: featureOrLegacy(
    process.env.EXPO_PUBLIC_FEATURE_DISCOVERY,
    process.env.EXPO_PUBLIC_DISCOVERY_ENABLED,
  ),
  /** V2 — background capture (requires discovery) */
  discoveryCapture: featureOrLegacy(
    process.env.EXPO_PUBLIC_FEATURE_DISCOVERY_CAPTURE,
    process.env.EXPO_PUBLIC_DISCOVERY_CAPTURE_ENABLED,
  ),
  /** V2 — contests */
  contests: process.env.EXPO_PUBLIC_FEATURE_CONTESTS === 'true',
  /**
   * Spike — Roadtrip planner (events along a planned journey).
   * Independent from the Discovery Engine: never gate on `discovery`.
   */
  roadtrip: process.env.EXPO_PUBLIC_FEATURE_ROADTRIP === 'true',
} as const;

export type FeatureFlag = keyof typeof features;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return features[flag];
}
