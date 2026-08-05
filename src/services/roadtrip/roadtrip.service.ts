import { supabase } from '@/lib/supabase/client';
import type {
  DetourBudgetMinutes,
  MinOnSiteMinutes,
  RoadtripPreferences,
  RoadtripSearchZone,
  RoadtripWaypoint,
} from '@/screens/roadtrip/roadtrip.types';
import type { PlannedEventStop } from '@/screens/roadtrip/roadtrip-program';

export type RoadtripStatus = 'draft' | 'active' | 'archived';

export type StoredRoadtripPreferences = {
  categoryIds: string[];
  detourBudgetMinutes: DetourBudgetMinutes;
  searchZone: RoadtripSearchZone;
  freeOnly: boolean;
  minOnSiteMinutes: MinOnSiteMinutes;
  timeConfirmed: boolean;
};

export type RoadtripSummary = {
  id: string;
  name: string;
  departureAt: string;
  status: RoadtripStatus;
  preferences: StoredRoadtripPreferences;
  updatedAt: string;
};

export type RoadtripDetail = RoadtripSummary & {
  waypoints: RoadtripWaypoint[];
  plannedEvents: PlannedEventStop[];
};

type RoadtripRow = {
  id: string;
  name: string;
  departure_at: string;
  status: RoadtripStatus;
  preferences: StoredRoadtripPreferences | null;
  updated_at: string;
};

type StopRow = {
  id: string;
  position: number;
  kind: RoadtripWaypoint['kind'];
  label: string;
  latitude: number;
  longitude: number;
  arrival_at: string | null;
  departure_at: string | null;
  event_id: string | null;
};

type EventRow = {
  event_id: string;
  leg_index: number;
  planned_arrival_at: string | null;
  planned_duration_minutes: number | null;
  estimated_detour_minutes: number | null;
  status: 'planned' | 'removed';
};

const defaultPreferences = (): StoredRoadtripPreferences => ({
  categoryIds: [],
  detourBudgetMinutes: 20,
  searchZone: 'both',
  freeOnly: false,
  minOnSiteMinutes: 90,
  timeConfirmed: true,
});

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) throw new Error('Connexion requise pour sauvegarder un roadtrip.');
  return data.user.id;
}

function rowToSummary(row: RoadtripRow): RoadtripSummary {
  return {
    id: row.id,
    name: row.name,
    departureAt: row.departure_at,
    status: row.status,
    preferences: { ...defaultPreferences(), ...(row.preferences ?? {}) },
    updatedAt: row.updated_at,
  };
}

