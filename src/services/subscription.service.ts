import { supabase } from '@/lib/supabase/client';
import type { UserEntitlement } from '@/types/discovery.types';

/** Éclaireur (Discovery) — legacy product id kept for backend compatibility. */
export const ECLAIREUR_ENTITLEMENT = 'moments_locaux_plus';
export const DEFAULT_PREMIUM_ENTITLEMENT = ECLAIREUR_ENTITLEMENT;

/** Habitué (engagement) — client entitlement key; IAP wiring later. */
export const HABITUE_ENTITLEMENT = 'moments_locaux_habitue';

export const HABITUE_PLANS = {
  monthly: {
    productId: 'moments_locaux_habitue_monthly',
    label: 'Mensuel',
    priceLabel: '0,99 €',
    periodLabel: '/ mois',
  },
  annual: {
    productId: 'moments_locaux_habitue_annual',
    label: 'Annuel',
    priceLabel: '9,99 €',
    periodLabel: '/ an',
  },
} as const;

export const ECLAIREUR_PLANS = {
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

/** @deprecated Prefer ECLAIREUR_PLANS — kept for existing Discovery paywall imports. */
export const PREMIUM_PLANS = ECLAIREUR_PLANS;

const EMPTY_ENTITLEMENT = (entitlement: string): UserEntitlement => ({
  is_active: false,
  status: 'expired',
  entitlement,
  expires_at: null,
  auto_renew: false,
});

export const SubscriptionService = {
  async getEntitlement(entitlement = ECLAIREUR_ENTITLEMENT): Promise<UserEntitlement> {
    const { data, error } = await supabase.rpc('get_user_entitlement', {
      p_entitlement: entitlement,
    });

    if (error) throw new Error(error.message || 'Impossible de charger l’abonnement');
    if (!data || typeof data !== 'object') return EMPTY_ENTITLEMENT(entitlement);

    const row = data as UserEntitlement;
    return {
      is_active: row.is_active === true,
      status: row.status ?? 'expired',
      entitlement: row.entitlement ?? entitlement,
      expires_at: row.expires_at ?? null,
      auto_renew: row.auto_renew ?? false,
    };
  },

  /** Éclaireur includes Habitué (incremental stack). */
  hasEclaireur(eclaireur: UserEntitlement | null | undefined): boolean {
    return eclaireur?.is_active === true;
  },

  hasHabitue(
    habitue: UserEntitlement | null | undefined,
    eclaireur?: UserEntitlement | null,
  ): boolean {
    if (SubscriptionService.hasEclaireur(eclaireur)) return true;
    return habitue?.is_active === true;
  },
};
