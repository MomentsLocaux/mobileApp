import type { ShareableEvent } from './event-share-message';

type Opener = (event: ShareableEvent) => void;

let opener: Opener | null = null;

export function registerEventShareOpener(next: Opener | null) {
  opener = next;
}

export function openInAppEventShare(event: ShareableEvent): boolean {
  if (!opener) return false;
  opener(event);
  return true;
}
