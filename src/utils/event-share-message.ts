import { WEBSITE_FR_ORIGIN } from '../constants/website';

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

/** Opening line sent with an internal event share. */
export const EVENT_SHARE_HOOK = 'Je pense que cet événement pourrait t’intéresser.';

/** Body stored in a direct message. The thread renders it as a tappable moment. */
export function internalEventShareMessage(title: string, eventId: string): string {
  const label = title.trim() || 'Un moment';
  return `${EVENT_SHARE_HOOK}\n${label}\n${getEventAppLink(eventId)}`;
}

const SHARED_EVENT_LINK = /moments-locaux:\/\/events\/([0-9a-fA-F-]{36})/;

export function parseSharedEventMessage(body: string): { eventId: string; title: string; note: string } | null {
  const match = body.match(SHARED_EVENT_LINK);
  if (!match || match.index == null) return null;
  const lines = body
    .slice(0, match.index)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines.pop();
  if (!title) return null;
  return { eventId: match[1], title, note: lines.join('\n') };
}

export function sharedEventInboxPreview(body: string | null | undefined): string | null {
  if (!body) return null;
  const shared = parseSharedEventMessage(body);
  if (!shared) return null;
  return shared.note || `Moment : ${shared.title}`;
}

export type ShareableEvent = {
  id: string;
  title: string;
  external_url?: string | null;
};
