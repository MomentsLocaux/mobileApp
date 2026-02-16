export const isEventLive = (
  event: { starts_at?: string | null; ends_at?: string | null } | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (!event?.starts_at) return false;

  const startsAt = new Date(event.starts_at);
  if (Number.isNaN(startsAt.getTime())) return false;

  const endsAt = event.ends_at ? new Date(event.ends_at) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) return false;

  if (!endsAt) {
    return now >= startsAt;
  }

  return now >= startsAt && now <= endsAt;
};
