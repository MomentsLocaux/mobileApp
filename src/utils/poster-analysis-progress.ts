export const POSTER_ANALYSIS_STEPS = [
  {
    id: 'prepare',
    label: 'Préparation de l’image',
    detail: 'Conversion et optimisation',
  },
  {
    id: 'upload',
    label: 'Envoi de l’affiche',
    detail: 'Sauvegarde de la cover',
  },
  {
    id: 'vision',
    label: 'Lecture de l’affiche',
    detail: 'Titre, dates, lieu, tarif…',
  },
  {
    id: 'place',
    label: 'Repérage du lieu',
    detail: 'Adresse et carte',
  },
  {
    id: 'prefill',
    label: 'Préremplissage',
    detail: 'Formulaire prêt à vérifier',
  },
] as const;

export type PosterAnalysisStepId = (typeof POSTER_ANALYSIS_STEPS)[number]['id'];

export type PosterAnalysisStepStatus = 'pending' | 'active' | 'done';

export function posterAnalysisStepIndex(stepId: PosterAnalysisStepId): number {
  return POSTER_ANALYSIS_STEPS.findIndex((step) => step.id === stepId);
}

/**
 * Percent from completed steps plus 0–1 progress inside the active step.
 * The vision call has no server ticks, so the UI may ease `stepProgress` toward 0.9.
 */
export function posterAnalysisPercent(
  stepId: PosterAnalysisStepId,
  stepProgress = 0,
  options?: { complete?: boolean },
): number {
  if (options?.complete) return 100;
  const index = posterAnalysisStepIndex(stepId);
  if (index < 0) return 0;
  const total = POSTER_ANALYSIS_STEPS.length;
  const clamped = Math.min(1, Math.max(0, stepProgress));
  return Math.min(99, Math.round(((index + clamped) / total) * 100));
}

export function posterAnalysisStepStatus(
  stepId: PosterAnalysisStepId,
  activeStepId: PosterAnalysisStepId,
  options?: { complete?: boolean },
): PosterAnalysisStepStatus {
  if (options?.complete) return 'done';
  const stepIndex = posterAnalysisStepIndex(stepId);
  const activeIndex = posterAnalysisStepIndex(activeStepId);
  if (stepIndex < activeIndex) return 'done';
  if (stepIndex === activeIndex) return 'active';
  return 'pending';
}

/** Asymptotic 0 → ~0.9 so a long vision call never looks stuck at 0% of its slice. */
export function posterAnalysisEaseProgress(elapsedMs: number, tauMs = 8000): number {
  if (elapsedMs <= 0) return 0;
  return 0.9 * (1 - Math.exp(-elapsedMs / tauMs));
}
