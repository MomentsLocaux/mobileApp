import { useCallback, useRef } from 'react';

export function useMapProgrammaticMove() {
  const isProgrammaticMoveRef = useRef(false);
  const pendingProgrammaticRefreshRef = useRef(false);
  const suppressBoundsRecalcUntilRef = useRef(0);

  const suppressBoundsRecalc = useCallback((durationMs: number) => {
    const until = Date.now() + durationMs;
    suppressBoundsRecalcUntilRef.current = Math.max(suppressBoundsRecalcUntilRef.current, until);
  }, []);

  const isBoundsRecalcSuppressed = useCallback(() => {
    return Date.now() < suppressBoundsRecalcUntilRef.current;
  }, []);

  const clearProgrammaticMoveState = useCallback(() => {
    isProgrammaticMoveRef.current = false;
    pendingProgrammaticRefreshRef.current = false;
  }, []);

  const startProgrammaticMove = useCallback(
    (options?: { durationMs?: number; refreshAfter?: boolean }) => {
      isProgrammaticMoveRef.current = true;
      pendingProgrammaticRefreshRef.current = options?.refreshAfter !== false;
      if (options?.durationMs) {
        suppressBoundsRecalc(options.durationMs + 250);
      }
    },
    [suppressBoundsRecalc]
  );

  const withProgrammaticMove = useCallback(
    (moveFn: () => void, options?: { refreshAfter?: boolean; durationMs?: number }) => {
      startProgrammaticMove(options);
      moveFn();
    },
    [startProgrammaticMove]
  );

  return {
    isProgrammaticMoveRef,
    pendingProgrammaticRefreshRef,
    suppressBoundsRecalcUntilRef,
    suppressBoundsRecalc,
    isBoundsRecalcSuppressed,
    clearProgrammaticMoveState,
    startProgrammaticMove,
    withProgrammaticMove,
  };
}
