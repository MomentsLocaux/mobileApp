export const DISCOVERY_CAPTURE_TASK = 'discovery-background-location';

export const DISCOVERY_CAPTURE_CONFIG = {
  minStopDurationMs: 12 * 60 * 1000,
  clusterRadiusMeters: 120,
  sampleIntervalMs: 5 * 60 * 1000,
  distanceIntervalMeters: 50,
  maxBatchSize: 20,
  syncIntervalMs: 15 * 60 * 1000,
  bufferTtlMs: 24 * 60 * 60 * 1000,
  storageKey: 'discovery_capture_buffer_v1',
  lastSyncKey: 'discovery_capture_last_sync_v1',
} as const;

export type PendingDiscoveryVisit = {
  clientVisitId: string;
  arrivedAt: string;
  departedAt?: string;
  latitude: number;
  longitude: number;
  durationMinutes: number;
  transportMode: 'walking' | 'stationary' | 'unknown';
  confidence: number;
  createdAt: string;
};

export type CaptureSample = {
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedMps: number | null;
};

export type CaptureBufferState = {
  samples: CaptureSample[];
  activeStop: {
    centroidLat: number;
    centroidLon: number;
    startedAt: string;
    lastSeenAt: string;
    sampleCount: number;
  } | null;
  pendingVisits: PendingDiscoveryVisit[];
  updatedAt: string;
};

export const EMPTY_CAPTURE_BUFFER: CaptureBufferState = {
  samples: [],
  activeStop: null,
  pendingVisits: [],
  updatedAt: new Date().toISOString(),
};
