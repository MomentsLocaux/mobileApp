/**
 * Shared feature matrix for Local ⊂ Habitué ⊂ Éclaireur.
 * Used by Nos offres + onboarding accordions.
 */
export type OfferTier = 'local' | 'habitue' | 'eclaireur';

export type OfferFeatureRow = {
  id: string;
  label: string;
  local: boolean;
  habitue: boolean;
  eclaireur: boolean;
};

export const OFFER_FEATURE_MATRIX: OfferFeatureRow[] = [
  { id: 'map', label: 'Carte + fil + recherche', local: true, habitue: true, eclaireur: true },
  { id: 'create', label: 'Créer / soumettre un événement', local: true, habitue: true, eclaireur: true },
  { id: 'social', label: 'Favoris, likes, follow, communauté', local: true, habitue: true, eclaireur: true },
  { id: 'notifs', label: 'Notifications classiques', local: true, habitue: true, eclaireur: true },
  { id: 'report', label: 'Signaler / profil / CGU', local: true, habitue: true, eclaireur: true },
  { id: 'checkin', label: 'Check-in sur place (+ Lumo)', local: false, habitue: true, eclaireur: true },
  { id: 'lumo', label: 'Gagner / dépenser des Lumo', local: false, habitue: true, eclaireur: true },
  { id: 'missions', label: 'Missions', local: false, habitue: true, eclaireur: true },
  { id: 'pass', label: 'Pass partenaires', local: false, habitue: true, eclaireur: true },
  { id: 'early', label: 'Accès anticipé aux événements', local: false, habitue: true, eclaireur: true },
  { id: 'ambassador', label: 'Badge Ambassadeur', local: false, habitue: true, eclaireur: true },
  { id: 'boost', label: 'Boost créateur (Lumo)', local: false, habitue: true, eclaireur: true },
  {
    id: 'right_now',
    label: 'Idées de moments à rejoindre tout de suite',
    local: false,
    habitue: false,
    eclaireur: true,
  },
  {
    id: 'radius',
    label: 'Carte de votre zone (où vous sortez)',
    local: false,
    habitue: false,
    eclaireur: true,
  },
  {
    id: 'reco',
    label: 'Recommandations calées sur vos sorties',
    local: false,
    habitue: false,
    eclaireur: true,
  },
  {
    id: 'loop',
    label: 'Idées hors de vos habitudes',
    local: false,
    habitue: false,
    eclaireur: true,
  },
  {
    id: 'insights',
    label: 'Résumé de vos découvertes',
    local: false,
    habitue: false,
    eclaireur: true,
  },
  {
    id: 'premium_badge',
    label: 'Cadre / badge premium',
    local: false,
    habitue: false,
    eclaireur: true,
  },
];

export const DISCOVERY_BENEFITS_FR = [
  {
    title: 'Idées maintenant',
    body: 'Des moments à rejoindre tout de suite, près de vous.',
  },
  {
    title: 'Carte de votre zone',
    body: 'Voyez où vous sortez et les coins à explorer à proximité.',
  },
  {
    title: 'Recommandations adaptées',
    body: 'Des propositions calées sur vos sorties passées.',
  },
  {
    title: 'Sortir de la routine',
    body: 'Des idées hors de vos habitudes, pour découvrir autrement.',
  },
  {
    title: 'Bilans de découverte',
    body: 'Un résumé clair de ce que vous avez exploré.',
  },
] as const;
