import type { UserRole } from '../types/database';

export const getRoleLabel = (role: UserRole): string => {
  const roleLabels: Record<UserRole, string> = {
    invite: 'Invité',
    particulier: 'Particulier',
    professionnel: 'Professionnel',
    institutionnel: 'Institutionnel',
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
    case 'professionnel':
      return {
        bg: '#D1FAE5',
        text: '#065F46',
      };
    case 'institutionnel':
      return {
        bg: '#E0E7FF',
        text: '#3730A3',
      };
    case 'invite':
      return {
        bg: '#E2E8F0',
        text: '#475569',
      };
    case 'particulier':
    default:
      return {
        bg: '#FEF3C7',
        text: '#92400E',
      };
  }
};
