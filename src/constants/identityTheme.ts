import type { ActiveMode, AccountKind } from '@/constants/accountIdentity';

/** ADR_007 dedicated accents — not full theme swap yet. */
export const identityAccents = {
  discover: {
    key: 'discover' as const,
    label: 'Découvreur',
    accent: '#2bbfe3',
    accentMuted: 'rgba(43, 191, 227, 0.16)',
    accentBorder: 'rgba(43, 191, 227, 0.45)',
  },
  create: {
    key: 'create' as const,
    label: 'Créateur',
    accent: '#f59e0b',
    accentMuted: 'rgba(245, 158, 11, 0.16)',
    accentBorder: 'rgba(245, 158, 11, 0.45)',
  },
  professionnel: {
    key: 'professionnel' as const,
    label: 'Professionnel',
    accent: '#10b981',
    accentMuted: 'rgba(16, 185, 129, 0.16)',
    accentBorder: 'rgba(16, 185, 129, 0.45)',
  },
} as const;

export type IdentityAccent = (typeof identityAccents)[keyof typeof identityAccents];

export function accentForIdentity(
  kind: AccountKind,
  mode: ActiveMode,
): IdentityAccent {
  if (kind === 'professionnel') return identityAccents.professionnel;
  return mode === 'create' ? identityAccents.create : identityAccents.discover;
}
