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
  discovery: 220,
  favorite: 220,
  compact: 132,
  'map-preview': 220,
};

export const MAP_PREVIEW_BODY_MIN_HEIGHT = 132;
export const MAP_PREVIEW_CARD_ESTIMATED_HEIGHT =
  EVENT_CARD_MEDIA_HEIGHT['map-preview'] + MAP_PREVIEW_BODY_MIN_HEIGHT + 2;

export const EVENT_CARD_RADIUS = 24;
