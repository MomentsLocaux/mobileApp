import { Linking } from 'react-native';
import { supabase } from '@/lib/supabase/client';
import {
  DIFFUSEUR_BILLING_PORTAL_URL,
  DIFFUSEUR_PLANS,
  type DiffuseurBillingLedgerRow,
  type DiffuseurPlan,
  type DiffuseurSku,
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
    msg.includes('could not find the table') ||
    msg.includes('could not find the function')
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

  /**
   * V1: one Free org per professionnel owner. Creates if missing (post-onboarding race).
   */
  static async ensureMyOrganization(input: {
    displayName?: string | null;
    proSubtype?: OrganizationRow['pro_subtype'];
  }): Promise<OrganizationRow | null> {
    const existing = await this.getMyOrganization();
    if (existing) return existing;

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return null;

    const name =
      (input.displayName && input.displayName.trim()) || 'Mon organisation';

    const inserted = await (supabase.from('organizations') as any)
      .insert({
        owner_id: userId,
        name,
        pro_subtype: input.proSubtype ?? null,
        diffuseur_plan: 'free',
        seat_limit: 1,
      })
      .select('*')
      .single();

    if (inserted.error) {
      if (isMissingRelationError(inserted.error)) return null;
      // Unique owner race — re-read
      const again = await this.getMyOrganization();
      if (again) return again;
      console.warn('ensureMyOrganization insert', inserted.error);
      throw new Error(inserted.error.message || 'Impossible de créer l’organisation');
    }

    const org = inserted.data as OrganizationRow;

    const member = await (supabase.from('organization_members') as any).insert({
      organization_id: org.id,
      user_id: userId,
      member_role: 'admin',
    });

    if (member.error && !isMissingRelationError(member.error)) {
      console.warn('ensureMyOrganization member', member.error);
    }

    return org;
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

  static async listBillingLedger(
    organizationId: string,
    limit = 20
  ): Promise<DiffuseurBillingLedgerRow[]> {
    const { data, error } = await (supabase.from('diffuseur_billing_ledger') as any)
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (!isMissingRelationError(error)) console.warn('listBillingLedger', error);
      return [];
    }
    return (data || []) as DiffuseurBillingLedgerRow[];
  }

  static planEntitlements(plan: DiffuseurPlan) {
    return DIFFUSEUR_PLANS[plan];
  }

  static isPro(org: OrganizationRow | null | undefined): boolean {
    return org?.diffuseur_plan === 'pro';
  }

  /**
   * DIFF-BILL stub: applies SKU via RPC (provider=mock).
   * When Stripe is live, Checkout webhook will call the same RPC with provider=stripe.
   */
  static async applySkuMock(
    organizationId: string,
    sku: DiffuseurSku,
    amountCentsHt?: number | null
  ): Promise<{ success: boolean; effects?: Record<string, unknown> }> {
    const { data, error } = await supabase.rpc('apply_diffuseur_sku', {
      p_organization_id: organizationId,
      p_sku: sku,
      p_provider: 'mock',
      p_external_id: `mock_${sku}_${Date.now()}`,
      p_amount_cents_ht: amountCentsHt ?? null,
      p_metadata: { channel: 'mobile_dev_mock' },
    } as any);

    if (error) {
      if (isMissingRelationError(error)) {
        throw new Error('Migration DIFF-BILL non appliquée sur cet environnement.');
      }
      throw new Error(error.message || 'Impossible d’appliquer le SKU');
    }
    return (data || { success: true }) as {
      success: boolean;
      effects?: Record<string, unknown>;
    };
  }

  static async consumeBoostCredit(
    organizationId: string,
    eventId: string,
    hours = 24
  ): Promise<{ success: boolean; expires_at?: string; boost_credits_remaining?: number }> {
    const { data, error } = await supabase.rpc('consume_diffuseur_boost_credit', {
      p_organization_id: organizationId,
      p_event_id: eventId,
      p_hours: hours,
    } as any);

    if (error) {
      if (isMissingRelationError(error)) {
        throw new Error('Migration DIFF-PRO non appliquée sur cet environnement.');
      }
      throw new Error(error.message || 'Impossible de consommer le crédit boost');
    }
    return (data || { success: true }) as {
      success: boolean;
      expires_at?: string;
      boost_credits_remaining?: number;
    };
  }

  /**
   * Persist connector lead / SIT pending on org (migration 20260806).
   * No-op friendly if columns missing.
   */
  static async updateConnector(
    organizationId: string,
    draft: {
      status: string;
      sitProvider?: string | null;
      tool?: string;
      url?: string;
      contact?: string;
      notes?: string;
    },
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      connector_status: draft.status,
      connector_requested_at: new Date().toISOString(),
    };
    if (draft.status === 'sit_pending' || draft.status === 'sit_connected') {
      payload.sit_provider = draft.sitProvider || 'apidae';
      payload.connector_request = null;
    } else if (draft.status === 'custom_requested') {
      payload.connector_request = {
        tool: draft.tool || null,
        url: draft.url || null,
        contact: draft.contact || null,
        notes: draft.notes || null,
      };
    }

    const { error } = await (supabase.from('organizations') as any)
      .update(payload)
      .eq('id', organizationId);

    if (error) {
      if (isMissingRelationError(error)) {
        console.warn('updateConnector: connector columns unavailable');
        return;
      }
      throw new Error(error.message || 'Impossible d’enregistrer le connecteur');
    }
  }

  /** Opens web billing portal when configured; otherwise returns false (use mock). */
  static async openBillingPortal(): Promise<boolean> {
    if (!DIFFUSEUR_BILLING_PORTAL_URL) return false;
    await Linking.openURL(DIFFUSEUR_BILLING_PORTAL_URL);
    return true;
  }
}
