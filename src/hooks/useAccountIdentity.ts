import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/hooks';
import { ProfileService } from '@/services/profile.service';
import type { ActiveMode } from '@/constants/accountIdentity';
import {
  canAccessCreateSurfaces,
  canOptInToCreation,
  getAccountKind,
  getActiveMode,
  getIdentityAccent,
  profileCanCreate,
  shouldShowModeSwitch,
} from '@/utils/accountIdentity';

export function useAccountIdentity() {
  const { profile, refreshProfile } = useAuth();
  const [savingMode, setSavingMode] = useState(false);

  const accountKind = useMemo(() => getAccountKind(profile), [profile]);
  const activeMode = useMemo(() => getActiveMode(profile), [profile]);
  const canCreate = useMemo(() => profileCanCreate(profile), [profile]);
  const canCreateNow = useMemo(() => canAccessCreateSurfaces(profile), [profile]);
  const showModeSwitch = useMemo(() => shouldShowModeSwitch(profile), [profile]);
  const accent = useMemo(() => getIdentityAccent(profile), [profile]);

  const setActiveMode = useCallback(
    async (mode: ActiveMode) => {
      if (!profile?.id || !showModeSwitch) return false;
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
    canOptInToCreation: canOptInToCreation(profile),
  };
}
