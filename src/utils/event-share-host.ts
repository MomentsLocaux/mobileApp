import type { ShareableEvent } from './event-share-message';

type Opener = (event: ShareableEvent) => void;

const openers: Opener[] = [];

/** Last registered opener wins. The focused screen unregisters on blur. */
export function registerEventShareOpener(next: Opener): () => void {
  openers.push(next);
  return () => {
    const index = openers.lastIndexOf(next);
    if (index >= 0) openers.splice(index, 1);
  };
}

export function openInAppEventShare(event: ShareableEvent): boolean {
  const opener = openers[openers.length - 1];
  if (!opener) return false;
  opener(event);
  return true;
}
