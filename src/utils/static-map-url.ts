import Constants from 'expo-constants';

const MAPBOX_STYLE = 'mapbox/streets-v12';
const PIN_COLOR = '7CB518';

function mapboxToken(): string {
  return (
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
    (Constants.expoConfig?.extra?.mapboxToken as string | undefined) ||
    ''
  );
}

export function buildStaticMapUrl(
  latitude: number,
  longitude: number,
  options?: { width?: number; height?: number; zoom?: number },
): string | null {
  const token = mapboxToken();
  if (!token) return null;
  const width = options?.width ?? 160;
  const height = options?.height ?? 100;
  const zoom = options?.zoom ?? 12;
  const lon = longitude.toFixed(5);
  const lat = latitude.toFixed(5);
  return `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE}/static/pin-s+${PIN_COLOR}(${lon},${lat})/${lon},${lat},${zoom},0/${width}x${height}@2x?access_token=${encodeURIComponent(token)}`;
}
