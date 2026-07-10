const REASON_LABELS: Record<string, string> = {
  nearby: 'Proche de vous',
  category_match: 'Correspond à vos goûts',
  time_match: 'Dans votre créneau habituel',
  new_area: 'Nouvelle zone à explorer',
  weekend_fit: 'Adapté au week-end',
  starting_soon: 'Commence bientôt',
  past_interest: 'Vous vous êtes déjà intéressé à ce type d’événement',
};

export function formatReasonCodes(codes: string[]): string[] {
  if (!codes.length) {
    return ['Suggestion basée sur votre localisation et vos interactions récentes.'];
  }
  return codes.map((code) => REASON_LABELS[code] ?? code.replaceAll('_', ' '));
}
