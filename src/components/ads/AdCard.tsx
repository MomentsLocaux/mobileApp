import React, { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { features } from '@/config/features';
import { useAdFreeEntitlement } from '@/hooks/useAdFreeEntitlement';

type NativeCard = ComponentType<{ slotId: string; inset?: boolean }>;

/**
 * Renders nothing while ads are off, refused, or covered by Habitué / Éclaireur.
 * The native module is loaded only when a card is actually allowed.
 */
export function AdCard({ slotId, inset = false }: { slotId: string; inset?: boolean }) {
  const adFree = useAdFreeEntitlement();
  const [NativeImpl, setNativeImpl] = useState<NativeCard | null>(null);

  useEffect(() => {
    if (!features.ads || adFree) {
      if (__DEV__) console.warn('[ads] carte ignorée', slotId, { flag: features.ads, adFree });
      return;
    }
    try {
      // Release Hermes does not resolve import() for this native module.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('./AdCardNative') as typeof import('./AdCardNative');
      setNativeImpl(() => mod.AdCardNative);
      if (__DEV__) console.warn('[ads] module chargé', slotId);
    } catch (error) {
      setNativeImpl(null);
      if (__DEV__) console.warn('[ads] module absent', slotId, error);
    }
  }, [adFree, slotId]);

  if (!features.ads || adFree || !NativeImpl) return null;
  return <NativeImpl slotId={slotId} inset={inset} />;
}
