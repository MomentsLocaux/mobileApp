import { useEffect, useRef, useState } from 'react';
import {
  VIEWPORT_COUNT_FIRST_SETTLE_MS,
  VIEWPORT_COUNT_UPDATE_MS,
  MAP_WAITING_MESSAGE,
} from '@/utils/map-peek-label';

type PeekPhase = 'waiting' | 'ready';

/**
 * Peek / filters-button count presentation:
 *
 * 1. Before any count is validated → show a single waiting message (same text slot
 *    as the final label). First commit waits long enough to absorb chained fetches.
 * 2. After a count is validated → never return to the waiting message. Keep the
 *    last committed count while refetches run; swap the number only after a short
 *    quiet window on the latest value.
 */
export function useSettledViewportPeek(
  count: number,
  isLoading: boolean,
  waitingMessage = MAP_WAITING_MESSAGE
) {
  const [phase, setPhase] = useState<PeekPhase>(() => (isLoading ? 'waiting' : 'ready'));
  const [stableCount, setStableCount] = useState(count);
  const hasValidatedRef = useRef(!isLoading);
  const pendingCountRef = useRef(count);
  const stableCountRef = useRef(count);

  useEffect(() => {
    pendingCountRef.current = count;

    // Cold path only: stay on the waiting message until the first commit.
    if (isLoading && !hasValidatedRef.current) {
      setPhase('waiting');
      return;
    }

    // Already validated: ignore loading flips — keep showing the last committed count.
    if (isLoading && hasValidatedRef.current) {
      return;
    }

    // Same committed value — nothing to do.
    if (hasValidatedRef.current && count === stableCountRef.current) {
      setPhase('ready');
      return;
    }

    // Not loading: commit `count` after a quiet window (longer before first reveal).
    const settleMs = hasValidatedRef.current
      ? VIEWPORT_COUNT_UPDATE_MS
      : VIEWPORT_COUNT_FIRST_SETTLE_MS;

    const timer = setTimeout(() => {
      const next = pendingCountRef.current;
      stableCountRef.current = next;
      setStableCount(next);
      hasValidatedRef.current = true;
      setPhase('ready');
    }, settleMs);

    return () => clearTimeout(timer);
  }, [count, isLoading]);

  return {
    showWaiting: phase === 'waiting',
    displayCount: stableCount,
    waitingMessage,
  };
}
