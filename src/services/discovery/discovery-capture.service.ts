import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DISCOVERY_CAPTURE_CONFIG,
  EMPTY_CAPTURE_BUFFER,
  type CaptureBufferState,
  type CaptureSample,
  type PendingDiscoveryVisit,
} from './discovery-capture.types';

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pruneExpired(buffer: CaptureBufferState): CaptureBufferState {
  const cutoff = Date.now() - DISCOVERY_CAPTURE_CONFIG.bufferTtlMs;
  const samples = buffer.samples.filter((sample) => new Date(sample.recordedAt).getTime() >= cutoff);
  const pendingVisits = buffer.pendingVisits.filter(
    (visit) => new Date(visit.createdAt).getTime() >= cutoff,
  );
  return {
    ...buffer,
    samples,
    pendingVisits,
    activeStop:
      buffer.activeStop && new Date(buffer.activeStop.startedAt).getTime() >= cutoff
        ? buffer.activeStop
        : null,
    updatedAt: new Date().toISOString(),
  };
}

function inferTransportMode(speedMps: number | null): PendingDiscoveryVisit['transportMode'] {
  if (speedMps == null || !Number.isFinite(speedMps)) return 'unknown';
  if (speedMps < 0.6) return 'stationary';
  if (speedMps < 2.5) return 'walking';
  return 'unknown';
}

function finalizeStop(
  stop: NonNullable<CaptureBufferState['activeStop']>,
): PendingDiscoveryVisit {
  const durationMs = new Date(stop.lastSeenAt).getTime() - new Date(stop.startedAt).getTime();
  const durationMinutes = Math.max(1, Math.round(durationMs / 60_000));
  return {
    clientVisitId: `visit_${stop.startedAt}_${stop.centroidLat.toFixed(5)}_${stop.centroidLon.toFixed(5)}`,
    arrivedAt: stop.startedAt,
    departedAt: stop.lastSeenAt,
    latitude: stop.centroidLat,
    longitude: stop.centroidLon,
    durationMinutes,
    transportMode: 'stationary',
    confidence: Math.min(1, 0.35 + stop.sampleCount * 0.1),
    createdAt: new Date().toISOString(),
  };
}

async function readBuffer(): Promise<CaptureBufferState> {
  const raw = await AsyncStorage.getItem(DISCOVERY_CAPTURE_CONFIG.storageKey);
  if (!raw) return { ...EMPTY_CAPTURE_BUFFER };
  try {
    return pruneExpired(JSON.parse(raw) as CaptureBufferState);
  } catch {
    return { ...EMPTY_CAPTURE_BUFFER };
  }
}

async function writeBuffer(buffer: CaptureBufferState): Promise<void> {
  await AsyncStorage.setItem(
    DISCOVERY_CAPTURE_CONFIG.storageKey,
    JSON.stringify(pruneExpired(buffer)),
  );
}

