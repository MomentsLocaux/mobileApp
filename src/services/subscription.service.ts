import { supabase } from '@/lib/supabase/client';
import type { UserEntitlement } from '@/types/discovery.types';

export const DEFAULT_PREMIUM_ENTITLEMENT = 'moments_locaux_plus';

export const PREMIUM_PLANS = {
  monthly: {
    productId: 'moments_locaux_plus_monthly',
    label: 'Mensuel',
    priceLabel: '2,99 €',
    periodLabel: '/ mois',
  },
  annual: {
    productId: 'moments_locaux_plus_annual',
    label: 'Annuel',
    priceLabel: '19,99 €',
    periodLabel: '/ an',
  },
} as const;

const EMPTY_ENTITLEMENT: UserEntitlement = {
  is_active: false,
  status: 'expired',
  entitlement: DEFAULT_PREMIUM_ENTITLEMENT,
  expires_at: null,
  auto_renew: false,
};

export const SubscriptionService = {
  async getEntitlement(entitlement = DEFAULT_PREMIUM_ENTITLEMENT): Promise<UserEntitlement> {
    const { data, error } = await supabase.rpc('get_user_entitlement', {
      p_entitlement: entitlement,
    });

    if (error) throw new Error(error.message || 'Impossible de charger l’abonnement');
    if (!data || typeof data !== 'object') return { ...EMPTY_ENTITLEMENT, entitlement };

    const row = data as UserEntitlement;
    return {
      is_active: row.is_active === true,
      status: row.status ?? 'expired',
      entitlement: row.entitlement ?? entitlement,
      expires_at: row.expires_at ?? null,
      auto_renew: row.auto_renew ?? false,
    };
  },
};
