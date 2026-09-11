import {
  stagedProgressEase,
  stagedProgressIndex,
  stagedProgressPercent,
  stagedProgressStepStatus,
  type StagedProgressStepStatus,
} from './staged-progress';

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

export type PosterAnalysisStepStatus = StagedProgressStepStatus;

export function posterAnalysisStepIndex(stepId: PosterAnalysisStepId): number {
  return stagedProgressIndex(POSTER_ANALYSIS_STEPS, stepId);
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
  return stagedProgressPercent(POSTER_ANALYSIS_STEPS, stepId, stepProgress, options);
}

export function posterAnalysisStepStatus(
  stepId: PosterAnalysisStepId,
  activeStepId: PosterAnalysisStepId,
  options?: { complete?: boolean },
): PosterAnalysisStepStatus {
  return stagedProgressStepStatus(POSTER_ANALYSIS_STEPS, stepId, activeStepId, options);
}

/** Asymptotic 0 → ~0.9 so a long vision call never looks stuck at 0% of its slice. */
export function posterAnalysisEaseProgress(elapsedMs: number, tauMs = 8000): number {
  return stagedProgressEase(elapsedMs, tauMs);
}
