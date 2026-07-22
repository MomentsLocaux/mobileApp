import { supabase } from '@/lib/supabase/client';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';

export type EarlyAccessTeaser = {
  ok: boolean;
  locked?: boolean;
  event_id?: string;
  title?: string;
  city?: string | null;
  starts_at?: string | null;
  cover_url?: string | null;
  early_access_until?: string | null;
  has_access?: boolean;
  unlock_price?: number | null;
  reason?: string;
};

export type EarlyAccessStats = {
  ok: boolean;
  event_id: string;
  early_access_until?: string | null;
  window_active: boolean;
  early_signups: number;
  checked_in: number;
  no_show: number;
};

export const EarlyAccessService = {
  isWindowActive(earlyAccessUntil?: string | null): boolean {
    if (!GAMIFICATION_ENABLED || !earlyAccessUntil) return false;
    return new Date(earlyAccessUntil).getTime() > Date.now();
  },

  async enable(eventId: string, hours = 48): Promise<{ early_access_until?: string }> {
    if (!GAMIFICATION_ENABLED) throw new Error('GAMIFICATION_DISABLED');
    const { data, error } = await supabase.rpc('enable_event_early_access', {
      p_event_id: eventId,
      p_hours: hours,
    });
    if (error) throw new Error(error.message || 'Impossible d’ouvrir l’accès anticipé');
    return (data || {}) as { early_access_until?: string };
  },

  async purchase(eventId: string): Promise<{ ok: boolean; price?: number }> {
    if (!GAMIFICATION_ENABLED) throw new Error('GAMIFICATION_DISABLED');
    const { data, error } = await supabase.rpc('purchase_early_access', {
      p_event_id: eventId,
    });
    if (error) throw new Error(error.message || 'Impossible d’acheter l’accès anticipé');
    return (data || { ok: false }) as { ok: boolean; price?: number };
  },

  async claim(eventId: string): Promise<void> {
    if (!GAMIFICATION_ENABLED) return;
    try {
      await supabase.rpc('claim_early_access', { p_event_id: eventId });
    } catch (err) {
      console.warn('claim_early_access', err);
    }
  },

  async getTeaser(eventId: string): Promise<EarlyAccessTeaser | null> {
    if (!GAMIFICATION_ENABLED || !eventId) return null;
    const { data, error } = await supabase.rpc('get_early_access_teaser', {
      p_event_id: eventId,
    });
    if (error) {
      console.warn('get_early_access_teaser', error);
      return null;
    }
    return (data || null) as EarlyAccessTeaser | null;
  },

  async getStats(eventId: string): Promise<EarlyAccessStats | null> {
    if (!GAMIFICATION_ENABLED) return null;
    const { data, error } = await supabase.rpc('get_event_early_stats', {
      p_event_id: eventId,
    });
    if (error) {
      console.warn('get_event_early_stats', error);
      return null;
    }
    return (data || null) as EarlyAccessStats | null;
  },
};
