import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ECLAIREUR_ENTITLEMENT,
  HABITUE_ENTITLEMENT,
  SubscriptionService,
} from '@/services/subscription.service';
import type { UserEntitlement } from '@/types/discovery.types';
import { useAuthStore } from '@/state/auth';

/**
 * Incremental offers: Éclaireur ⇒ Habitué ⇒ Local.
 * Until IAP is live, entitlements stay inactive for normal users (upsell UX).
 */
export function useOfferEntitlements() {
  const userId = useAuthStore((state) => state.user?.id);
  const [habitue, setHabitue] = useState<UserEntitlement | null>(null);
  const [eclaireur, setEclaireur] = useState<UserEntitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setHabitue(null);
      setEclaireur(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [habitueRow, eclaireurRow] = await Promise.all([
        SubscriptionService.getEntitlement(HABITUE_ENTITLEMENT).catch(() => null),
        SubscriptionService.getEntitlement(ECLAIREUR_ENTITLEMENT).catch(() => null),
      ]);
      setHabitue(habitueRow);
      setEclaireur(eclaireurRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
      setHabitue(null);
      setEclaireur(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasEclaireur = useMemo(
    () => SubscriptionService.hasEclaireur(eclaireur),
    [eclaireur],
  );
  const hasHabitue = useMemo(
    () => SubscriptionService.hasHabitue(habitue, eclaireur),
    [habitue, eclaireur],
  );

  return {
    habitue,
    eclaireur,
    /** Alias for existing premium UI (Éclaireur). */
    isPremium: hasEclaireur,
    hasHabitue,
    hasEclaireur,
    loading,
    error,
    refresh,
  };
}
