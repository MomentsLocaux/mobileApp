import { supabase } from '@/lib/supabase/client';
import { dataProvider } from '@/data-provider';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';

export type ShopItemRow = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  price: number;
  type: string;
  data: Record<string, unknown> | null;
};

export const ShopService = {
  purchase: (payload: { itemId: string; method: 'lumo' | 'eur'; userId: string }) =>
    dataProvider.purchaseItem(payload),

  async listItems(): Promise<ShopItemRow[]> {
    if (!GAMIFICATION_ENABLED) return [];
    const { data, error } = await supabase
      .from('shop_items')
      .select('id, key, title, description, price, type, data')
      .order('price', { ascending: true });
    if (error) throw new Error(error.message || 'Impossible de charger la boutique');
    return (data || []) as ShopItemRow[];
  },

  async buyItem(itemKey: string): Promise<{ success: boolean; quantity?: number }> {
    if (!GAMIFICATION_ENABLED) throw new Error('GAMIFICATION_DISABLED');
    const { data, error } = await supabase.rpc('buy_item', { p_item_key: itemKey });
    if (error) throw new Error(error.message || 'Achat impossible');
    return (data || { success: false }) as { success: boolean; quantity?: number };
  },

  async purchaseEventBoost(eventId: string): Promise<{
    success: boolean;
    boost_id?: string;
    expires_at?: string;
    price?: number;
  }> {
    if (!GAMIFICATION_ENABLED) {
      throw new Error('GAMIFICATION_DISABLED');
    }
    const { data, error } = await supabase.rpc('purchase_event_boost', {
      p_event_id: eventId,
    });
    if (error) throw new Error(error.message || 'Impossible d’acheter le boost');
    return (data || { success: false }) as {
      success: boolean;
      boost_id?: string;
      expires_at?: string;
      price?: number;
    };
  },
};
