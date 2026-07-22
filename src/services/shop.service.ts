import { supabase } from '@/lib/supabase/client';
import { dataProvider } from '@/data-provider';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';
import { EarlyAccessService } from './early-access.service';

export const ShopService = {
  purchase: (payload: { itemId: string; method: 'lumo' | 'eur'; userId: string }) =>
    dataProvider.purchaseItem(payload),

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

  purchaseEarlyAccess: (eventId: string) => EarlyAccessService.purchase(eventId),
};
