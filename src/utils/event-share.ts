import { WEBSITE_ORIGIN } from '../constants/website';

const DEFAULT_SHARE_ORIGIN = WEBSITE_ORIGIN;

export function getPublicShareOrigin(): string {
  const raw = process.env.EXPO_PUBLIC_APP_SHARE_URL || DEFAULT_SHARE_ORIGIN;
  return raw.replace(/\/+$/, '');
}

export function getEventShareUrl(eventId: string): string {
  return `${getPublicShareOrigin()}/events/${eventId}`;
}

export function getEventShareMessage(title: string, eventId: string, externalUrl?: string | null): string {
  const shareUrl = getEventShareUrl(eventId);
  const extra = externalUrl?.trim() && externalUrl.trim() !== shareUrl ? `\n${externalUrl.trim()}` : '';
  return `${title}\n${shareUrl}${extra}`;
}
