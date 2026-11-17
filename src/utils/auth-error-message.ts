export function localizeSignInError(error: unknown, fallback = 'Connexion impossible'): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const message = raw.toLowerCase();
  if (code === 'invalid_credentials' || message.includes('invalid login credential')) {
    return 'Email ou mot de passe incorrect';
  }
  return raw.trim() || fallback;
}
