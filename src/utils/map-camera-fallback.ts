import {
  FRANCE_CAMERA_CENTER,
  MAP_LOCAL_ZOOM,
} from '../constants/map-screen';

export type MapCameraAnchor = {
  latitude: number;
  longitude: number;
};

export type MapInitialCameraKind = 'user' | 'place' | 'country' | 'snapshot';

export type MapInitialCameraIntent = 'browse' | 'search';

export type MapInitialCamera = MapCameraAnchor & {
  zoom: number;
  kind: MapInitialCameraKind;
};

/**
 * Camera when GPS is missing: last explicit search place, otherwise France overview.
 * Never a hardcoded town.
 *
 * An applied Home/Map search owns the first paint. Last-visit snapshot is only
 * for browsing back into the map without a live search.
 */
export function resolveMapInitialCamera(input: {
  userLocation: MapCameraAnchor | null;
  placeCenter?: MapCameraAnchor | null;
  snapshotCamera?: (MapCameraAnchor & { zoom: number }) | null;
  liveIntent?: MapInitialCameraIntent;
}): MapInitialCamera {
  const liveIntent = input.liveIntent ?? 'browse';
  if (liveIntent === 'search') {
    if (input.placeCenter) {
      return {
        latitude: input.placeCenter.latitude,
        longitude: input.placeCenter.longitude,
        zoom: MAP_LOCAL_ZOOM,
        kind: 'place',
      };
    }
    if (input.userLocation) {
      return {
        latitude: input.userLocation.latitude,
        longitude: input.userLocation.longitude,
        zoom: MAP_LOCAL_ZOOM,
        kind: 'user',
      };
    }
    return {
      latitude: FRANCE_CAMERA_CENTER.latitude,
      longitude: FRANCE_CAMERA_CENTER.longitude,
      zoom: FRANCE_CAMERA_CENTER.zoom,
      kind: 'country',
    };
  }
  if (input.snapshotCamera) {
    return {
      latitude: input.snapshotCamera.latitude,
      longitude: input.snapshotCamera.longitude,
      zoom: input.snapshotCamera.zoom,
      kind: 'snapshot',
    };
  }
  if (input.userLocation) {
    return {
      latitude: input.userLocation.latitude,
      longitude: input.userLocation.longitude,
      zoom: MAP_LOCAL_ZOOM,
      kind: 'user',
    };
  }
  if (input.placeCenter) {
    return {
      latitude: input.placeCenter.latitude,
      longitude: input.placeCenter.longitude,
      zoom: MAP_LOCAL_ZOOM,
      kind: 'place',
    };
  }
  return {
    latitude: FRANCE_CAMERA_CENTER.latitude,
    longitude: FRANCE_CAMERA_CENTER.longitude,
    zoom: FRANCE_CAMERA_CENTER.zoom,
    kind: 'country',
  };
}

export function shouldBootstrapViewportFetch(kind: MapInitialCameraKind): boolean {
  return kind !== 'country';
}
