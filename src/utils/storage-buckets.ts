export const CONTEST_MEDIA_BUCKET = 'contest-media';

/** Buckets the Alpha mobile client is allowed to call. Contest storage stays in DB/console. */
export const APP_STORAGE_BUCKETS = [
  'avatar',
  'event-media',
  'bug-report-attachments',
  'account-exports',
] as const;

export function assertAppStorageBucket(bucket: string, contestsEnabled: boolean): void {
  if (bucket === CONTEST_MEDIA_BUCKET && !contestsEnabled) {
    throw new Error('Contest storage is disabled while EXPO_PUBLIC_FEATURE_CONTESTS is off.');
  }
}
