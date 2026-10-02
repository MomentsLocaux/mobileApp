import {
  createLucideIcon,
  BookOpen,
  Dumbbell,
  Sprout,
  LucideIcon,
  Music,
  Sparkles,
  Users,
  House,
} from 'lucide-react-native';

/** Simple counterparts of the map artwork, sharing Lucide's 24-unit stroke grid. */
const TheaterMasks = createLucideIcon('CategoryTheaterMasks', [
  ['path', { d: 'M3 3c3 1 6 1 9 0v4M3 3v7c0 4 2 6 5 7', key: 'back' }],
  ['path', { d: 'M6 7h1M6 12q1-2 3-1', key: 'sad' }],
  ['path', { d: 'M10 8c4 1 7 1 11-1v8c0 4-3 6-5 7-3-1-6-3-6-7Z', key: 'front' }],
  ['path', { d: 'M13 12h1M18 12h1M14 16q2 3 4 0', key: 'happy' }],
]);
const MarketBasket = createLucideIcon('CategoryMarketBasket', [
  ['path', { d: 'M7 10V8a5 5 0 0 1 10 0v2M2 10h20l-3 11H5ZM3 15h18M9 10v11M15 10v11', key: 'basket' }],
]);
const TeddyBear = createLucideIcon('CategoryTeddyBear', [
  ['path', { d: 'M7 6a3 3 0 1 1 3-3m4 0a3 3 0 1 1 3 3', key: 'ears' }],
  ['path', { d: 'M6 8a6 6 0 0 1 12 0c0 3-2 5-6 5S6 11 6 8Z', key: 'head' }],
  ['path', { d: 'M9 8h.01M15 8h.01M11 10h2', key: 'face' }],
  ['path', { d: 'M8 13c-4-2-5 3-2 4m10-4c4-2 5 3 2 4M9 13c-2 2-2 5 0 7h6c2-2 2-5 0-7', key: 'body' }],
  ['ellipse', { cx: '7', cy: '20', rx: '3', ry: '2', key: 'left-foot' }],
  ['ellipse', { cx: '17', cy: '20', rx: '3', ry: '2', key: 'right-foot' }],
]);
const ServingCloche = createLucideIcon('CategoryServingCloche', [
  ['path', { d: 'M3 17a9 9 0 0 1 18 0ZM1 21h22M12 8V5M10 5h4', key: 'cloche' }],
]);

/** MVP category slugs — single source of truth for map markers and UI icons. */
export const CATEGORY_VISUAL_SLUGS = [
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

export type CategoryVisualSlug = (typeof CATEGORY_VISUAL_SLUGS)[number];

/** Canonical labels used while the remote taxonomy is loading or unavailable. */
export const CATEGORY_VISUAL_LABELS: Record<CategoryVisualSlug, string> = {
  'arts-culture': 'Arts & Culture',
  'marches-artisanat': 'Marchés & Artisanat',
  'fetes-animations': 'Fêtes & Animations',
  'famille-enfants': 'Famille & Enfants',
  'gastronomie-saveurs': 'Gastronomie & Saveurs',
  'nature-bienetre': 'Nature & Bien-être',
  'ateliers-apprentissage': 'Ateliers & Apprentissage',
  'sport-loisirs': 'Sport & Loisirs',
  'vie-locale': 'Vie locale',
  'insolite-ephemere': 'Insolite & Éphémère',
};

export type CategoryVisual = {
  Icon: LucideIcon;
  fallbackColor: string;
  iconColor?: string;
};

export const CATEGORY_VISUALS: Record<CategoryVisualSlug, CategoryVisual> = {
  'arts-culture': { fallbackColor: '#7c3aed', Icon: TheaterMasks },
  'marches-artisanat': { fallbackColor: '#0ea5e9', Icon: MarketBasket },
  'fetes-animations': { fallbackColor: '#f97316', Icon: Music },
  'famille-enfants': { fallbackColor: '#16a34a', Icon: TeddyBear },
  'gastronomie-saveurs': { fallbackColor: '#facc15', Icon: ServingCloche, iconColor: '#3f2d00' },
  'nature-bienetre': { fallbackColor: '#22c55e', Icon: Sprout },
  'ateliers-apprentissage': { fallbackColor: '#6366f1', Icon: BookOpen },
  'sport-loisirs': { fallbackColor: '#f43f5e', Icon: Dumbbell },
  'vie-locale': { fallbackColor: '#0ea5e9', Icon: House },
  'insolite-ephemere': { fallbackColor: '#a855f7', Icon: Sparkles },
};

/** Custom fallback marker image (must not collide with Mapbox style sprites). */
export const DEFAULT_MAP_MARKER = 'category-marker-default';
export const DEFAULT_CLUSTER_MAP_MARKER = 'category-cluster-marker-default';

const CATEGORY_VISUAL_SET = new Set<string>(CATEGORY_VISUAL_SLUGS);

export const isCategoryVisualSlug = (slug?: string | null): slug is CategoryVisualSlug => {
  if (!slug) return false;
  return CATEGORY_VISUAL_SET.has(slug.trim().toLowerCase());
};

export const getCategoryVisual = (slug?: string | null): CategoryVisual | null => {
  if (!isCategoryVisualSlug(slug)) return null;
  return CATEGORY_VISUALS[slug.trim().toLowerCase() as CategoryVisualSlug];
};

export const getCategoryLucideIcon = (slug?: string | null): LucideIcon => {
  return getCategoryVisual(slug)?.Icon ?? Users;
};

export const getCategoryFallbackColor = (slug?: string | null): string | null => {
  return getCategoryVisual(slug)?.fallbackColor ?? null;
};

export const categoryMarkerImageKey = (slug: CategoryVisualSlug) => `category-marker-${slug}`;

export const categoryClusterMarkerImageKey = (slug: CategoryVisualSlug) => `category-cluster-marker-${slug}`;

export const toClusterMarkerImageKey = (markerImageKey: string): string => {
  if (markerImageKey === DEFAULT_MAP_MARKER) return DEFAULT_CLUSTER_MAP_MARKER;
  if (markerImageKey.startsWith('category-marker-')) {
    return markerImageKey.replace('category-marker-', 'category-cluster-marker-');
  }
  return DEFAULT_CLUSTER_MAP_MARKER;
};

/** Mapbox image key for a known category slug, or null. */
export const resolveCategoryMarkerImageKey = (slug?: string | null): string | null => {
  if (!isCategoryVisualSlug(slug)) return null;
  return categoryMarkerImageKey(slug.trim().toLowerCase() as CategoryVisualSlug);
};

/** Resolves the map marker image key for an event from its category slug. */
export const resolveEventMarkerIcon = (slug?: string | null): string => {
  return resolveCategoryMarkerImageKey(slug) ?? DEFAULT_MAP_MARKER;
};

export const pickCategoryMetaSlug = (categoryMetaValue: unknown): string | null => {
  if (Array.isArray(categoryMetaValue)) {
    const slug = (categoryMetaValue[0] as { slug?: string } | undefined)?.slug;
    return typeof slug === 'string' ? slug : null;
  }
  if (categoryMetaValue && typeof categoryMetaValue === 'object') {
    const slug = (categoryMetaValue as { slug?: string }).slug;
    return typeof slug === 'string' ? slug : null;
  }
  return null;
};

export const resolveEventMarkerIconFromEvent = (event: {
  category?: string | null;
  category_meta?: unknown;
}): string => {
  const slugFromMeta = pickCategoryMetaSlug(event.category_meta);
  if (slugFromMeta) {
    return resolveEventMarkerIcon(slugFromMeta);
  }
  return resolveEventMarkerIcon(event.category);
};