export const RoadtripService = {
  async listMine(): Promise<RoadtripSummary[]> {
    await requireUserId();
    const { data, error } = await supabase
      .from('roadtrips')
      .select('id, name, departure_at, status, preferences, updated_at')
      .neq('status', 'archived')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as RoadtripRow[]).map(rowToSummary);
  },

  async getDetail(roadtripId: string): Promise<RoadtripDetail> {
    await requireUserId();
    const [
      { data: trip, error: tripError },
      { data: stops, error: stopsError },
      { data: events, error: eventsError },
    ] = await Promise.all([
      supabase
        .from('roadtrips')
        .select('id, name, departure_at, status, preferences, updated_at')
        .eq('id', roadtripId)
        .maybeSingle(),
      supabase
        .from('roadtrip_stops')
        .select('id, position, kind, label, latitude, longitude, arrival_at, departure_at, event_id')
        .eq('roadtrip_id', roadtripId)
        .order('position', { ascending: true }),
      supabase
        .from('roadtrip_events')
        .select(
          'event_id, leg_index, planned_arrival_at, planned_duration_minutes, estimated_detour_minutes, status',
        )
        .eq('roadtrip_id', roadtripId)
        .eq('status', 'planned'),
    ]);
    if (tripError) throw tripError;
    if (stopsError) throw stopsError;
    if (eventsError) throw eventsError;
    if (!trip) throw new Error('Roadtrip introuvable.');

    const stopRows = (stops ?? []) as StopRow[];
    const eventRows = (events ?? []) as EventRow[];
    const eventMeta = new Map(eventRows.map((row) => [row.event_id, row]));

    const waypoints: RoadtripWaypoint[] = stopRows.map((stop) => ({
      kind: stop.kind,
      label: stop.label,
      coordinate: { latitude: stop.latitude, longitude: stop.longitude },
      arrivalAt: stop.arrival_at,
      departureAt: stop.departure_at,
      eventId: stop.event_id ?? undefined,
    }));

    const plannedEvents: PlannedEventStop[] = stopRows
      .filter((stop) => stop.kind === 'event' && stop.event_id)
      .map((stop) => {
        const meta = eventMeta.get(stop.event_id!);
        return {
          eventId: stop.event_id!,
          label: stop.label,
          latitude: stop.latitude,
          longitude: stop.longitude,
          arrivalAt: meta?.planned_arrival_at ?? stop.arrival_at ?? '',
          departureAt: stop.departure_at ?? '',
          legIndex: meta?.leg_index ?? 0,
          estimatedDetourMinutes: meta?.estimated_detour_minutes ?? 0,
          plannedDurationMinutes: meta?.planned_duration_minutes ?? 90,
        };
      });

    return {
      ...rowToSummary(trip as RoadtripRow),
      waypoints,
      plannedEvents,
    };
  },

  /**
   * Create or replace a full roadtrip snapshot (trip + stops + planned events).
   * Favorites are never touched.
   */
  async saveSnapshot(params: {
    roadtripId?: string | null;
    name: string;
    departureAt: string;
    status?: RoadtripStatus;
    preferences: StoredRoadtripPreferences;
    waypoints: RoadtripWaypoint[];
    plannedEvents: PlannedEventStop[];
  }): Promise<string> {
    const userId = await requireUserId();
    const name = params.name.trim().slice(0, 120) || 'Mon roadtrip';
    let roadtripId = params.roadtripId ?? null;

    if (roadtripId) {
      const { error } = await supabase
        .from('roadtrips')
        .update({
          name,
          departure_at: params.departureAt,
          status: params.status ?? 'draft',
          preferences: params.preferences,
        })
        .eq('id', roadtripId);
      if (error) throw error;
      const { error: clearStopsError } = await supabase
        .from('roadtrip_stops')
        .delete()
        .eq('roadtrip_id', roadtripId);
      if (clearStopsError) throw clearStopsError;
      const { error: clearEventsError } = await supabase
        .from('roadtrip_events')
        .delete()
        .eq('roadtrip_id', roadtripId);
      if (clearEventsError) throw clearEventsError;
    } else {
      const { data, error } = await supabase
        .from('roadtrips')
        .insert({
          user_id: userId,
          name,
          departure_at: params.departureAt,
          status: params.status ?? 'draft',
          preferences: params.preferences,
        })
        .select('id')
        .single();
      if (error) throw error;
      roadtripId = data.id as string;
    }

    const stopRows = params.waypoints.map((waypoint, position) => ({
      roadtrip_id: roadtripId,
      position,
      kind: waypoint.kind,
      label: waypoint.label.slice(0, 200),
      latitude: waypoint.coordinate.latitude,
      longitude: waypoint.coordinate.longitude,
      arrival_at: waypoint.arrivalAt ?? null,
      departure_at: waypoint.departureAt ?? null,
      event_id: waypoint.kind === 'event' ? waypoint.eventId ?? null : null,
    }));
    if (stopRows.length > 0) {
      const { error } = await supabase.from('roadtrip_stops').insert(stopRows);
      if (error) throw error;
    }

    const eventRows = params.plannedEvents.map((planned) => ({
      roadtrip_id: roadtripId,
      event_id: planned.eventId,
      leg_index: planned.legIndex,
      planned_arrival_at: planned.arrivalAt || null,
      planned_duration_minutes: planned.plannedDurationMinutes,
      estimated_detour_minutes: planned.estimatedDetourMinutes,
      status: 'planned' as const,
    }));
    if (eventRows.length > 0) {
      const { error } = await supabase.from('roadtrip_events').upsert(eventRows);
      if (error) throw error;
    }

    return roadtripId!;
  },

  async archive(roadtripId: string): Promise<void> {
    await requireUserId();
    const { error } = await supabase
      .from('roadtrips')
      .update({ status: 'archived' })
      .eq('id', roadtripId);
    if (error) throw error;
  },

  preferencesFromUi(params: {
    categoryIds: string[];
    detourBudgetMinutes: DetourBudgetMinutes;
    searchZone: RoadtripSearchZone;
    freeOnly: boolean;
    minOnSiteMinutes: MinOnSiteMinutes;
    timeConfirmed?: boolean;
  }): StoredRoadtripPreferences {
    return {
      categoryIds: params.categoryIds,
      detourBudgetMinutes: params.detourBudgetMinutes,
      searchZone: params.searchZone,
      freeOnly: params.freeOnly,
      minOnSiteMinutes: params.minOnSiteMinutes,
      timeConfirmed: params.timeConfirmed ?? true,
    };
  },

  toEnginePreferences(
    stored: StoredRoadtripPreferences,
    categoryValues: string[],
  ): RoadtripPreferences {
    return {
      categoryValues,
      detourBudgetMinutes: stored.detourBudgetMinutes,
      searchZone: stored.searchZone,
      freeOnly: stored.freeOnly,
      minOnSiteMinutes: stored.minOnSiteMinutes,
      timeConfirmed: stored.timeConfirmed,
    };
  },
};
