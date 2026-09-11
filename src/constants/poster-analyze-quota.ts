/** Max AI poster analyses for a single suggestion/create draft. */
export const EVENT_POSTER_ANALYZE_MAX_TRIES = 2;

/** Monthly poster analyses per user (UTC), aligned with EVENT_SUGGEST_MONTHLY_QUOTA. */
export const EVENT_SUGGEST_MONTHLY_QUOTA = 20;

export function remainingPosterAnalyses(count: number): number {
  return Math.max(0, EVENT_POSTER_ANALYZE_MAX_TRIES - Math.max(0, count));
}

export function canAnalyzePoster(count: number): boolean {
  return remainingPosterAnalyses(count) > 0;
}

export function posterAnalyzeQuotaHint(count: number): string {
  const remaining = remainingPosterAnalyses(count);
  if (remaining === 0) {
    return `Limite atteinte : ${EVENT_POSTER_ANALYZE_MAX_TRIES} analyses pour cette suggestion. Saisissez manuellement.`;
  }
  if (remaining === 1) {
    return `Dernière analyse pour cette suggestion (${EVENT_POSTER_ANALYZE_MAX_TRIES} max).`;
  }
  return `Limite : ${EVENT_POSTER_ANALYZE_MAX_TRIES} analyses par suggestion, ${EVENT_SUGGEST_MONTHLY_QUOTA} par mois.`;
}
