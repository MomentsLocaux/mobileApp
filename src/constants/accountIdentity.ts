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
    description: 'Vous explorez (et éventuellement créez) des moments près de chez vous.',
  },
  {
    value: 'professionnel',
    label: 'Professionnel',
    description: 'Vous diffusez des moments pour votre activité ou structure (offre Diffuseur).',
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
    description: 'Coach, artisan, DJ, créateur solo…',
  },
  {
    value: 'association',
    label: 'Association',
    description: 'Club, asso de quartier…',
  },
  {
    value: 'lieu',
    label: 'Lieu',
    description: 'Salle, café-concert, musée, médiathèque…',
  },
  {
    value: 'office_tourisme',
    label: 'Office de tourisme',
    description: 'OT, CDT…',
  },
  {
    value: 'collectivite',
    label: 'Collectivité',
    description: 'Mairie, CCAS, EPCI…',
  },
];

export const PRO_SUBTYPE_LABELS: Record<ProSubtype, string> = {
  independant: 'Indépendant',
  association: 'Association',
  lieu: 'Lieu',
  office_tourisme: 'Office de tourisme',
  collectivite: 'Collectivité',
};
