/**
 * Habitué / Lumo surfaces.
 * Default off until product enables EXPO_PUBLIC_GAMIFICATION_ENABLED (+ server app_config).
 * Server truth: app_config.gamification_enabled (see is_gamification_enabled()).
 */
export const GAMIFICATION_ENABLED = process.env.EXPO_PUBLIC_GAMIFICATION_ENABLED === 'true';
