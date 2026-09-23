/** PostgREST / Postgres errors when a column, table or RPC is not deployed yet. */

export function isMissingSchemaError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  const code = String(err?.code || '');
  const message = String(err?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === '42703' ||
    code === '42883' ||
    code === 'PGRST202' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find the')
  );
}
