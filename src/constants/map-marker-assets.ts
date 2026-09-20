import type { ImageSourcePropType } from 'react-native';
import { categoryMarkerImageKey, type CategoryVisualSlug } from './category-visuals';

type MapMarkerAsset = {
  source: ImageSourcePropType;
  /** Taxonomy color used to art-direct the baked highlights and shadows. */
  primaryColor: string;
};

/**
 * Category collection. Adding an asset here activates it on both maps without
 * changing their sources, image IDs, event payloads or interaction handlers.
 * PNG canvases are 64 logical pixels (1x/2x/3x); displayed at 48 logical pixels.
 * Exhaustive typing prevents a new canonical category from silently missing its asset.
 */
export const CATEGORY_MAP_MARKER_ASSETS: Record<CategoryVisualSlug, MapMarkerAsset> = {
  'gastronomie-saveurs': {
    source: require('../../assets/map-markers/gastronomie-saveurs.png'),
    primaryColor: '#facc15',
  },
  'nature-bienetre': {
    source: require('../../assets/map-markers/nature-bienetre.png'),
    primaryColor: '#22c55e',
  },
  'arts-culture': {
    source: require('../../assets/map-markers/arts-culture.png'),
    primaryColor: '#7c3aed',
  },
  'marches-artisanat': {
    source: require('../../assets/map-markers/marches-artisanat.png'),
    primaryColor: '#0ea5e9',
  },
  'fetes-animations': {
    source: require('../../assets/map-markers/fetes-animations.png'),
    primaryColor: '#f97316',
  },
  'famille-enfants': {
    source: require('../../assets/map-markers/famille-enfants.png'),
    primaryColor: '#16a34a',
  },
  'ateliers-apprentissage': {
    source: require('../../assets/map-markers/ateliers-apprentissage.png'),
    primaryColor: '#6366f1',
  },
  'sport-loisirs': {
    source: require('../../assets/map-markers/sport-loisirs.png'),
    primaryColor: '#f43f5e',
  },
  'vie-locale': {
    source: require('../../assets/map-markers/vie-locale.png'),
    primaryColor: '#0ea5e9',
  },
  'insolite-ephemere': {
    source: require('../../assets/map-markers/insolite-ephemere.png'),
    primaryColor: '#a855f7',
  },
};

/** Shared textures, not one React view or texture per event. Never tint these RGB assets. */
export const MAP_MARKER_IMAGES = Object.fromEntries(
  Object.entries(CATEGORY_MAP_MARKER_ASSETS).map(([slug, asset]) => [
    categoryMarkerImageKey(slug as CategoryVisualSlug),
    asset.source,
  ]),
);

/** Mapbox queries this area around a tap, independent of the visible silhouette. */
export const MAP_MARKER_HITBOX = { width: 48, height: 48 };

export function getMapMarkerLayout(iconKey: string, selectionScale = 1) {
  const hasAsset = Object.prototype.hasOwnProperty.call(MAP_MARKER_IMAGES, iconKey);
  return {
    iconSize: (hasAsset ? 48 / 64 : 1) * selectionScale,
    // Neither category silhouettes nor the neutral fallback have a pin tip.
    iconAnchor: 'center' as const,
    iconOffset: [0, 0] as [number, number],
  };
}
