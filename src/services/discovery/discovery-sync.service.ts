import { supabase } from '@/lib/supabase/client';
import { DISCOVERY_CONSENT_VERSION } from '@/services/discovery/discovery-consent.service';
import { DiscoveryCaptureService } from '@/services/discovery/discovery-capture.service';
import type { PendingDiscoveryVisit } from '@/services/discovery/discovery-capture.types';

export type DiscoveryIngestResult = {
  success: boolean;
  inserted?: number;
  skipped?: number;
  message?: string;
};

export const DiscoverySyncService = {
  async uploadVisits(visits: PendingDiscoveryVisit[]): Promise<DiscoveryIngestResult> {
    if (visits.length === 0) {
      return { success: true, inserted: 0, skipped: 0 };
    }

    const { data, error } = await supabase.functions.invoke<DiscoveryIngestResult>('discovery-ingest', {
      body: {
        consentVersion: DISCOVERY_CONSENT_VERSION,
        visits: visits.map((visit) => ({
          clientVisitId: visit.clientVisitId,
          arrivedAt: visit.arrivedAt,
          departedAt: visit.departedAt,
          latitude: visit.latitude,
          longitude: visit.longitude,
          durationMinutes: visit.durationMinutes,
          transportMode: visit.transportMode,
          confidence: visit.confidence,
        })),
      },
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return data ?? { success: false, message: 'empty_response' };
  },

  async syncPendingBatch(): Promise<DiscoveryIngestResult> {
    const visits = await DiscoveryCaptureService.consumePendingVisits();
    if (visits.length === 0) {
      return { success: true, inserted: 0, skipped: 0 };
    }

    const result = await this.uploadVisits(visits);
    if (!result.success) {
      await DiscoveryCaptureService.requeuePendingVisits(visits);
      return result;
    }

    await DiscoveryCaptureService.setLastSyncAt();
    return result;
  },

  async syncIfDue(): Promise<DiscoveryIngestResult | null> {
    const due = await DiscoveryCaptureService.shouldSync();
    if (!due) return null;
    const pending = await DiscoveryCaptureService.getPendingVisits();
    if (pending.length === 0) return null;
    return this.syncPendingBatch();
  },
};
