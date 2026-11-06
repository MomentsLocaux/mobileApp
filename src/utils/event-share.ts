import { Share } from 'react-native';
import { WEBSITE_CANONICAL_ORIGIN } from '../constants/website';
import { openInAppEventShare } from './event-share-host';
import {
  getEventShareMessage,
  type ShareableEvent,
} from './event-share-message';

export {
  getAppShareMessage,
  getEventAppLink,
  getEventShareMessage,
  getEventShareUrl,
  internalEventShareMessage,
  parseSharedEventMessage,
  sharedEventInboxPreview,
} from './event-share-message';
export type { ShareableEvent } from './event-share-message';

const DEFAULT_SHARE_ORIGIN = WEBSITE_CANONICAL_ORIGIN;

export function getPublicShareOrigin(): string {
  const raw = process.env.EXPO_PUBLIC_APP_SHARE_URL || DEFAULT_SHARE_ORIGIN;
  return raw.replace(/\/+$/, '');
}

export async function shareEventExternally(event: ShareableEvent): Promise<void> {
  await Share.share({
    message: getEventShareMessage(event.title, event.id),
    title: event.title.trim() || 'Moments Locaux',
  });
}

export async function sharePublishedEvent(event: ShareableEvent): Promise<void> {
  if (openInAppEventShare(event)) return;
  await shareEventExternally(event);
}
