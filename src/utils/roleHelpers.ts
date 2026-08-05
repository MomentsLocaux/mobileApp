import type { UserRole, Profile } from '../types/database';
import { formatAccountBadge, getAccountKind, getProSubtypeLabel } from './accountIdentity';

export const getRoleLabel = (role: UserRole): string => {
  const roleLabels: Record<UserRole, string> = {
    invite: 'Invité',
    particulier: 'Particulier',
    professionnel: 'Professionnel',
    /** Legacy — prefer formatAccountBadge / pro_subtype in UI. */
    institutionnel: 'Professionnel',
    moderateur: 'Modérateur',
    admin: 'Administrateur',
  };

  return roleLabels[role] || role;
};

/** Public-facing identity label (ADR_007). */
export const getProfileIdentityLabel = (
  profile: Pick<Profile, 'role' | 'pro_subtype' | 'can_create'> | null | undefined,
): string => {
  if (!profile) return 'Particulier';
  if (profile.role === 'invite') return 'Invité';
  if (profile.role === 'admin' || profile.role === 'moderateur') {
    return getRoleLabel(profile.role);
  }
  return formatAccountBadge(profile);
};

/**
 * Dark-UI badge palette (semi-transparent tinted bg + light text + subtle border):
 * particulier → cyan brand, professionnel (+ legacy institutionnel) → émeraude,
 * moderateur → bleu, admin → rouge, invite → neutre ardoise.
 */
export const getRoleBadgeColor = (role: UserRole) => {
  switch (role) {
    case 'admin':
      return {
        bg: 'rgba(239, 68, 68, 0.16)',
        text: '#FCA5A5',
        border: 'rgba(239, 68, 68, 0.35)',
      };
    case 'moderateur':
      return {
        bg: 'rgba(59, 130, 246, 0.16)',
        text: '#93C5FD',
        border: 'rgba(59, 130, 246, 0.35)',
      };
    case 'professionnel':
    case 'institutionnel':
      return {
        bg: 'rgba(16, 185, 129, 0.16)',
        text: '#6EE7B7',
        border: 'rgba(16, 185, 129, 0.35)',
      };
    case 'invite':
      return {
        bg: 'rgba(148, 163, 184, 0.14)',
        text: '#CBD5E1',
        border: 'rgba(148, 163, 184, 0.3)',
      };
    case 'particulier':
    default:
      return {
        bg: 'rgba(124, 181, 24, 0.16)',
        text: '#7DD8F0',
        border: 'rgba(124, 181, 24, 0.35)',
      };
  }
};

export { getAccountKind, getProSubtypeLabel };
