const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A storage path may be deleted with the account only when it sits in that
 * account's folder. A profile URL is not enough: it can point at someone else.
 */
export function isOwnedAccountStoragePath(bucket: string, path: string, userId: string): boolean {
  if (!userId || !UUID_RE.test(userId)) return false;
  if (!path || path.includes('\\') || path.includes('..')) return false;
  const parts = path.split('/').filter((part) => part.length > 0);
  if (parts.length !== path.split('/').length || parts.some((part) => part === '.' || part === '..')) {
    return false;
  }

  if (bucket === 'avatar') {
    return (
      (parts[0] === 'avatars' || parts[0] === 'profile-covers') &&
      parts[1] === userId &&
      parts.length >= 3
    );
  }

  if (bucket === 'event-media') {
    if (parts[0] === 'category-defaults') return false;
    if ((parts[0] === 'event-covers' || parts[0] === 'gallery') && parts[1] === userId && parts.length >= 3) {
      return true;
    }
    return parts[0] === 'contrib' && UUID_RE.test(parts[1] ?? '') && parts[2] === userId && parts.length >= 4;
  }

  if (bucket === 'account-exports' || bucket === 'bug-report-attachments') {
    return parts[0] === userId && parts.length >= 2;
  }

  return false;
}
