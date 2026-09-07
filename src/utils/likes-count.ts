export function likesCountAfterHeartToggle(
  currentCount: number | null | undefined,
  beforeLiked: boolean,
  afterLiked: boolean,
): number {
  const delta = Number(afterLiked) - Number(beforeLiked);
  return Math.max(0, (currentCount || 0) + delta);
}

export function withUpdatedLikeCount<T extends { id: string; likes_count?: number }>(
  events: T[],
  eventId: string,
  beforeLiked: boolean,
  afterLiked: boolean,
): T[] {
  if (beforeLiked === afterLiked) return events;
  return events.map((event) =>
    event.id === eventId
      ? { ...event, likes_count: likesCountAfterHeartToggle(event.likes_count, beforeLiked, afterLiked) }
      : event,
  );
}
