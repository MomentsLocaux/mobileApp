import type { EventWithCreator } from '@/types/database';

export type LatLng = { latitude: number; longitude: number };

export type RoadtripWaypointKind = 'origin' | 'stop' | 'destination' | 'event';

export type RoadtripWaypoint = {
  kind: RoadtripWaypointKind;
  label: string;
  coordinate: LatLng;
  /** Presence window at a stop (ISO). Ignored for origin. */
  arrivalAt?: string | null;
  departureAt?: string | null;
  /** Set when kind === 'event' — the event added to the program. */
  eventId?: string;
};

/** GeoJSON positions [lon, lat] as returned by Mapbox Directions. */
export type LineStringCoordinates = [number, number][];

export type RoadtripLeg = {
  index: number;
  geometry: LineStringCoordinates;
  /** ISO — when the user leaves the start of this leg. */
  departureAt: string;
  durationSeconds: number;
  distanceMeters: number;
};

export type RoadtripRoute = {
  legs: RoadtripLeg[];
  totalDurationSeconds: number;
  totalDistanceMeters: number;
};

export const DETOUR_BUDGETS_MINUTES = [10, 20, 40] as const;
export type DetourBudgetMinutes = (typeof DETOUR_BUDGETS_MINUTES)[number];

export const MIN_ON_SITE_MINUTES = [45, 90, 180] as const;
export type MinOnSiteMinutes = (typeof MIN_ON_SITE_MINUTES)[number];

export type RoadtripSearchZone = 'route' | 'stops' | 'both';

export type RoadtripPreferences = {
  /** Category values (event.category). Empty array = all categories. */
  categoryValues: string[];
  detourBudgetMinutes: DetourBudgetMinutes;
  searchZone: RoadtripSearchZone;
  freeOnly: boolean;
  minOnSiteMinutes: MinOnSiteMinutes;
  /** False when the user gave a date without a time — results become “Horaire à confirmer”. */
  timeConfirmed: boolean;
};

export type CandidateOrigin =
  | { kind: 'leg'; legIndex: number }
  | { kind: 'stop'; stopLabel: string; distanceKm: number };

export type RoadtripCandidate = {
  event: EventWithCreator;
  origin: CandidateOrigin;
  /** 0..1 progression along the matched leg (0 for stop matches). */
  progression: number;
  distanceToRouteKm: number;
  estimatedDetourMinutes: number;
  /** ISO — estimated moment the user is closest to the event. */
  passageAt: string;
  presenceStartAt: string;
  presenceEndAt: string;
  approximateTime: boolean;
  score: number;
};

export const ROADTRIP_MAX_STOPS = 8;
export const ROADTRIP_MAX_DAYS = 14;
export const ROADTRIP_CANDIDATE_LIMIT = 40;
