import { useEffect, useState } from 'react';
import { features } from '@/config/features';
import {
  ECLAIREUR_ENTITLEMENT,
  HABITUE_ENTITLEMENT,
  SubscriptionService,
} from '@/services/subscription.service';
import { useAuthStore } from '@/state/auth';

type EntitlementRead = { confirmed: boolean; adFree: boolean };

let entitlementCache: { userId: string; promise: Promise<EntitlementRead> } | null = null;

async function readEntitlement(userId: string): Promise<EntitlementRead> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const [habitue, eclaireur] = await Promise.all([
        SubscriptionService.getEntitlement(HABITUE_ENTITLEMENT),
        SubscriptionService.getEntitlement(ECLAIREUR_ENTITLEMENT),
      ]);
      const adFree = SubscriptionService.hasHabitue(habitue, eclaireur);
      if (__DEV__) console.warn('[ads] abonnement', { adFree, attempt });
      return { confirmed: true, adFree };
    } catch (error) {
      if (__DEV__) console.warn('[ads] abonnement illisible', { attempt, error });
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  return { confirmed: false, adFree: false };
}

function loadAdFree(userId: string | null): Promise<boolean> {
  if (!features.ads) return Promise.resolve(true);
  if (!userId) return Promise.resolve(false);
  if (entitlementCache?.userId === userId) return entitlementCache.promise.then((read) => read.adFree);

  const promise = readEntitlement(userId);
  entitlementCache = { userId, promise };
  return promise.then((read) => {
    if (!read.confirmed && entitlementCache?.promise === promise) entitlementCache = null;
    return read.adFree;
  });
}

/** True when ads must stay hidden: flag off, subscription active, or entitlement still unknown. */
export function useAdFreeEntitlement(): boolean {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [adFree, setAdFree] = useState(() => !features.ads || Boolean(userId));

  useEffect(() => {
    let cancelled = false;
    if (features.ads && userId) setAdFree(true);
    void loadAdFree(userId).then((value) => {
      if (!cancelled) setAdFree(value);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return !features.ads || adFree;
}
