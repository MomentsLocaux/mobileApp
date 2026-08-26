import {
  MAP_QUERY_EDGE_INSET_PX,
  MAP_QUERY_PEEK_GAP_PX,
  MAP_QUERY_PEEK_INSET_PX,
} from '../constants/map-screen';
import type { MapBounds } from '../types/map-events';

export type MapPixelInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type MapViewportSize = {
  width: number;
  height: number;
};

/** Ensure sw/ne form a proper axis-aligned box regardless of corner labeling. */
export function normalizeMapBounds(bounds: MapBounds): MapBounds {
  const minLon = Math.min(bounds.ne[0], bounds.sw[0]);
  const maxLon = Math.max(bounds.ne[0], bounds.sw[0]);
  const minLat = Math.min(bounds.ne[1], bounds.sw[1]);
  const maxLat = Math.max(bounds.ne[1], bounds.sw[1]);
  return {
    sw: [minLon, minLat],
    ne: [maxLon, maxLat],
  };
}

/** Default pixel insets for the usable map chrome (peek sheet + edge margins). */
export function getMapQueryChromeInsets(
  overrides?: Partial<MapPixelInsets>
): MapPixelInsets {
  return {
    top: MAP_QUERY_EDGE_INSET_PX,
    right: MAP_QUERY_EDGE_INSET_PX,
    bottom: MAP_QUERY_PEEK_INSET_PX + MAP_QUERY_PEEK_GAP_PX,
    left: MAP_QUERY_EDGE_INSET_PX,
    ...overrides,
  };
}

/**
 * Shrink a camera AABB by pixel insets so query/count match the area the user
 * can actually see (excludes bottom-sheet overlay + edge margins).
 */
export function insetMapBoundsByPixels(
  bounds: MapBounds,
  viewport: MapViewportSize,
  insets: MapPixelInsets
): MapBounds {
  const b = normalizeMapBounds(bounds);
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);

  // Never consume more than 40% of an axis — keep a usable query box.
  const maxX = width * 0.4;
  const maxY = height * 0.4;
  const left = Math.min(Math.max(0, insets.left), maxX);
  const right = Math.min(Math.max(0, insets.right), maxX);
  const top = Math.min(Math.max(0, insets.top), maxY);
  const bottom = Math.min(Math.max(0, insets.bottom), maxY);

  if (left + right >= width - 1 || top + bottom >= height - 1) {
    return b;
  }

  const lonSpan = b.ne[0] - b.sw[0];
  const latSpan = b.ne[1] - b.sw[1];
  if (!(lonSpan > 0) || !(latSpan > 0)) return b;

  return normalizeMapBounds({
    sw: [
      b.sw[0] + (lonSpan * left) / width,
      b.sw[1] + (latSpan * bottom) / height,
    ],
    ne: [
      b.ne[0] - (lonSpan * right) / width,
      b.ne[1] - (latSpan * top) / height,
    ],
  });
}

/** Camera visible bounds → RPC / peek-count bounds (peek + edge chrome). */
export function insetMapBoundsForVisibleChrome(
  bounds: MapBounds,
  viewport: MapViewportSize,
  insetOverrides?: Partial<MapPixelInsets>
): MapBounds {
  return insetMapBoundsByPixels(
    bounds,
    {
      width: Math.max(1, viewport.width),
      height: Math.max(1, viewport.height),
    },
    getMapQueryChromeInsets(insetOverrides)
  );
}

/**
 * Wide viewports (country / large region) need a tiled fetch: the RPC applies
 * ORDER BY + LIMIT inside one AABB, which geographically biases markers into a
 * corridor instead of covering the whole visible box.
 */
export function shouldUseViewportGrid(
  bounds: MapBounds,
  zoom?: number | null
): boolean {
  if (typeof zoom === 'number' && Number.isFinite(zoom) && zoom < 9) return true;
  const b = normalizeMapBounds(bounds);
  const lonSpan = b.ne[0] - b.sw[0];
  const latSpan = b.ne[1] - b.sw[1];
  return lonSpan >= 4 || latSpan >= 3;
}

/** Split an AABB into a row×col grid of smaller AABBs (row 0 = south). */
export function splitBoundsIntoGrid(
  bounds: MapBounds,
  cols = 2,
  rows = 2
): MapBounds[] {
  const b = normalizeMapBounds(bounds);
  const lonSpan = b.ne[0] - b.sw[0];
  const latSpan = b.ne[1] - b.sw[1];
  const cells: MapBounds[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const swLon = b.sw[0] + (lonSpan * col) / cols;
      const neLon = b.sw[0] + (lonSpan * (col + 1)) / cols;
      const swLat = b.sw[1] + (latSpan * row) / rows;
      const neLat = b.sw[1] + (latSpan * (row + 1)) / rows;
      cells.push({
        sw: [swLon, swLat],
        ne: [neLon, neLat],
      });
    }
  }

  return cells;
}
