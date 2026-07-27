import type { Profile, UserRole } from '@/types/database';
import type { AccountKind, ActiveMode, ProSubtype } from '@/constants/accountIdentity';
import { PRO_SUBTYPE_LABELS } from '@/constants/accountIdentity';
import { accentForIdentity, type IdentityAccent } from '@/constants/identityTheme';

/** Product audience — never treat institutionnel as a top-level kind. */
export function getAccountKind(profile: Pick<Profile, 'role'> | null | undefined): AccountKind {
  if (!profile) return 'particulier';
  if (profile.role === 'professionnel' || profile.role === 'institutionnel') {
    return 'professionnel';
  }
  return 'particulier';
}

/** Roles that may opt into B2C creation (Découvreur + créateur). */
export function canOptInToCreation(
  profile: Pick<Profile, 'role' | 'can_create'> | null | undefined,
): boolean {
  if (!profile) return false;
  if (getAccountKind(profile) !== 'particulier') return false;
  if (profile.role === 'invite') return false;
  return !Boolean(profile.can_create);
}

export function profileCanCreate(
  profile: Pick<Profile, 'role' | 'can_create'> | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.role === 'professionnel' || profile.role === 'institutionnel') return true;
  return Boolean(profile.can_create);
}

export function getActiveMode(
  profile: Pick<Profile, 'role' | 'can_create' | 'active_mode'> | null | undefined,
): ActiveMode {
  if (!profile) return 'discover';
  if (profile.role === 'professionnel' || profile.role === 'institutionnel') return 'create';
  if (!profile.can_create) return 'discover';
  return profile.active_mode === 'create' ? 'create' : 'discover';
}

/** Create FAB / routes — capability + B2C mode create (ADR_007). */
export function canAccessCreateSurfaces(
  profile: Pick<Profile, 'role' | 'can_create' | 'active_mode'> | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.role === 'professionnel' || profile.role === 'institutionnel') return true;
  if (!profile.can_create) return false;
  return getActiveMode(profile) === 'create';
}

export function shouldShowModeSwitch(
  profile: Pick<Profile, 'role' | 'can_create'> | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.role === 'professionnel' || profile.role === 'institutionnel') return false;
  return Boolean(profile.can_create);
}

export function getIdentityAccent(
  profile: Pick<Profile, 'role' | 'can_create' | 'active_mode'> | null | undefined,
): IdentityAccent {
  return accentForIdentity(getAccountKind(profile), getActiveMode(profile));
}

/** Persistable role for onboarding — never write institutionnel. */
export function roleForAccountKind(kind: AccountKind): Extract<UserRole, 'particulier' | 'professionnel'> {
  return kind === 'professionnel' ? 'professionnel' : 'particulier';
}

export function getProSubtypeLabel(subtype: ProSubtype | null | undefined): string | null {
  if (!subtype) return null;
  return PRO_SUBTYPE_LABELS[subtype] ?? subtype;
}

export function formatAccountBadge(
  profile: Pick<Profile, 'role' | 'pro_subtype' | 'can_create'> | null | undefined,
): string {
  const kind = getAccountKind(profile);
  if (kind === 'professionnel') {
    const sub = getProSubtypeLabel(profile?.pro_subtype ?? undefined);
    return sub ? `Professionnel · ${sub}` : 'Professionnel';
  }
  return profile?.can_create ? 'Particulier · Découvreur & créateur' : 'Particulier';
}
