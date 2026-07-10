import { useCallback, useEffect, useState } from 'react';
import { DiscoveryConsentService } from '@/services/discovery/discovery-consent.service';
import type { DiscoveryConsent } from '@/types/discovery.types';
import { useAuthStore } from '@/state/auth';

export function useDiscoveryConsent() {
  const userId = useAuthStore((state) => state.user?.id);
  const [consent, setConsent] = useState<DiscoveryConsent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setConsent(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const row = await DiscoveryConsentService.getMine();
      setConsent(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
      setConsent(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activate = useCallback(async () => {
    const row = await DiscoveryConsentService.activatePersonalization();
    setConsent(row);
    return row;
  }, []);

  const revoke = useCallback(async () => {
    const row = await DiscoveryConsentService.revoke();
    setConsent(row);
    return row;
  }, []);

  const purge = useCallback(async () => {
    await DiscoveryConsentService.purgeMine();
    await refresh();
  }, [refresh]);

  const isEnabled = consent?.enabled === true && consent.personalization_enabled === true;

  return {
    consent,
    loading,
    error,
    isEnabled,
    refresh,
    activate,
    revoke,
    purge,
  };
}
