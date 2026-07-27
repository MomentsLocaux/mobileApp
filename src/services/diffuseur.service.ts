import { supabase } from '@/lib/supabase/client';
import {
  DIFFUSEUR_PLANS,
  type DiffuseurPlan,
  type OrganizationMemberRow,
  type OrganizationRow,
} from '@/constants/diffuseur';

function isMissingRelationError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
}

export class DiffuseurService {
  /** Own org (V1 owner) or first membership org. */
  static async getMyOrganization(): Promise<OrganizationRow | null> {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return null;

    const asOwner = await (supabase.from('organizations') as any)
      .select('*')
      .eq('owner_id', userId)
      .maybeSingle();

    if (!asOwner.error && asOwner.data) {
      return asOwner.data as OrganizationRow;
    }
    if (asOwner.error && !isMissingRelationError(asOwner.error)) {
      console.warn('DiffuseurService.getMyOrganization owner', asOwner.error);
    }
    if (isMissingRelationError(asOwner.error)) return null;

    const membership = await (supabase.from('organization_members') as any)
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (membership.error || !membership.data?.organization_id) return null;

    const org = await (supabase.from('organizations') as any)
      .select('*')
      .eq('id', membership.data.organization_id)
      .maybeSingle();

    if (org.error || !org.data) return null;
    return org.data as OrganizationRow;
  }

  static async listMembers(organizationId: string): Promise<OrganizationMemberRow[]> {
    const { data, error } = await (supabase.from('organization_members') as any)
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (error) {
      if (!isMissingRelationError(error)) console.warn('listMembers', error);
      return [];
    }
    return (data || []) as OrganizationMemberRow[];
  }

  static planEntitlements(plan: DiffuseurPlan) {
    return DIFFUSEUR_PLANS[plan];
  }

  static isPro(org: OrganizationRow | null | undefined): boolean {
    return org?.diffuseur_plan === 'pro';
  }
}
