import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DiffuseurService } from '@/services/diffuseur.service';
import { DIFFUSEUR_PLANS, type OrganizationRow } from '@/constants/diffuseur';
import { getAccountKind } from '@/utils/accountIdentity';

export function useDiffuseur() {
  const { profile } = useAuth();
  const isProfessionnel = getAccountKind(profile) === 'professionnel';
  const [organization, setOrganization] = useState<OrganizationRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [memberCount, setMemberCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isProfessionnel) {
      setOrganization(null);
      setMemberCount(0);
      return;
    }
    setLoading(true);
    try {
      const org = await DiffuseurService.getMyOrganization();
      setOrganization(org);
      if (org) {
        const members = await DiffuseurService.listMembers(org.id);
        setMemberCount(members.length);
      } else {
        setMemberCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, [isProfessionnel]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const plan = organization?.diffuseur_plan ?? 'free';
  const entitlements = useMemo(() => DIFFUSEUR_PLANS[plan], [plan]);

  return {
    isProfessionnel,
    organization,
    loading,
    memberCount,
    plan,
    entitlements,
    isPro: plan === 'pro',
    refresh,
  };
}
