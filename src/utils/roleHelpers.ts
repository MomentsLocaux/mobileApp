import type { UserRole } from '../types/database';

export const getRoleLabel = (role: UserRole): string => {
  const roleLabels: Record<UserRole, string> = {
    denicheur: 'Dénicheur',
    createur: 'Créateur',
    moderateur: 'Modérateur',
    admin: 'Administrateur',
  };

  return roleLabels[role] || role;
};

export const getRoleBadgeColor = (role: UserRole) => {
  switch (role) {
    case 'admin':
      return {
        bg: '#FEE2E2',
        text: '#991B1B',
      };
    case 'moderateur':
      return {
        bg: '#DBEAFE',
        text: '#1E40AF',
      };
    case 'createur':
      return {
        bg: '#D1FAE5',
        text: '#065F46',
      };
    case 'denicheur':
    default:
      return {
        bg: '#FEF3C7',
        text: '#92400E',
      };
  }
};
