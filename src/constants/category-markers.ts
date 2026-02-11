export const CATEGORY_MARKER_SLUGS = [
  'arts-culture',
  'marches-artisanat',
  'fetes-animations',
  'famille-enfants',
  'gastronomie-saveurs',
  'nature-bienetre',
  'ateliers-apprentissage',
  'sport-loisirs',
  'vie-locale',
  'insolite-ephemere',
] as const;

export type CategoryMarkerSlug = (typeof CATEGORY_MARKER_SLUGS)[number];

const CATEGORY_MARKER_SET = new Set<string>(CATEGORY_MARKER_SLUGS);

export const categoryMarkerImageKey = (slug: CategoryMarkerSlug) => `category-marker-${slug}`;

export const resolveCategoryMarkerImageKey = (slug?: string | null): string | null => {
  if (!slug) return null;
  const normalized = slug.trim().toLowerCase();
  if (!CATEGORY_MARKER_SET.has(normalized)) return null;
  return `category-marker-${normalized}`;
};

