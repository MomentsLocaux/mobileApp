export type EventCardVariant = 'discovery' | 'favorite' | 'compact' | 'map-preview';

export const EVENT_CARD_CTA = {
  discovery: 'Voir l\'événement',
  favoriteGoing: "J'y vais",
  favoriteParticipating: 'Tu y vas',
  favoriteDetails: 'Voir les détails',
  favoritePast: 'Voir les détails',
  mapPreview: 'Voir',
  compact: 'Voir',
} as const;

export const EVENT_CARD_MEDIA_HEIGHT: Record<EventCardVariant, number> = {
  discovery: 200,
  favorite: 200,
  compact: 132,
  'map-preview': 108,
};

export const EVENT_CARD_RADIUS = 24;
