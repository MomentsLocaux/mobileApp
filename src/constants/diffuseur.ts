/**
 * Moments Diffuseur (ADR_006) — Free / Pro entitlements + billing SKUs stub.
 */

export type DiffuseurPlan = 'free' | 'pro';

export type DiffuseurBillingProvider = 'mock' | 'stripe' | 'manual_devis' | 'system';

export type DiffuseurSku =
  | 'diffuseur_pro_monthly'
  | 'diffuseur_pro_annual'
  | 'diffuseur_free'
  | 'pack_boost_express'
  | 'pack_weekend_fort'
  | 'pack_campagne_quartier'
  | 'pack_siege_extra';

export const DIFFUSEUR_PLANS: Record<
  DiffuseurPlan,
  {
    label: string;
    seatLimit: number;
    boostCreditsMonthly: number;
    earlyAccessSlotsMonthly: number;
    verifiedEligible: boolean;
    priorityModeration: boolean;
    advancedAnalytics: boolean;
    priceLabel?: string;
  }
> = {
  free: {
    label: 'Diffuseur Gratuit',
    seatLimit: 1,
    boostCreditsMonthly: 0,
    earlyAccessSlotsMonthly: 0,
    verifiedEligible: false,
    priorityModeration: false,
    advancedAnalytics: false,
  },
  pro: {
    label: 'Diffuseur Pro',
    seatLimit: 5,
    boostCreditsMonthly: 2,
    earlyAccessSlotsMonthly: 2,
    verifiedEligible: true,
    priorityModeration: true,
    advancedAnalytics: true,
    priceLabel: '29 € HT/mois ou 290 € HT/an',
  },
};

/** Catalog ready for Stripe Price IDs later (stripePriceId placeholder). */
export const DIFFUSEUR_SKUS: Record<
  DiffuseurSku,
  {
    label: string;
    description: string;
    amountCentsHt: number | null;
    kind: 'subscription' | 'pack' | 'downgrade';
    stripePriceIdEnv?: string;
    proOnly?: boolean;
  }
> = {
  diffuseur_pro_monthly: {
    label: 'Diffuseur Pro — mensuel',
    description: '5 sièges, 2 boosts / mois, analytics, early-access.',
    amountCentsHt: 2900,
    kind: 'subscription',
    stripePriceIdEnv: 'EXPO_PUBLIC_STRIPE_PRICE_DIFFUSEUR_PRO_MONTHLY',
  },
  diffuseur_pro_annual: {
    label: 'Diffuseur Pro — annuel',
    description: 'Même offre Pro, −17 % (290 € HT/an).',
    amountCentsHt: 29000,
    kind: 'subscription',
    stripePriceIdEnv: 'EXPO_PUBLIC_STRIPE_PRICE_DIFFUSEUR_PRO_ANNUAL',
  },
  diffuseur_free: {
    label: 'Repasser en Gratuit',
    description: 'Simulation downgrade (1 siège, plus de crédits mensuels).',
    amountCentsHt: null,
    kind: 'downgrade',
  },
  pack_boost_express: {
    label: 'Boost Express',
    description: '1× Boost 24h',
    amountCentsHt: 900,
    kind: 'pack',
    stripePriceIdEnv: 'EXPO_PUBLIC_STRIPE_PRICE_PACK_BOOST_EXPRESS',
  },
  pack_weekend_fort: {
    label: 'Week-end fort',
    description: '1× Boost 72h + Highlight 7j',
    amountCentsHt: 2400,
    kind: 'pack',
    stripePriceIdEnv: 'EXPO_PUBLIC_STRIPE_PRICE_PACK_WEEKEND_FORT',
  },
  pack_campagne_quartier: {
    label: 'Campagne quartier',
    description: '3× Boost 24h + Highlight + pin carte 7j',
    amountCentsHt: 7900,
    kind: 'pack',
    stripePriceIdEnv: 'EXPO_PUBLIC_STRIPE_PRICE_PACK_CAMPAGNE',
  },
  pack_siege_extra: {
    label: 'Siège extra',
    description: '+1 siège (Pro uniquement)',
    amountCentsHt: 600,
    kind: 'pack',
    proOnly: true,
    stripePriceIdEnv: 'EXPO_PUBLIC_STRIPE_PRICE_PACK_SIEGE_EXTRA',
  },
};

export type OrganizationRow = {
  id: string;
  owner_id: string;
  name: string;
  pro_subtype:
    | 'independant'
    | 'association'
    | 'lieu'
    | 'office_tourisme'
    | 'collectivite'
    | null;
  diffuseur_plan: DiffuseurPlan;
  seat_limit: number;
  verified_at: string | null;
  boost_credits_balance: number;
  highlight_credits_balance?: number;
  early_access_slots_monthly: number;
  billing_provider?: DiffuseurBillingProvider | null;
  billing_external_id?: string | null;
  current_period_end?: string | null;
  boost_credits_period_ym?: string | null;
  connector_status?:
    | 'none'
    | 'sit_pending'
    | 'sit_connected'
    | 'custom_requested'
    | 'custom_active'
    | null;
  sit_provider?: string | null;
  connector_request?: Record<string, unknown> | null;
  connector_requested_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationMemberRow = {
  id: string;
  organization_id: string;
  user_id: string;
  member_role: 'admin' | 'editor';
  created_at: string;
};

export type DiffuseurBillingLedgerRow = {
  id: string;
  organization_id: string;
  sku: string;
  provider: DiffuseurBillingProvider;
  external_id: string | null;
  amount_cents_ht: number | null;
  currency: string;
  status: string;
  effects: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Future web portal; empty = mock-only until Stripe Checkout is wired. */
export const DIFFUSEUR_BILLING_PORTAL_URL =
  process.env.EXPO_PUBLIC_DIFFUSEUR_BILLING_URL?.trim() || '';
