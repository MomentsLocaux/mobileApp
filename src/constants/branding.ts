import Constants from 'expo-constants';

/** Fallback display name when an event has no creator (imported / aggregated). */
export const MOMENTS_LOCAUX_ORGANIZER_NAME = 'Moments Locaux';

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
export const MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL = require('../../assets/images/icon.png');
