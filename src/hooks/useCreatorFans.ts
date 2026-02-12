import { useCallback, useEffect, useState } from 'react';
import { getTopFans } from '@/services/creatorFans.service';
import type { CreatorFan } from '@/types/creator.types';

export function useCreatorFans(creatorId?: string | null, limit = 20) {
  const [fans, setFans] = useState<CreatorFan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFans = useCallback(async () => {
    if (!creatorId) {
      setFans([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getTopFans(creatorId, limit);
      setFans(data);
    } catch (err: any) {
      setFans([]);
      setError(err?.message || 'Impossible de charger la communauté');
    } finally {
      setLoading(false);
    }
  }, [creatorId, limit]);

  useEffect(() => {
    loadFans().catch(() => undefined);
  }, [loadFans]);

  return {
    fans,
    loading,
    error,
    refresh: loadFans,
  };
}
