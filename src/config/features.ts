/**
 * Mobile feature flags — single source of truth for MVP / V1 / V2 surface gates.
 *
 * Convention: EXPO_PUBLIC_FEATURE_<NAME>=true
 * Default: all post-MVP flags false (code stays, nav + deep links hidden).
 *
 * Legacy env aliases remain accepted for Discovery / Gamification / Contests.
 * Restart Metro after changing any flag.
 */

const on = (key: string): boolean => process.env[key] === 'true';

export const features = {
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
