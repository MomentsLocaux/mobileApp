/**
 * Moments Diffuseur (ADR_006) — Free / Pro entitlements matrix.
 */

export type DiffuseurPlan = 'free' | 'pro';

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
  early_access_slots_monthly: number;
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
