/** Public marketing site — keep in sync with moments-locaux-website routes. */
export const WEBSITE_ORIGIN = 'https://moments-locaux.com';

/** Apex 308s to www; use the canonical host so query + hash survive. */
export const WEBSITE_CANONICAL_ORIGIN = 'https://www.moments-locaux.com';

/** next-intl `localePrefix: "always"` — unprefixed `/contact` 404s. */
export const WEBSITE_FR_ORIGIN = `${WEBSITE_CANONICAL_ORIGIN}/fr`;

export const DIFFUSEUR_OFFER_URL = `${WEBSITE_FR_ORIGIN}/diffuseur`;

/** Contact form with Moments Diffuseur subject preselected. */
export const DIFFUSEUR_CONTACT_PATH = `${WEBSITE_FR_ORIGIN}/contact`;
