/**
 * Mobile feature flags — single source of truth for MVP / V1 / V2 surface gates.
 *
 * Convention: EXPO_PUBLIC_FEATURE_<NAME>=true (or =false to force off when default-on).
 * Restart Metro after changing any flag.
 */

const on = (key: string): boolean => process.env[key] === 'true';
/** Default-on MVP flags: only disable with EXPO_PUBLIC_FEATURE_<NAME>=false */
const onUnlessFalse = (key: string): boolean => process.env[key] !== 'false';

export const features = {
  /**
   * MVP — peer social: find/follow members + “aimé par mes suivis” on events.
   * Default ON. Set EXPO_PUBLIC_FEATURE_SOCIAL_PEERS=false to hide.
   * Not creator-follow / not creator directory rankings.
   */
  socialPeers: onUnlessFalse('EXPO_PUBLIC_FEATURE_SOCIAL_PEERS'),
  /** V1 — event creation, ModeSwitch, mes events, create hub */
  eventCreate: on('EXPO_PUBLIC_FEATURE_EVENT_CREATE'),
  /** V1 — QR / geo check-in + creator QR share */
  checkin: on('EXPO_PUBLIC_FEATURE_CHECKIN'),
  /** V1 — Nos offres / Habitué–Éclaireur paywall surfaces */
  offers: on('EXPO_PUBLIC_FEATURE_OFFERS'),
  /** V1 — Professionnel onboarding + Diffuseur packs / analytics */
  diffuseur: on('EXPO_PUBLIC_FEATURE_DIFFUSEUR'),
  /** V2 — Lumo wallet, shop, missions, pass */
  gamification:
    on('EXPO_PUBLIC_FEATURE_GAMIFICATION') || on('EXPO_PUBLIC_GAMIFICATION_ENABLED'),
  /** V2 — Discovery Engine module */
  discovery:
    on('EXPO_PUBLIC_FEATURE_DISCOVERY') || on('EXPO_PUBLIC_DISCOVERY_ENABLED'),
  /** V2 — background capture (requires discovery) */
  discoveryCapture:
    on('EXPO_PUBLIC_FEATURE_DISCOVERY_CAPTURE') ||
    on('EXPO_PUBLIC_DISCOVERY_CAPTURE_ENABLED'),
  /** V2 — contests */
  contests: on('EXPO_PUBLIC_FEATURE_CONTESTS'),
} as const;

export type FeatureFlag = keyof typeof features;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return features[flag];
}
