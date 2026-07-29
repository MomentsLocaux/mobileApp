import { features } from '@/config/features';

/**
 * Habitué / Lumo surfaces (V2).
 * Prefer `features.gamification` / EXPO_PUBLIC_FEATURE_GAMIFICATION.
 * Legacy: EXPO_PUBLIC_GAMIFICATION_ENABLED.
 * Server truth: app_config.gamification_enabled (see is_gamification_enabled()).
 */
export const GAMIFICATION_ENABLED = features.gamification;
