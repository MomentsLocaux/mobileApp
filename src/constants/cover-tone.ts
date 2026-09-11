import type { CategoryVisualSlug } from './category-visuals';

export const COVER_TONES = ['sobre', 'festif', 'intimiste', 'nature'] as const;

export type CoverTone = (typeof COVER_TONES)[number];

export const COVER_TONE_LABELS: Record<CoverTone, string> = {
  sobre: 'Sobre',
  festif: 'Festif',
  intimiste: 'Intimiste',
  nature: 'Nature',
};

const CATEGORY_DEFAULT_TONE: Partial<Record<CategoryVisualSlug, CoverTone>> = {
  'fetes-animations': 'festif',
  'arts-culture': 'intimiste',
  'ateliers-apprentissage': 'intimiste',
  'nature-bienetre': 'nature',
};

export function isCoverTone(value: string | null | undefined): value is CoverTone {
  return !!value && (COVER_TONES as readonly string[]).includes(value);
}

export function defaultCoverToneForCategorySlug(slug: string | null | undefined): CoverTone {
  if (slug && slug in CATEGORY_DEFAULT_TONE) {
    return CATEGORY_DEFAULT_TONE[slug as CategoryVisualSlug] ?? 'sobre';
  }
  return 'sobre';
}

export function coverTonePromptLine(tone: CoverTone): string {
  switch (tone) {
    case 'festif':
      return 'Mood: lively local celebration, warm golden-hour or string-light atmosphere, photographic not neon, not CGI.';
    case 'intimiste':
      return 'Mood: intimate indoor or small-gathering atmosphere, soft lamp light, close but no identifiable faces.';
    case 'nature':
      return 'Mood: outdoor landscape and vegetation, natural light, quiet documentary feel.';
    default:
      return 'Mood: quiet documentary photography, natural light, muted earth and forest-green tones.';
  }
}
