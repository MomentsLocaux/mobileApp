/**
 * Account identity constants — ADR_007.
 * Level-1 audience: Particulier | Professionnel.
 * Professionnel requires pro_subtype. Never expose institutionnel as audience.
 */

export type AccountKind = 'particulier' | 'professionnel';

export type ProSubtype =
  | 'independant'
  | 'association'
  | 'lieu'
  | 'office_tourisme'
  | 'collectivite';

export type ActiveMode = 'discover' | 'create';

export const ACCOUNT_KIND_OPTIONS: {
  value: AccountKind;
  label: string;
  description: string;
}[] = [
  {
    value: 'particulier',
    label: 'Particulier',
    description: 'Tu explores les moments près de chez toi, et tu peux en proposer.',
  },
  {
    value: 'professionnel',
    label: 'Professionnel',
    description: 'Tu publies des moments pour ton activité ou ta structure.',
  },
];

export const PRO_SUBTYPE_OPTIONS: {
  value: ProSubtype;
  label: string;
  description: string;
}[] = [
  {
    value: 'independant',
    label: 'Indépendant',
    description: 'Coach, artisan, artiste ou activité solo.',
  },
  {
    value: 'association',
    label: 'Association',
    description: 'Club ou association de quartier.',
  },
  {
    value: 'lieu',
    label: 'Lieu',
    description: 'Salle, café, musée ou médiathèque.',
  },
  {
    value: 'office_tourisme',
    label: 'Office de tourisme',
    description: 'Tu publies l’agenda de ton territoire.',
  },
  {
    value: 'collectivite',
    label: 'Collectivité',
    description: 'Mairie ou autre collectivité.',
  },
];

export const PRO_SUBTYPE_LABELS: Record<ProSubtype, string> = {
  independant: 'Indépendant',
  association: 'Association',
  lieu: 'Lieu',
  office_tourisme: 'Office de tourisme',
  collectivite: 'Collectivité',
};
