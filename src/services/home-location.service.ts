import { supabase } from '@/lib/supabase/client';

export type VisibleHomeLocation = {
  lat: number;
  lon: number;
};

const asCoords = (value: unknown): VisibleHomeLocation | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as { lat?: unknown; lon?: unknown };
  const lat = Number(record.lat);
  const lon = Number(record.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
};

/** Returns coords only when RLS/RPC allows the current user to see them. */
export async function getVisibleHomeLocation(userId: string): Promise<VisibleHomeLocation | null> {
  if (!userId) return null;
  const { data, error } = await supabase.rpc('get_home_location_coords' as never, {
    p_user_id: userId,
  } as never);
  if (error) return null;
  return asCoords(data);
}

export async function getVisibleHomeLocations(
  userIds: string[],
): Promise<Record<string, VisibleHomeLocation>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (userId) => {
      const coords = await getVisibleHomeLocation(userId);
      return coords ? ([userId, coords] as const) : null;
    }),
  );
  return Object.fromEntries(entries.filter((row): row is readonly [string, VisibleHomeLocation] => !!row));
}
