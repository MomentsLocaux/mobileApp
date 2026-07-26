/** PUSH-P0-003 — sparse location updates for live/soon approach alerts. */

export const PROXIMITY_ALERT_TASK = 'proximity-live-alerts';

export const PROXIMITY_ALERT_CONFIG = {
  /** Detection radius passed to RPC (meters). */
  radiusMeters: 500,
  /** Events starting within this horizon count as "soon". */
  soonHours: 3,
  /** Minimum movement before OS delivers another sample. */
  distanceIntervalMeters: 250,
  /** Soft throttle between RPC calls (client-side). */
  minIntervalMs: 5 * 60 * 1000,
  /** Skip RPC if we have not moved at least this far since last check. */
  minMoveMeters: 120,
} as const;
