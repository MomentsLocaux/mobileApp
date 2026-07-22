/**
 * Habitué / Lumo surfaces. Default off until MVP-LUMO-011 UX + backend caps are live.
 * Server truth: app_config.gamification_enabled (see is_gamification_enabled()).
 */
export const GAMIFICATION_ENABLED = process.env.EXPO_PUBLIC_GAMIFICATION_ENABLED === 'true';
