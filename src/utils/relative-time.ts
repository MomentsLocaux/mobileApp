const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

const plural = (count: number, singular: string, pluralForm: string) =>
  count === 1 ? singular : pluralForm;

/** French relative time, Airbnb-style (« Il y a 2 semaines »). */
export function formatTimeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Math.max(0, now.getTime() - then);

  if (diff < MINUTE_MS) return 'À l’instant';
  if (diff < HOUR_MS) {
    const count = Math.max(1, Math.round(diff / MINUTE_MS));
    return `Il y a ${count} ${plural(count, 'minute', 'minutes')}`;
  }
  if (diff < DAY_MS) {
    const count = Math.max(1, Math.round(diff / HOUR_MS));
    return `Il y a ${count} ${plural(count, 'heure', 'heures')}`;
  }
  if (diff < WEEK_MS) {
    const count = Math.max(1, Math.round(diff / DAY_MS));
    return `Il y a ${count} ${plural(count, 'jour', 'jours')}`;
  }
  if (diff < MONTH_MS) {
    const count = Math.max(1, Math.round(diff / WEEK_MS));
    return `Il y a ${count} ${plural(count, 'semaine', 'semaines')}`;
  }
  if (diff < YEAR_MS) {
    const count = Math.max(1, Math.round(diff / MONTH_MS));
    return `Il y a ${count} mois`;
  }
  const count = Math.max(1, Math.round(diff / YEAR_MS));
  return `Il y a ${count} ${plural(count, 'an', 'ans')}`;
}

export function formatEchoesCountLabel(count: number): string {
  if (count <= 0) return 'Afficher les commentaires';
  if (count === 1) return 'Afficher le commentaire';
  return `Afficher les ${count} commentaires`;
}

export function formatEchoesListTitle(count: number): string {
  if (count <= 0) return 'Commentaires';
  if (count === 1) return '1 commentaire';
  return `${count} commentaires`;
}

export function formatAuthorHomeLocation(
  city?: string | null,
  region?: string | null,
): string | null {
  const label = [city?.trim(), region?.trim()].filter(Boolean).join(', ');
  return label || null;
}
