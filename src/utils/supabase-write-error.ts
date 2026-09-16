/** Map known Postgres/PostgREST write failures to a short user-facing sentence. */
export function mapSupabaseWriteError(error: unknown): string | null {
  const record = error as { code?: unknown; message?: unknown } | null;
  const code = typeof record?.code === 'string' ? record.code : '';
  const message =
    (typeof record?.message === 'string' && record.message) ||
    (typeof error === 'string' ? error : '') ||
    (error instanceof Error ? error.message : '');
  const combined = `${code} ${message}`;

  if (combined.includes('RATE_LIMIT_EXCEEDED')) {
    return 'Trop de requêtes. Réessaie dans une minute.';
  }
  if (combined.includes('UGC_TOO_LONG')) {
    return 'Texte trop long. Raccourcis-le puis réessaie.';
  }
  if (code === '54000' || message.includes('null character not permitted')) {
    return "Impossible d'envoyer ce texte pour le moment.";
  }
  if (message.includes('<!DOCTYPE') || message.includes('Cloudflare')) {
    return 'Supabase ne répond pas (timeout). Réessayez dans quelques instants.';
  }
  return null;
}
