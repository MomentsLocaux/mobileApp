import {
  Baby,
  BookOpen,
  Dumbbell,
  Leaf,
  LucideIcon,
  Music,
  ShoppingBag,
  Sparkles,
  Theater,
  Users,
  UtensilsCrossed,
} from 'lucide-react-native';

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

export type CategoryVisual = {
  Icon: LucideIcon;
  fallbackColor: string;
  iconColor?: string;
};

export const CATEGORY_VISUALS: Record<CategoryVisualSlug, CategoryVisual> = {
  'arts-culture': { fallbackColor: '#7c3aed', Icon: Theater },
  'marches-artisanat': { fallbackColor: '#0ea5e9', Icon: ShoppingBag },
  'fetes-animations': { fallbackColor: '#f97316', Icon: Music },
  'famille-enfants': { fallbackColor: '#16a34a', Icon: Baby },
  'gastronomie-saveurs': { fallbackColor: '#facc15', Icon: UtensilsCrossed, iconColor: '#3f2d00' },
  'nature-bienetre': { fallbackColor: '#22c55e', Icon: Leaf },
  'ateliers-apprentissage': { fallbackColor: '#6366f1', Icon: BookOpen },
  'sport-loisirs': { fallbackColor: '#f43f5e', Icon: Dumbbell },
  'vie-locale': { fallbackColor: '#0ea5e9', Icon: Users },
  'insolite-ephemere': { fallbackColor: '#a855f7', Icon: Sparkles },
};

/** Generic Mapbox sprite used when no category slug is available. */
export const DEFAULT_MAP_MARKER = 'marker-15';

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

/** Mapbox image key for a known category slug, or null. */
export const resolveCategoryMarkerImageKey = (slug?: string | null): string | null => {
  if (!isCategoryVisualSlug(slug)) return null;
  return categoryMarkerImageKey(slug.trim().toLowerCase() as CategoryVisualSlug);
};

/** Resolves the map marker image key for an event from its category slug. */
export const resolveEventMarkerIcon = (slug?: string | null): string => {
  return resolveCategoryMarkerImageKey(slug) ?? DEFAULT_MAP_MARKER;
};
