/**
 * Politique de mise en page des fiches événement (hors page détail).
 *
 * Structure canonique du panneau d'information :
 * 1. Ligne titre : titre (gauche) + horaires début/fin (droite, alignés en haut)
 * 2. Ligne ville : icône lieu + ville (pleine largeur)
 * 3. Ligne sociale (optionnelle) : amis qui y vont
 * 4. Ligne stats (optionnelle) : chips vues + distance
 *
 * Variantes de conteneur :
 * - hero-overlay : image plein fond + panneau en overlay (accueil, carte unitaire)
 * - hero-stacked  : image en bandeau haut + panneau surface en dessous (liste map)
 * - classic        : carousel image + panneau sous l'image (listes profil)
 * - horizontal     : vignette gauche + panneau compact à droite (carrousel map legacy)
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
