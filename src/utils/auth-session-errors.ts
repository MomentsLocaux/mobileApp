type AuthFailure = { message?: string; code?: string } | null | undefined;

/**
 * Refresh-token rotation or revocation. A network failure must not match:
 * the Keychain copy stays so the next launch can try again.
 */
export function isRevokedRefreshToken(error: AuthFailure): boolean {
  if (!error) return false;
  const code = String(error.code || '').toLowerCase();
  const message = String(error.message || '').toLowerCase();
  return (
    code === 'refresh_token_not_found' ||
    code === 'refresh_token_already_used' ||
    code === 'session_not_found' ||
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('already been used') ||
    message.includes('session from session_id claim in jwt does not exist')
  );
}
