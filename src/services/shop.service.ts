import { supabase } from '@/lib/supabase/client';
import { dataProvider } from '@/data-provider';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';
import { EarlyAccessService } from './early-access.service';

export type ShopRayon = 'visibility' | 'access' | 'style';

export type ShopItemRow = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  price: number;
  type: string;
  data: Record<string, unknown> | null;
  rayon: ShopRayon;
  requiresCanCreate: boolean;
  minEntitlement: 'habitue' | 'eclaireur' | null;
  sortiesEstimate: number;
};

const CHECKIN_BASE_LUMO = 20;

function parseRayon(data: Record<string, unknown> | null, key: string): ShopRayon {
  const r = data?.rayon;
  if (r === 'visibility' || r === 'access' || r === 'style') return r;
  if (key.includes('boost') || key.includes('highlight')) return 'visibility';
  if (key.includes('early') || key.includes('pass')) return 'access';
  return 'style';
}

export const SHOP_RAYON_LABELS: Record<ShopRayon, string> = {
  visibility: 'Visibilité',
  access: 'Accès',
  style: 'Style',
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
    return (data || []).map((row: any) => {
      const payload = (row.data || {}) as Record<string, unknown>;
      const price = Number(row.price) || 0;
      return {
        id: row.id,
        key: row.key,
        title: row.title,
        description: row.description,
        price,
        type: row.type,
        data: payload,
        rayon: parseRayon(payload, row.key),
        requiresCanCreate: Boolean(payload.requires_can_create),
        minEntitlement:
          payload.min_entitlement === 'eclaireur' || payload.min_entitlement === 'habitue'
            ? payload.min_entitlement
            : null,
        sortiesEstimate: Math.max(1, Math.ceil(price / CHECKIN_BASE_LUMO)),
      } as ShopItemRow;
    });
  },

  async buyItem(itemKey: string): Promise<{ success: boolean; quantity?: number }> {
    if (!GAMIFICATION_ENABLED) throw new Error('GAMIFICATION_DISABLED');
    const { data, error } = await supabase.rpc('buy_item', { p_item_key: itemKey });
    if (error) throw new Error(error.message || 'Achat impossible');
    return (data || { success: false }) as { success: boolean; quantity?: number };
  },

  async purchaseEventBoost(
    eventId: string,
    itemKey: 'event_boost_24h' | 'event_boost_72h' = 'event_boost_24h',
  ): Promise<{
    success: boolean;
    boost_id?: string;
    expires_at?: string;
    price?: number;
    duration_hours?: number;
    item_key?: string;
  }> {
    if (!GAMIFICATION_ENABLED) {
      throw new Error('GAMIFICATION_DISABLED');
    }
    const { data, error } = await supabase.rpc('purchase_event_boost', {
      p_event_id: eventId,
      p_item_key: itemKey,
    });
    if (error) throw new Error(error.message || 'Impossible d’acheter le boost');
    return (data || { success: false }) as {
      success: boolean;
      boost_id?: string;
      expires_at?: string;
      price?: number;
      duration_hours?: number;
      item_key?: string;
    };
  },

  purchaseEarlyAccess: (eventId: string) => EarlyAccessService.purchase(eventId),
};
