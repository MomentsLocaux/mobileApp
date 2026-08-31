import {
  FRANCE_CAMERA_CENTER,
  MAP_LOCAL_ZOOM,
} from '../constants/map-screen';

export type MapCameraAnchor = {
  latitude: number;
  longitude: number;
};

export type MapInitialCameraKind = 'user' | 'place' | 'country';

export type MapInitialCamera = MapCameraAnchor & {
  zoom: number;
  kind: MapInitialCameraKind;
};

/**
 * Camera when GPS is missing: last explicit search place, otherwise France overview.
 * Never a hardcoded town.
 */
export function resolveMapInitialCamera(input: {
  userLocation: MapCameraAnchor | null;
  placeCenter?: MapCameraAnchor | null;
}): MapInitialCamera {
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
