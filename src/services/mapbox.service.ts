import Constants from 'expo-constants';

const MAPBOX_TOKEN =
  Constants.expoConfig?.extra?.mapboxToken || process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

if (!MAPBOX_TOKEN) {
  console.warn('Mapbox token missing (EXPO_PUBLIC_MAPBOX_TOKEN)');
}

export type MapboxFeature = {
  place_name: string;
  center: [number, number];
  context?: Array<{ id: string; text: string }>;
};

export type GeocodeResult = {
  label: string;
  latitude: number;
  longitude: number;
  city: string;
  postalCode: string;
  country: string;
};

export const MapboxService = {
  async search(query: string): Promise<GeocodeResult[]> {
    if (!MAPBOX_TOKEN || !query.trim()) return [];
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?access_token=${MAPBOX_TOKEN}&country=FR&types=address,place,locality&language=fr`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features as MapboxFeature[]).map((f) => ({
      label: f.place_name,
      latitude: f.center[1],
      longitude: f.center[0],
      city: extractContext(f, 'place') || extractContext(f, 'locality') || '',
      postalCode: extractContext(f, 'postcode') || '',
      country: 'FR',
    }));
  },

  async reverse(lat: number, lon: number): Promise<GeocodeResult | null> {
    if (!MAPBOX_TOKEN) return null;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_TOKEN}&country=FR&types=address,place,locality&language=fr`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = (data.features as MapboxFeature[])[0];
    if (!feature) return null;
    return {
      label: feature.place_name,
      latitude: feature.center[1],
      longitude: feature.center[0],
      city: extractContext(feature, 'place') || extractContext(feature, 'locality') || '',
      postalCode: extractContext(feature, 'postcode') || '',
      country: 'FR',
    };
  },
};

const extractContext = (feature: MapboxFeature, key: string): string => {
  const item = feature.context?.find((c) => c.id.startsWith(key));
  return item?.text || '';
};
