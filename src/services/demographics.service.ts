import { supabase } from '@/lib/supabase/client';

export type Demographics = {
  age_band: string | null;
  household: string | null;
  life_situation: string | null;
};

export const EMPTY_DEMOGRAPHICS: Demographics = {
  age_band: null,
  household: null,
  life_situation: null,
};

export async function getDemographics(userId: string): Promise<Demographics> {
  const { data, error } = await supabase
    .from('profile_demographics')
    .select('age_band, household, life_situation')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY_DEMOGRAPHICS;
  return {
    age_band: data.age_band ?? null,
    household: data.household ?? null,
    life_situation: data.life_situation ?? null,
  };
}

export async function saveDemographics(userId: string, value: Demographics): Promise<void> {
  const { error } = await supabase.from('profile_demographics').upsert({
    user_id: userId,
    age_band: value.age_band,
    household: value.household,
    life_situation: value.life_situation,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
