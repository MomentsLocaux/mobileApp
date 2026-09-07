import Constants from 'expo-constants';

/** Fallback display name when an event has no creator (imported / aggregated). */
export const MOMENTS_LOCAUX_ORGANIZER_NAME = 'Moments Locaux';

/** True when the fiche shows the platform name instead of a real organizer. */
export function isMomentsLocauxOrganizerFallback(
  creator?: { display_name?: string | null } | null,
): boolean {
  const name = creator?.display_name?.trim();
  if (!name) return true;
  return name.toLowerCase() === MOMENTS_LOCAUX_ORGANIZER_NAME.toLowerCase();
}

const supabaseUrl =
  (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';

/** Public Storage path for the platform organizer avatar (seeded in Supabase Storage). */
export const MOMENTS_LOCAUX_ORGANIZER_AVATAR_PATH = 'branding/moments-locaux-organizer.png';

export const MOMENTS_LOCAUX_ORGANIZER_AVATAR_URL = supabaseUrl
  ? `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/avatar/${MOMENTS_LOCAUX_ORGANIZER_AVATAR_PATH}`
  : null;

/** Local asset fallback if remote branding avatar is unavailable. */
export const MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL = require('../../assets/images/logo-mark.png');
