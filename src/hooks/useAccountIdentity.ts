import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/hooks';
import { ProfileService } from '@/services/profile.service';
import type { ActiveMode } from '@/constants/accountIdentity';
import { features } from '@/config/features';
import {
  canAccessCreateSurfaces,
  canOptInToCreation,
  getAccountKind,
  getActiveMode,
  getIdentityAccent,
  profileCanCreate,
  shouldShowModeSwitch,
} from '@/utils/accountIdentity';
import { accentForIdentity } from '@/constants/identityTheme';

export function useAccountIdentity() {
  const { profile, refreshProfile } = useAuth();
  const [savingMode, setSavingMode] = useState(false);

  /** When Diffuseur is off, treat pro accounts as B2C for mobile chrome (MVP discovery-only). */
  const accountKind = useMemo(() => {
    const kind = getAccountKind(profile);
    if (kind === 'professionnel' && !features.diffuseur) return 'particulier';
    return kind;
  }, [profile]);

  const activeMode = useMemo(() => {
    if (!features.eventCreate) return 'discover';
    return getActiveMode(profile);
  }, [profile]);

  const canCreate = useMemo(
    () => features.eventCreate && profileCanCreate(profile),
    [profile],
  );
  const canCreateNow = useMemo(
    () => features.eventCreate && canAccessCreateSurfaces(profile),
    [profile],
  );
  const showModeSwitch = useMemo(
    () => features.eventCreate && shouldShowModeSwitch(profile),
    [profile],
  );
  const accent = useMemo(() => {
    if (!features.eventCreate || !features.diffuseur) {
      return accentForIdentity(accountKind, 'discover');
    }
    return getIdentityAccent(profile);
  }, [profile, accountKind]);

  const setActiveMode = useCallback(
    async (mode: ActiveMode) => {
      if (!features.eventCreate || !profile?.id || !showModeSwitch) return false;
      if (mode === activeMode) return true;
      setSavingMode(true);
      try {
        await ProfileService.updateProfile(profile.id, { active_mode: mode });
        await refreshProfile();
        return true;
      } catch (err) {
        console.warn('Failed to update active_mode', err);
        return false;
      } finally {
        setSavingMode(false);
      }
    },
    [profile?.id, showModeSwitch, activeMode, refreshProfile],
  );

  const enableCreation = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    if (!features.eventCreate) return { ok: false, reason: 'feature_disabled' };
    if (!profile?.id) return { ok: false, reason: 'not_authenticated' };
    if (profile.can_create) return { ok: true };
    if (profile.role === 'invite') return { ok: false, reason: 'invite' };
    // Particulier product surface includes staff (admin/moderateur) testing mobile
    if (getAccountKind(profile) !== 'particulier') {
      return { ok: false, reason: 'not_particulier' };
    }
    setSavingMode(true);
    try {
      await ProfileService.updateProfile(profile.id, {
        can_create: true,
        active_mode: 'discover',
      });
      await refreshProfile();
      return { ok: true };
    } catch (err) {
      console.warn('Failed to enable creation', err);
      return {
        ok: false,
        reason: err instanceof Error ? err.message : 'update_failed',
      };
    } finally {
      setSavingMode(false);
    }
  }, [profile, refreshProfile]);

  return {
    profile,
    accountKind,
    activeMode,
    canCreate,
    canCreateNow,
    showModeSwitch,
    accent,
    savingMode,
    setActiveMode,
    enableCreation,
    canOptInToCreation: features.eventCreate && canOptInToCreation(profile),
  };
}
