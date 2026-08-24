import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks';
import { features } from '@/config/features';
import { buildLumiaTourSteps, type LumiaTourStep } from '@/constants/lumiaTour';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import {
  getLumiaTourStatus,
  resetLumiaTour,
  setLumiaTourStatus,
} from '@/services/lumia-tour.service';
import { useLumiaTourStore } from '@/store/lumiaTourStore';

export function useLumiaTour() {
  const { user, profile, isAuthenticated } = useAuth();
  const { accountKind } = useAccountIdentity();
  const replayRequested = useLumiaTourStore((s) => s.replayRequested);
  const consumeReplay = useLumiaTourStore((s) => s.consumeReplay);
  const [visible, setVisible] = useState(false);

  const steps = useMemo(
    () =>
      buildLumiaTourSteps({
        isProfessionnel: accountKind === 'professionnel',
        eventCreate: features.eventCreate,
        socialPeers: features.socialPeers,
      }),
    [accountKind],
  );

  useEffect(() => {
    const userId = user?.id;
    if (!userId || !isAuthenticated || !profile?.onboarding_completed) {
      setVisible(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      if (replayRequested) {
        await resetLumiaTour(userId);
        consumeReplay();
        if (!cancelled) setVisible(true);
        return;
      }
      const status = await getLumiaTourStatus(userId);
      if (!cancelled) setVisible(status === 'pending');
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    consumeReplay,
    isAuthenticated,
    profile?.onboarding_completed,
    replayRequested,
    user?.id,
  ]);

  const dismiss = useCallback(
    async (reason: 'done' | 'skipped') => {
      const userId = user?.id;
      setVisible(false);
      if (userId) await setLumiaTourStatus(userId, reason);
    },
    [user?.id],
  );

  return {
    visible: visible && steps.length > 0,
    steps,
    dismiss,
  };
}

export type { LumiaTourStep };
