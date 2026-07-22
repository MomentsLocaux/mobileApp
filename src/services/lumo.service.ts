import { supabase } from '@/lib/supabase/client';
import { dataProvider } from '@/data-provider';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';

export type LumoTransactionRow = {
  id: string;
  amount: number;
  type: string;
  source: string | null;
  reason: string | null;
  created_at: string;
};

/**
 * Lumo wallet helpers (Habitué layer).
 * Credits are server-only via `credit_lumo_by_rule` after validated triggers.
 * Client `earn` is intentionally unavailable (CLIENT_EARN_FORBIDDEN).
 */
export const LumoService = {
  earn: async (_payload: {
    amount?: number;
    reason?: string;
    item_type?: string;
    item_id?: string;
  }) => {
    throw new Error('CLIENT_EARN_FORBIDDEN: Lumo credits are server-side only');
  },

  spend: (payload: { amount: number; item_type?: string; item_id?: string }) =>
    dataProvider.spendLumo({
      amount: payload.amount,
      reason: payload.item_type,
      item_type: payload.item_type,
      item_id: payload.item_id,
    }),

  async getBalance(userId: string): Promise<number> {
    if (!GAMIFICATION_ENABLED || !userId) return 0;
    const { data, error } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message || 'Impossible de charger le solde');
    return Number(data?.balance ?? 0);
  },

  async getHistory(userId: string, limit = 30): Promise<LumoTransactionRow[]> {
    if (!GAMIFICATION_ENABLED || !userId) return [];
    const { data, error } = await supabase
      .from('lumo_transactions')
      .select('id, amount, type, source, reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message || 'Impossible de charger l’historique');
    return (data || []) as LumoTransactionRow[];
  },
};
