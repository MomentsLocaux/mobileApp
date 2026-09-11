import React from 'react';
import { StagedProgressCard } from '@/components/events/StagedProgressCard';
import { POSTER_ANALYSIS_STEPS, type PosterAnalysisStepId } from '@/utils/poster-analysis-progress';

type Props = {
  stepId: PosterAnalysisStepId;
  complete?: boolean;
};

export function PosterAnalysisProgress({ stepId, complete = false }: Props) {
  return (
    <StagedProgressCard
      steps={POSTER_ANALYSIS_STEPS}
      stepId={stepId}
      complete={complete}
      spinnerLabel="Analyse en cours"
      readyCaption="C’est prêt"
      accessibilityPrefix="Analyse de l’affiche"
    />
  );
}
