import type { StagedProgressStep } from './staged-progress';

export const COVER_GENERATE_STEPS = [
  {
    id: 'fiche',
    label: 'Lecture de la fiche',
    detail: 'Titre, lieu, catégorie, ton',
  },
  {
    id: 'photo',
    label: 'Prise en compte de ta photo',
    detail: 'Pour rester proche du réel',
  },
  {
    id: 'image',
    label: 'Création de l’image',
    detail: 'Environ 10 à 20 secondes',
  },
  {
    id: 'save',
    label: 'Enregistrement',
    detail: 'Cover prête à vérifier',
  },
] as const;

export type CoverGenerateStepId = (typeof COVER_GENERATE_STEPS)[number]['id'];

export function coverGenerateSteps(hasReferencePhoto: boolean): StagedProgressStep[] {
  if (hasReferencePhoto) return [...COVER_GENERATE_STEPS];
  return COVER_GENERATE_STEPS.filter((step) => step.id !== 'photo');
}
