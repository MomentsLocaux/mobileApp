export const SEARCH_CRITERIA_TIMEOUT_TITLE = "Trop d'événements correspondent";
export const SEARCH_CRITERIA_TIMEOUT_SUBTITLE =
  "Trop d'événements répondent à vos critères. Veuillez resserrer le lieu, les dates ou les mots-clés.";

function errorText(error: unknown): { code: string; message: string } {
  const record = error as { code?: unknown; message?: unknown } | null;
  const code = typeof record?.code === 'string' ? record.code : '';
  const message =
    (typeof record?.message === 'string' && record.message) ||
    (error instanceof Error ? error.message : '') ||
    (typeof error === 'string' ? error : '');
  return { code, message: message.toLowerCase() };
}

/** Postgres statement timeout, RPC client race, or equivalent query abort. */
export function isQueryTimeoutError(error: unknown): boolean {
  const { code, message } = errorText(error);
  return (
    code === '57014' ||
    message.includes('57014') ||
    message.includes('statement timeout') ||
    message.includes('canceling statement') ||
    message.includes('client timeout')
  );
}
