import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DiffuseurService } from '@/services/diffuseur.service';
import {
  DIFFUSEUR_PLANS,
  DIFFUSEUR_SKUS,
  type DiffuseurBillingLedgerRow,
  type DiffuseurSku,
  type OrganizationRow,
} from '@/constants/diffuseur';
import { getAccountKind } from '@/utils/accountIdentity';

export function useDiffuseur() {
  const { profile } = useAuth();
  const isProfessionnel = getAccountKind(profile) === 'professionnel';
  const [organization, setOrganization] = useState<OrganizationRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [ledger, setLedger] = useState<DiffuseurBillingLedgerRow[]>([]);
  const [applyingSku, setApplyingSku] = useState(false);

  const refresh = useCallback(async () => {
    if (!isProfessionnel) {
      setOrganization(null);
      setMemberCount(0);
      setLedger([]);
      return;
    }
    setLoading(true);
    try {
      let org = await DiffuseurService.getMyOrganization();
      if (!org) {
        try {
          org = await DiffuseurService.ensureMyOrganization({
            displayName: profile?.display_name,
            proSubtype: (profile?.pro_subtype as OrganizationRow['pro_subtype']) ?? null,
          });
        } catch (err) {
          console.warn('ensureMyOrganization', err);
        }
      }
      setOrganization(org);
      if (org) {
        const [members, entries] = await Promise.all([
          DiffuseurService.listMembers(org.id),
          DiffuseurService.listBillingLedger(org.id),
        ]);
        setMemberCount(members.length);
        setLedger(entries);
      } else {
        setMemberCount(0);
        setLedger([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isProfessionnel, profile?.display_name, profile?.pro_subtype]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const plan = organization?.diffuseur_plan ?? 'free';
  const entitlements = useMemo(() => DIFFUSEUR_PLANS[plan], [plan]);

  const applySkuMock = useCallback(
    async (sku: DiffuseurSku) => {
      if (!organization?.id) throw new Error('Organisation introuvable');
      setApplyingSku(true);
      try {
        const amount = DIFFUSEUR_SKUS[sku]?.amountCentsHt ?? null;
        const result = await DiffuseurService.applySkuMock(organization.id, sku, amount);
        await refresh();
        return result;
      } finally {
        setApplyingSku(false);
      }
    },
    [organization?.id, refresh]
  );

  return {
    isProfessionnel,
    organization,
    loading,
    memberCount,
    plan,
    entitlements,
    isPro: plan === 'pro',
    ledger,
    applyingSku,
    applySkuMock,
    refresh,
  };
}
