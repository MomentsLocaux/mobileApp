type EventCoordsSource = {
  latitude?: number | null;
  longitude?: number | null;
  location?:
    | {
        type?: string;
        coordinates?: [number, number];
      }
    | string
    | null;
};

export type EventCoords = {
  latitude: number;
  longitude: number;
};

const isUsableCoord = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  !(latitude === 0 && longitude === 0);

export function extractEventCoords(event: EventCoordsSource): EventCoords | null {
  if (typeof event.latitude === 'number' && typeof event.longitude === 'number') {
    if (isUsableCoord(event.latitude, event.longitude)) {
      return { latitude: event.latitude, longitude: event.longitude };
    }
  }

  const location = event.location;
  if (location && typeof location === 'object' && Array.isArray(location.coordinates)) {
    const [longitude, latitude] = location.coordinates;
    if (typeof latitude === 'number' && typeof longitude === 'number' && isUsableCoord(latitude, longitude)) {
      return { latitude, longitude };
    }
  }

  return null;
}
