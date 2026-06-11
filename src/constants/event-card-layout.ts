/**
 * Politique legacy des panneaux EventCardContent (encore utilisée en interne).
 * La carte unifiée `EventCard` s'appuie sur `EventCardVariant` dans event-card-variants.ts.
 */

export type EventCardContainerVariant = 'hero-overlay' | 'hero-stacked' | 'classic' | 'horizontal';

export type EventCardContentTone = 'overlay' | 'surface' | 'muted';

export type EventCardContentDensity = 'comfortable' | 'compact';

export const EVENT_CARD_SCHEDULE_COLUMN_MAX_WIDTH = '46%';

export const EVENT_CARD_INFO_ORDER = [
  'title_schedule',
  'city',
  'social',
  'stats',
] as const;
