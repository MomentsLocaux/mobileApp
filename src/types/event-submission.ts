/** Persisted on events.submission_source — how the row entered the system. */
export const EVENT_SUBMISSION_SOURCES = ['organizer_create', 'community_suggest'] as const;

export type EventSubmissionSource = (typeof EVENT_SUBMISSION_SOURCES)[number];

export function isEventSubmissionSource(value: unknown): value is EventSubmissionSource {
  return (
    typeof value === 'string' &&
    (EVENT_SUBMISSION_SOURCES as readonly string[]).includes(value)
  );
}

export function labelForSubmissionSource(source?: EventSubmissionSource | null): string {
  if (source === 'community_suggest') return 'Proposé';
  return 'Organisé';
}
