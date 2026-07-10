import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_PREMIUM_ENTITLEMENT,
  SubscriptionService,
} from '@/services/subscription.service';
import type { UserEntitlement } from '@/types/discovery.types';
import { useAuthStore } from '@/state/auth';

export function usePremiumEntitlement(entitlement = DEFAULT_PREMIUM_ENTITLEMENT) {
  const userId = useAuthStore((state) => state.user?.id);
  const [data, setData] = useState<UserEntitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const row = await SubscriptionService.getEntitlement(entitlement);
      setData(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [entitlement, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    entitlement: data,
    isPremium: data?.is_active === true,
    loading,
    error,
    refresh,
  };
}
