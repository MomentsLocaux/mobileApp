import { supabase } from '@/lib/supabase/client';
import type {
  DiscoveryConsent,
  PurgeDiscoveryDataResult,
  UpsertDiscoveryConsentInput,
} from '@/types/discovery.types';

export const DISCOVERY_CONSENT_VERSION = '1.0';

export const DiscoveryConsentService = {
  async getMine(): Promise<DiscoveryConsent | null> {
    const { data, error } = await supabase
      .from('discovery_consents')
      .select('*')
      .maybeSingle();

    if (error) throw new Error(error.message || 'Impossible de charger le consentement Discovery');
    return (data as DiscoveryConsent | null) ?? null;
  },

  async upsert(input: UpsertDiscoveryConsentInput): Promise<DiscoveryConsent> {
    const { data, error } = await supabase.rpc('upsert_discovery_consent', {
      p_enabled: input.enabled,
      p_location_enabled: input.location_enabled ?? false,
      p_motion_enabled: input.motion_enabled ?? false,
      p_personalization_enabled: input.personalization_enabled ?? false,
      p_consent_version: input.consent_version ?? DISCOVERY_CONSENT_VERSION,
    });

    if (error) throw new Error(error.message || 'Impossible de mettre à jour le consentement');
    return data as DiscoveryConsent;
  },

  async revoke(): Promise<DiscoveryConsent> {
    return this.upsert({
      enabled: false,
      location_enabled: false,
      motion_enabled: false,
      personalization_enabled: false,
    });
  },

  async activatePersonalization(): Promise<DiscoveryConsent> {
    return this.upsert({
      enabled: true,
      location_enabled: false,
      motion_enabled: false,
      personalization_enabled: true,
    });
  },

  async enableLocationCapture(): Promise<DiscoveryConsent> {
    return this.upsert({
      enabled: true,
      location_enabled: true,
      motion_enabled: false,
      personalization_enabled: true,
    });
  },

  async disableLocationCapture(): Promise<DiscoveryConsent> {
    const current = await this.getMine();
    return this.upsert({
      enabled: current?.enabled ?? true,
      location_enabled: false,
      motion_enabled: false,
      personalization_enabled: current?.personalization_enabled ?? true,
    });
  },

  async purgeMine(): Promise<PurgeDiscoveryDataResult> {
    const { data, error } = await supabase.rpc('purge_discovery_data');
    if (error) throw new Error(error.message || 'Impossible de supprimer les données Discovery');
    return data as PurgeDiscoveryDataResult;
  },
};
