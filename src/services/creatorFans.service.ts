import { supabase } from '@/lib/supabase/client';
import type { CreatorFan, CreatorFanProfile } from '@/types/creator.types';

const firstOrNull = <T>(value: unknown): T | null => {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
};

const normalizeFan = (row: any): CreatorFan => ({
  creator_id: row.creator_id,
  fan_id: row.fan_id,
  xp: Number(row.xp ?? 0),
  level: Number(row.level ?? 1),
  super_fan: Boolean(row.super_fan),
  interactions_count: Number(row.interactions_count ?? 0),
  last_interaction_at: row.last_interaction_at ?? null,
  profile: firstOrNull<CreatorFanProfile>(row.profile),
});

export async function getTopFans(creatorId: string, limit = 20): Promise<CreatorFan[]> {
  const safeLimit = Math.min(100, Math.max(1, limit));

  const { data, error } = await supabase
    .from('creator_fans')
    .select(
      `
      creator_id,
      fan_id,
      xp,
      level,
      super_fan,
      interactions_count,
      last_interaction_at,
      profile:profiles!creator_fans_fan_id_fkey(display_name, avatar_url)
    `,
    )
    .eq('creator_id', creatorId)
    .order('xp', { ascending: false })
    .order('interactions_count', { ascending: false })
    .limit(safeLimit);

  if (error) throw error;

  return (data || []).map(normalizeFan);
}
