import { WEBSITE_CANONICAL_ORIGIN, WEBSITE_FR_ORIGIN } from '../constants/website';

const DEFAULT_SHARE_ORIGIN = WEBSITE_CANONICAL_ORIGIN;

export function getPublicShareOrigin(): string {
  const raw = process.env.EXPO_PUBLIC_APP_SHARE_URL || DEFAULT_SHARE_ORIGIN;
  return raw.replace(/\/+$/, '');
}

/** App deeplink handled by Expo Router (`app/events/[id].tsx`). */
export function getEventAppLink(eventId: string): string {
  return `moments-locaux://events/${eventId}`;
}

/** HTTPS page for calendar / web. Not a Universal Link until associated domains are live. */
export function getEventShareUrl(eventId: string): string {
  return `${WEBSITE_FR_ORIGIN}/events/${eventId}`;
}

export function getEventShareMessage(title: string, eventId: string, externalUrl?: string | null): string {
  const appLink = getEventAppLink(eventId);
  const downloadUrl = `${WEBSITE_FR_ORIGIN}/download`;
  const extra = externalUrl?.trim() && externalUrl.trim() !== appLink ? `\n${externalUrl.trim()}` : '';
  return `${title}\n${appLink}\n\nPas encore l’app ? ${downloadUrl}${extra}`;
}
