export type StagedProgressStep = {
  id: string;
  label: string;
  detail: string;
};

export type StagedProgressStepStatus = 'pending' | 'active' | 'done';

export function stagedProgressIndex(steps: readonly StagedProgressStep[], stepId: string): number {
  return steps.findIndex((step) => step.id === stepId);
}

/**
 * Percent from completed steps plus 0–1 progress inside the active step.
 * Long AI calls have no server ticks, so the UI may ease `stepProgress` toward 0.9.
 */
export function stagedProgressPercent(
  steps: readonly StagedProgressStep[],
  stepId: string,
  stepProgress = 0,
  options?: { complete?: boolean },
): number {
  if (options?.complete) return 100;
  const index = stagedProgressIndex(steps, stepId);
  if (index < 0) return 0;
  const clamped = Math.min(1, Math.max(0, stepProgress));
  return Math.min(99, Math.round(((index + clamped) / steps.length) * 100));
}

export function stagedProgressStepStatus(
  steps: readonly StagedProgressStep[],
  stepId: string,
  activeStepId: string,
  options?: { complete?: boolean },
): StagedProgressStepStatus {
  if (options?.complete) return 'done';
  const stepIndex = stagedProgressIndex(steps, stepId);
  const activeIndex = stagedProgressIndex(steps, activeStepId);
  if (stepIndex < activeIndex) return 'done';
  if (stepIndex === activeIndex) return 'active';
  return 'pending';
}

/** Asymptotic 0 → ~0.9 so a long wait never looks stuck at 0% of its slice. */
export function stagedProgressEase(elapsedMs: number, tauMs = 8000): number {
  if (elapsedMs <= 0) return 0;
  return 0.9 * (1 - Math.exp(-elapsedMs / tauMs));
}
