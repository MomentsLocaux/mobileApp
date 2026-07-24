import type { UserRole } from '../types/database';

export const getRoleLabel = (role: UserRole): string => {
  const roleLabels: Record<UserRole, string> = {
    invite: 'Invité',
    particulier: 'Découvreur',
    professionnel: 'Organisateur',
    institutionnel: 'Structure',
    moderateur: 'Modérateur',
    admin: 'Administrateur',
  };

  return roleLabels[role] || role;
};

/**
 * Dark-UI badge palette (semi-transparent tinted bg + light text + subtle border):
 * particulier → cyan brand, professionnel → émeraude, institutionnel → indigo,
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
      return {
        bg: 'rgba(16, 185, 129, 0.16)',
        text: '#6EE7B7',
        border: 'rgba(16, 185, 129, 0.35)',
      };
    case 'institutionnel':
      return {
        bg: 'rgba(129, 140, 248, 0.16)',
        text: '#A5B4FC',
        border: 'rgba(129, 140, 248, 0.35)',
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
        bg: 'rgba(43, 191, 227, 0.16)',
        text: '#7DD8F0',
        border: 'rgba(43, 191, 227, 0.35)',
      };
  }
};
