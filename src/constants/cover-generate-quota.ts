/** Max AI cover generations for a single create/edit draft (SCRUM-117). */
export const EVENT_COVER_GENERATE_MAX_TRIES = 2;

export function remainingCoverGenerations(count: number): number {
  return Math.max(0, EVENT_COVER_GENERATE_MAX_TRIES - Math.max(0, count));
}

export function canGenerateEventCover(count: number): boolean {
  return remainingCoverGenerations(count) > 0;
}