export const DiscoveryCaptureService = {
  async getBuffer(): Promise<CaptureBufferState> {
    return readBuffer();
  },

  async clearBuffer(): Promise<void> {
    await AsyncStorage.removeItem(DISCOVERY_CAPTURE_CONFIG.storageKey);
  },

  async getPendingVisits(): Promise<PendingDiscoveryVisit[]> {
    const buffer = await readBuffer();
    return buffer.pendingVisits;
  },

  async consumePendingVisits(limit = DISCOVERY_CAPTURE_CONFIG.maxBatchSize): Promise<PendingDiscoveryVisit[]> {
    const buffer = await readBuffer();
    const batch = buffer.pendingVisits.slice(0, limit);
    const remaining = buffer.pendingVisits.slice(batch.length);
    await writeBuffer({ ...buffer, pendingVisits: remaining });
    return batch;
  },

  async requeuePendingVisits(visits: PendingDiscoveryVisit[]): Promise<void> {
    if (visits.length === 0) return;
    const buffer = await readBuffer();
    await writeBuffer({
      ...buffer,
      pendingVisits: [...visits, ...buffer.pendingVisits],
    });
  },

  async recordSample(input: {
    latitude: number;
    longitude: number;
    recordedAt?: string;
    speedMps?: number | null;
  }): Promise<{ visitCreated: boolean; pendingCount: number }> {
    const recordedAt = input.recordedAt ?? new Date().toISOString();
    const sample: CaptureSample = {
      latitude: input.latitude,
      longitude: input.longitude,
      recordedAt,
      speedMps: input.speedMps ?? null,
    };

    let buffer = await readBuffer();
    buffer.samples = [...buffer.samples, sample].slice(-200);

    const radius = DISCOVERY_CAPTURE_CONFIG.clusterRadiusMeters;
    const nowMs = new Date(recordedAt).getTime();

    if (!buffer.activeStop) {
      buffer.activeStop = {
        centroidLat: sample.latitude,
        centroidLon: sample.longitude,
        startedAt: recordedAt,
        lastSeenAt: recordedAt,
        sampleCount: 1,
      };
      await writeBuffer(buffer);
      return { visitCreated: false, pendingCount: buffer.pendingVisits.length };
    }

    const distance = haversineMeters(
      buffer.activeStop.centroidLat,
      buffer.activeStop.centroidLon,
      sample.latitude,
      sample.longitude,
    );

    if (distance <= radius) {
      const count = buffer.activeStop.sampleCount + 1;
      buffer.activeStop = {
        centroidLat:
          (buffer.activeStop.centroidLat * buffer.activeStop.sampleCount + sample.latitude) / count,
        centroidLon:
          (buffer.activeStop.centroidLon * buffer.activeStop.sampleCount + sample.longitude) / count,
        startedAt: buffer.activeStop.startedAt,
        lastSeenAt: recordedAt,
        sampleCount: count,
      };

      const durationMs = nowMs - new Date(buffer.activeStop.startedAt).getTime();
      if (durationMs >= DISCOVERY_CAPTURE_CONFIG.minStopDurationMs) {
        const visit = finalizeStop(buffer.activeStop);
        visit.transportMode = inferTransportMode(sample.speedMps);
        buffer.pendingVisits = [...buffer.pendingVisits, visit];
        buffer.activeStop = null;
        await writeBuffer(buffer);
        return { visitCreated: true, pendingCount: buffer.pendingVisits.length };
      }

      await writeBuffer(buffer);
      return { visitCreated: false, pendingCount: buffer.pendingVisits.length };
    }

    const elapsed = nowMs - new Date(buffer.activeStop.startedAt).getTime();
    if (elapsed >= DISCOVERY_CAPTURE_CONFIG.minStopDurationMs) {
      const visit = finalizeStop(buffer.activeStop);
      buffer.pendingVisits = [...buffer.pendingVisits, visit];
    }

    buffer.activeStop = {
      centroidLat: sample.latitude,
      centroidLon: sample.longitude,
      startedAt: recordedAt,
      lastSeenAt: recordedAt,
      sampleCount: 1,
    };

    await writeBuffer(buffer);
    return {
      visitCreated: elapsed >= DISCOVERY_CAPTURE_CONFIG.minStopDurationMs,
      pendingCount: buffer.pendingVisits.length,
    };
  },

  async getLastSyncAt(): Promise<number | null> {
    const raw = await AsyncStorage.getItem(DISCOVERY_CAPTURE_CONFIG.lastSyncKey);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  },

  async setLastSyncAt(timestamp = Date.now()): Promise<void> {
    await AsyncStorage.setItem(DISCOVERY_CAPTURE_CONFIG.lastSyncKey, String(timestamp));
  },

  async shouldSync(now = Date.now()): Promise<boolean> {
    const last = await this.getLastSyncAt();
    if (last == null) return true;
    return now - last >= DISCOVERY_CAPTURE_CONFIG.syncIntervalMs;
  },
};
