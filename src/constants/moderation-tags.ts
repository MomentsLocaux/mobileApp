/** Owner-visible tag when a moderator asks for a resubmit (SCRUM-119). */
export const NEEDS_CHANGES_TAG = 'needs_changes';

export function hasNeedsChangesTag(tags?: string[] | null): boolean {
  return Array.isArray(tags) && tags.includes(NEEDS_CHANGES_TAG);
}

export function withoutNeedsChangesTag(tags?: string[] | null): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag) => tag !== NEEDS_CHANGES_TAG);
}
