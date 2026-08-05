import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useAuthStore } from '@/state/auth';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import { fetchDrivingRoute } from '@/services/roadtrip/mapbox-directions.service';
import { fetchRoadtripCandidatePool } from '@/services/roadtrip/roadtrip-candidates.service';
import { RoadtripService, type RoadtripSummary } from '@/services/roadtrip/roadtrip.service';
import type { PlannedEventStop } from './roadtrip-program';
import { computeRoadtripCandidates } from './roadtrip-engine';
import {
  detectArrivalShiftConflict,
  insertCandidateAsWaypoint,
  removeEventFromWaypoints,
} from './roadtrip-program';
import { rebuildRouteFromWaypoints } from './roadtrip-rebuild';
import { RoadtripPlaceField, type RoadtripPlace } from './RoadtripPlaceField';
import { RoadtripSpikeMap } from './RoadtripSpikeMap';
import { buildTimeline } from './roadtrip-timeline';
import {
  DETOUR_BUDGETS_MINUTES,
  MIN_ON_SITE_MINUTES,
  type DetourBudgetMinutes,
  type MinOnSiteMinutes,
  type RoadtripCandidate,
  type RoadtripRoute,
  type RoadtripSearchZone,
  type RoadtripWaypoint,
} from './roadtrip.types';

const CITY_PRESETS: RoadtripPlace[] = [
  { label: 'Paris', latitude: 48.8566, longitude: 2.3522 },
  { label: 'Rouen', latitude: 49.4431, longitude: 1.0993 },
  { label: 'Caen', latitude: 49.1829, longitude: -0.3707 },
  { label: 'Lyon', latitude: 45.764, longitude: 4.8357 },
  { label: 'Strasbourg', latitude: 48.5734, longitude: 7.7521 },
  { label: 'Nantes', latitude: 47.2184, longitude: -1.5536 },
];

const nextSaturdayMorning = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7 || 7));
  date.setHours(9, 0, 0, 0);
  return date;
};

const formatDateTime = (iso: string | Date): string =>
  new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const placeFromWaypoint = (waypoint: RoadtripWaypoint): RoadtripPlace => ({
  label: waypoint.label,
  latitude: waypoint.coordinate.latitude,
  longitude: waypoint.coordinate.longitude,
});

const candidateReasons = (candidate: RoadtripCandidate): string[] => {
  const reasons: string[] = [];
  if (candidate.origin.kind === 'leg') {
    reasons.push(`Sur votre route · détour estimé +${candidate.estimatedDetourMinutes} min`);
    reasons.push(
      candidate.approximateTime
        ? `Passage à proximité vers ${formatTime(candidate.passageAt)} · horaire à confirmer`
        : `Passage à proximité vers ${formatTime(candidate.passageAt)}`,
    );
  } else {
    reasons.push(
      `À ${candidate.origin.distanceKm.toFixed(1).replace('.', ',')} km de votre étape à ${candidate.origin.stopLabel}`,
    );
    reasons.push(
      `Commence à ${formatTime(candidate.event.starts_at)} · compatible avec votre étape`,
    );
  }
  return reasons;
};

export default function RoadtripSpikeScreen() {
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id ?? state.session?.user?.id ?? null);
  const categories = useTaxonomyStore((state) => state.categories);
  const loadTaxonomy = useTaxonomyStore((state) => state.load);

  const [origin, setOrigin] = useState<RoadtripPlace>(CITY_PRESETS[0]);
  const [destination, setDestination] = useState<RoadtripPlace>(CITY_PRESETS[2]);
  const [stop, setStop] = useState<RoadtripPlace | null>(null);
  const [departureAt, setDepartureAt] = useState<Date>(nextSaturdayMorning);
  const [detourBudget, setDetourBudget] = useState<DetourBudgetMinutes>(20);
  const [minOnSite, setMinOnSite] = useState<MinOnSiteMinutes>(90);
  const [searchZone, setSearchZone] = useState<RoadtripSearchZone>('both');
  const [freeOnly, setFreeOnly] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<RoadtripRoute | null>(null);
  const [scheduledWaypoints, setScheduledWaypoints] = useState<RoadtripWaypoint[]>([]);
  const [candidates, setCandidates] = useState<RoadtripCandidate[]>([]);
  const [plannedEvents, setPlannedEvents] = useState<PlannedEventStop[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);
  const [preciseDetours, setPreciseDetours] = useState<Record<string, number>>({});
  const [roadtripId, setRoadtripId] = useState<string | null>(null);
  const [tripName, setTripName] = useState('Mon roadtrip');
  const [savedTrips, setSavedTrips] = useState<RoadtripSummary[]>([]);

  useEffect(() => {
    void loadTaxonomy();
  }, [loadTaxonomy]);

  const refreshSaved = useCallback(async () => {
    if (!userId) {
      setSavedTrips([]);
      return;
    }
    try {
      setSavedTrips(await RoadtripService.listMine());
    } catch (e) {
      console.warn('[roadtrip] listMine failed', e);
    }
  }, [userId]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const shiftDeparture = (minutes: number) => {
    setDepartureAt((prev) => new Date(prev.getTime() + minutes * 60_000));
  };

  const baseWaypoints = useMemo<RoadtripWaypoint[]>(() => {
    const list: RoadtripWaypoint[] = [
      {
        kind: 'origin',
        label: origin.label,
        coordinate: { latitude: origin.latitude, longitude: origin.longitude },
      },
    ];
    if (stop) {
      list.push({
        kind: 'stop',
        label: stop.label,
        coordinate: { latitude: stop.latitude, longitude: stop.longitude },
      });
    }
    list.push({
      kind: 'destination',
      label: destination.label,
      coordinate: { latitude: destination.latitude, longitude: destination.longitude },
    });
    return list;
  }, [origin, stop, destination]);

  const storedPreferences = useMemo(
    () =>
      RoadtripService.preferencesFromUi({
        categoryIds: Array.from(selectedCategoryIds),
        detourBudgetMinutes: detourBudget,
        searchZone,
        freeOnly,
        minOnSiteMinutes: minOnSite,
      }),
    [selectedCategoryIds, detourBudget, searchZone, freeOnly, minOnSite],
  );

  const runSearch = useCallback(
    async (waypoints: RoadtripWaypoint[]) => {
      setLoading(true);
      setError(null);
      setSearched(true);
      setSelectedEventId(null);
      setHiddenIds(new Set());
      setPreciseDetours({});
      try {
        const rebuilt = await rebuildRouteFromWaypoints({
          waypoints,
          departureAt: departureAt.toISOString(),
        });
        setRoute(rebuilt.route);
        setScheduledWaypoints(rebuilt.waypoints);

        const lastWaypoint = rebuilt.waypoints[rebuilt.waypoints.length - 1];
        const windowEnd =
          lastWaypoint.departureAt ??
          new Date(
            departureAt.getTime() + rebuilt.route.totalDurationSeconds * 1000,
          ).toISOString();

        const categoryIds = Array.from(selectedCategoryIds);
        const pool = await fetchRoadtripCandidatePool({
          legs: rebuilt.route.legs,
          detourBudgetMinutes: detourBudget,
          windowStart: departureAt.toISOString(),
          windowEnd,
          categoryIds,
          freeOnly,
        });

        const categoryValues = categoryIds.flatMap((id) => {
          const category = categories.find((item) => item.id === id);
          return category?.slug ? [id, category.slug] : [id];
        });
        const plannedIds = new Set(
          rebuilt.waypoints.filter((w) => w.eventId).map((w) => w.eventId!),
        );
        const results = computeRoadtripCandidates({
          events: pool.filter((event) => !plannedIds.has(event.id)),
          legs: rebuilt.route.legs,
          waypoints: rebuilt.waypoints,
          preferences: {
            categoryValues,
            detourBudgetMinutes: detourBudget,
            searchZone,
            freeOnly,
            minOnSiteMinutes: minOnSite,
            timeConfirmed: true,
          },
        });
        setCandidates(results);
        setTripName(`${origin.label} → ${destination.label}`);
      } catch (e) {
        setRoute(null);
        setCandidates([]);
        setError(e instanceof Error ? e.message : 'Impossible de calculer le trajet.');
      } finally {
        setLoading(false);
      }
    },
    [
      departureAt,
      detourBudget,
      minOnSite,
      searchZone,
      freeOnly,
      selectedCategoryIds,
      categories,
      origin.label,
      destination.label,
    ],
  );

  const generate = useCallback(async () => {
    // Keep event stops already in the program; rebuild city anchors from the form.
    const withoutDestination = baseWaypoints.slice(0, -1);
    const destinationWp = baseWaypoints[baseWaypoints.length - 1];
    const eventStops = scheduledWaypoints.filter((w) => w.kind === 'event');
    await runSearch([...withoutDestination, ...eventStops, destinationWp]);
  }, [baseWaypoints, scheduledWaypoints, runSearch]);

  const persist = useCallback(
    async (waypoints: RoadtripWaypoint[], events: PlannedEventStop[], id: string | null) => {
      if (!userId) {
        Alert.alert('Connexion requise', 'Connecte-toi pour sauvegarder ton roadtrip.');
        return null;
      }
      setSaving(true);
      try {
        const savedId = await RoadtripService.saveSnapshot({
          roadtripId: id,
          name: tripName,
          departureAt: departureAt.toISOString(),
          status: 'draft',
          preferences: storedPreferences,
          waypoints,
          plannedEvents: events,
        });
        setRoadtripId(savedId);
        await refreshSaved();
        return savedId;
      } catch (e) {
        Alert.alert(
          'Sauvegarde impossible',
          e instanceof Error ? e.message : 'Erreur inconnue',
        );
        return null;
      } finally {
        setSaving(false);
      }
    },
    [userId, tripName, departureAt, storedPreferences, refreshSaved],
  );

  const applyProgram = useCallback(
    async (nextWaypoints: RoadtripWaypoint[], nextPlanned: PlannedEventStop[]) => {
      const previousArrival = scheduledWaypoints[scheduledWaypoints.length - 1]?.arrivalAt;
      const rebuilt = await rebuildRouteFromWaypoints({
        waypoints: nextWaypoints,
        departureAt: departureAt.toISOString(),
      });
      const conflict = detectArrivalShiftConflict({
        previousDestinationArrivalAt: previousArrival,
        nextDestinationArrivalAt: rebuilt.waypoints[rebuilt.waypoints.length - 1]?.arrivalAt,
      });

      const commit = async () => {
        setScheduledWaypoints(rebuilt.waypoints);
        setRoute(rebuilt.route);
        setPlannedEvents(nextPlanned);
        setCandidates((prev) =>
          prev.filter((c) => !nextPlanned.some((p) => p.eventId === c.event.id)),
        );
        if (roadtripId || userId) {
          await persist(rebuilt.waypoints, nextPlanned, roadtripId);
        }
      };

      if (conflict) {
        Alert.alert('Conflit d’horaire', conflict.message, [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Confirmer', onPress: () => void commit() },
        ]);
        return;
      }
      await commit();
    },
    [scheduledWaypoints, departureAt, roadtripId, userId, persist],
  );

  const addToProgram = useCallback(
    async (candidate: RoadtripCandidate) => {
      const inserted = insertCandidateAsWaypoint({
        waypoints: scheduledWaypoints.length >= 2 ? scheduledWaypoints : baseWaypoints,
        candidate,
        minOnSiteMinutes: minOnSite,
      });
      if ('error' in inserted) {
        Alert.alert('Impossible d’ajouter', inserted.error);
        return;
      }
      await applyProgram(inserted.waypoints, [
        ...plannedEvents.filter((p) => p.eventId !== inserted.planned.eventId),
        inserted.planned,
      ]);
    },
    [scheduledWaypoints, baseWaypoints, minOnSite, plannedEvents, applyProgram],
  );

  const removeFromProgram = useCallback(
    async (eventId: string) => {
      const nextWaypoints = removeEventFromWaypoints(
        scheduledWaypoints.length >= 2 ? scheduledWaypoints : baseWaypoints,
        eventId,
      );
      const nextPlanned = plannedEvents.filter((p) => p.eventId !== eventId);
      await applyProgram(nextWaypoints, nextPlanned);
    },
    [scheduledWaypoints, baseWaypoints, plannedEvents, applyProgram],
  );

  const resumeTrip = useCallback(
    async (summary: RoadtripSummary) => {
      setLoading(true);
      setError(null);
      try {
        const detail = await RoadtripService.getDetail(summary.id);
        setRoadtripId(detail.id);
        setTripName(detail.name);
        setDepartureAt(new Date(detail.departureAt));
        setDetourBudget(detail.preferences.detourBudgetMinutes);
        setMinOnSite(detail.preferences.minOnSiteMinutes);
        setSearchZone(detail.preferences.searchZone);
        setFreeOnly(detail.preferences.freeOnly);
        setSelectedCategoryIds(new Set(detail.preferences.categoryIds));
        setPlannedEvents(detail.plannedEvents);

        const originWp = detail.waypoints.find((w) => w.kind === 'origin');
        const destinationWp = detail.waypoints.find((w) => w.kind === 'destination');
        const stopWp = detail.waypoints.find((w) => w.kind === 'stop');
        if (originWp) setOrigin(placeFromWaypoint(originWp));
        if (destinationWp) setDestination(placeFromWaypoint(destinationWp));
        setStop(stopWp ? placeFromWaypoint(stopWp) : null);

        await runSearch(detail.waypoints);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Reprise impossible.');
      } finally {
        setLoading(false);
      }
    },
    [runSearch],
  );

  useEffect(() => {
    if (!selectedEventId || preciseDetours[selectedEventId] !== undefined || !route) return;
    const candidate = candidates.find((item) => item.event.id === selectedEventId);
    if (!candidate || candidate.origin.kind !== 'leg') return;
    const leg = route.legs[candidate.origin.legIndex];
    const start = scheduledWaypoints[candidate.origin.legIndex];
    const end = scheduledWaypoints[candidate.origin.legIndex + 1];
    if (!leg || !start || !end) return;

    let cancelled = false;
    void (async () => {
      try {
        const via = await fetchDrivingRoute([
          start.coordinate,
          { latitude: candidate.event.latitude, longitude: candidate.event.longitude },
          end.coordinate,
        ]);
        if (cancelled) return;
        const detourMinutes = Math.max(
          0,
          Math.round((via.totalDurationSeconds - leg.durationSeconds) / 60),
        );
        setPreciseDetours((prev) => ({ ...prev, [selectedEventId]: detourMinutes }));
      } catch {
        // Heuristic stays displayed.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEventId, candidates, route, scheduledWaypoints, preciseDetours]);

  const plannedIds = useMemo(() => new Set(plannedEvents.map((p) => p.eventId)), [plannedEvents]);
  const visibleCandidates = useMemo(
    () =>
      candidates.filter(
        (candidate) => !hiddenIds.has(candidate.event.id) && !plannedIds.has(candidate.event.id),
      ),
    [candidates, hiddenIds, plannedIds],
  );

  const timeline = useMemo(
    () =>
      buildTimeline({
        candidates: visibleCandidates,
        waypoints: scheduledWaypoints.length >= 2 ? scheduledWaypoints : baseWaypoints,
      }),
    [visibleCandidates, scheduledWaypoints, baseWaypoints],
  );

  const routeSummary = useMemo(() => {
    if (!route) return null;
    const hours = Math.floor(route.totalDurationSeconds / 3600);
    const minutes = Math.round((route.totalDurationSeconds % 3600) / 60);
    const km = Math.round(route.totalDistanceMeters / 1000);
    return `${km} km · ${hours} h ${String(minutes).padStart(2, '0')} de route`;
  }, [route]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Roadtrip
        </Text>
        <Text style={styles.subtitle}>
          Trajet voiture + événements compatibles. Programme et favoris restent séparés.
          {roadtripId ? ` · brouillon enregistré` : ''}
        </Text>

        {userId && savedTrips.length > 0 ? (
          <>
            <Text style={styles.sectionLabel} accessibilityRole="header">
              Reprendre un voyage
            </Text>
            <View style={styles.chipRow}>
              {savedTrips.slice(0, 5).map((trip) => (
                <Chip
                  key={trip.id}
                  label={trip.name}
                  active={roadtripId === trip.id}
                  onPress={() => void resumeTrip(trip)}
                  accessibilityLabel={`Reprendre ${trip.name}`}
                />
              ))}
            </View>
          </>
        ) : null}

        <RoadtripPlaceField
          label="Départ"
          value={origin}
          onChange={(place) => {
            if (place) setOrigin(place);
          }}
          presets={CITY_PRESETS.filter((city) => city.label !== destination.label)}
        />
        <RoadtripPlaceField
          label="Étape (facultative)"
          value={stop}
          onChange={setStop}
          allowClear
          presets={CITY_PRESETS.filter(
            (city) => city.label !== origin.label && city.label !== destination.label,
          )}
        />
        <RoadtripPlaceField
          label="Destination"
          value={destination}
          onChange={(place) => {
            if (place) setDestination(place);
          }}
          presets={CITY_PRESETS.filter((city) => city.label !== origin.label)}
        />

        <Text style={styles.sectionLabel} accessibilityRole="header">
          Départ le
        </Text>
        <View style={styles.chipRow}>
          <Chip label="−1 j" onPress={() => shiftDeparture(-24 * 60)} accessibilityLabel="Retirer un jour" />
          <Chip label="−1 h" onPress={() => shiftDeparture(-60)} accessibilityLabel="Retirer une heure" />
          <View style={styles.departureBadge} accessibilityLabel={`Départ le ${formatDateTime(departureAt)}`}>
            <Text style={styles.departureText}>{formatDateTime(departureAt)}</Text>
          </View>
          <Chip label="+1 h" onPress={() => shiftDeparture(60)} accessibilityLabel="Ajouter une heure" />
          <Chip label="+1 j" onPress={() => shiftDeparture(24 * 60)} accessibilityLabel="Ajouter un jour" />
        </View>

        <Text style={styles.sectionLabel} accessibilityRole="header">
          Détour max
        </Text>
        <View style={styles.chipRow}>
          {DETOUR_BUDGETS_MINUTES.map((budget) => (
            <Chip
              key={`b-${budget}`}
              label={`${budget} min`}
              active={detourBudget === budget}
              onPress={() => setDetourBudget(budget)}
              accessibilityLabel={`Détour maximum ${budget} minutes`}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel} accessibilityRole="header">
          Temps minimum sur place
        </Text>
        <View style={styles.chipRow}>
          {MIN_ON_SITE_MINUTES.map((duration) => (
            <Chip
              key={`m-${duration}`}
              label={`${duration} min`}
              active={minOnSite === duration}
              onPress={() => setMinOnSite(duration)}
              accessibilityLabel={`Temps minimum sur place ${duration} minutes`}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel} accessibilityRole="header">
          Catégories
        </Text>
        <View style={styles.chipRow}>
          <Chip
            label="Tout sélectionner"
            active={selectedCategoryIds.size === 0}
            onPress={() => setSelectedCategoryIds(new Set())}
            accessibilityLabel="Toutes les catégories"
          />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.label}
              active={selectedCategoryIds.has(category.id)}
              onPress={() => toggleCategory(category.id)}
              accessibilityLabel={`Catégorie ${category.label}`}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel} accessibilityRole="header">
          Zones à explorer
        </Text>
        <View style={styles.chipRow}>
          <Chip label="Trajet" active={searchZone === 'route'} onPress={() => setSearchZone('route')} />
          <Chip label="Étapes" active={searchZone === 'stops'} onPress={() => setSearchZone('stops')} />
          <Chip label="Les deux" active={searchZone === 'both'} onPress={() => setSearchZone('both')} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel} accessibilityRole="text">
            Événements gratuits uniquement
          </Text>
          <Switch
            value={freeOnly}
            onValueChange={setFreeOnly}
            accessibilityLabel="Événements gratuits uniquement"
          />
        </View>

        <Pressable
          style={[styles.generateButton, loading && styles.generateButtonDisabled]}
          onPress={() => void generate()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Tracer la route et chercher des événements"
          accessibilityState={{ busy: loading, disabled: loading }}
        >
          <Text style={styles.generateText}>
            {loading ? 'Calcul en cours…' : 'Tracer la route et chercher'}
          </Text>
        </Pressable>

        {route ? (
          <Pressable
            style={[styles.secondaryButton, (saving || !userId) && styles.generateButtonDisabled]}
            onPress={() =>
              void persist(
                scheduledWaypoints.length >= 2 ? scheduledWaypoints : baseWaypoints,
                plannedEvents,
                roadtripId,
              ).then((id) => {
                if (id) Alert.alert('Sauvegardé', 'Ton roadtrip est enregistré. Tu pourras le reprendre.');
              })
            }
            disabled={saving || !userId}
            accessibilityRole="button"
            accessibilityLabel={
              !userId
                ? 'Connexion requise pour sauvegarder'
                : roadtripId
                  ? 'Mettre à jour le brouillon'
                  : 'Sauvegarder le voyage'
            }
          >
            <Text style={styles.secondaryButtonText}>
              {saving
                ? 'Sauvegarde…'
                : !userId
                  ? 'Connecte-toi pour sauvegarder'
                  : roadtripId
                    ? 'Mettre à jour le brouillon'
                    : 'Sauvegarder le voyage'}
            </Text>
          </Pressable>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox} accessibilityRole="progressbar" accessibilityLabel="Recherche en cours">
            <ActivityIndicator color={colors.brand.primary} />
            <Text style={styles.loadingText}>On cherche les meilleurs moments sur ta route…</Text>
          </View>
        ) : null}

        {error ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {!searched && !loading ? (
          <View style={styles.emptyBox} accessibilityRole="text">
            <Text style={styles.emptyTitle}>Prêt pour la route</Text>
            <Text style={styles.emptyText}>
              Choisis un départ et une destination, ajuste tes préférences, puis lance la recherche.
              Tu peux saisir n’importe quelle ville française.
            </Text>
          </View>
        ) : null}

        {route ? (
          <>
            {routeSummary ? <Text style={styles.routeSummary}>{routeSummary}</Text> : null}
            <RoadtripSpikeMap
              route={route}
              waypoints={scheduledWaypoints}
              candidates={visibleCandidates}
              selectedEventId={selectedEventId}
              onCandidatePress={setSelectedEventId}
            />
          </>
        ) : null}

        {plannedEvents.length > 0 ? (
          <>
            <Text style={styles.sectionLabel} accessibilityRole="header">
              Programme ({plannedEvents.length})
            </Text>
            {plannedEvents.map((planned) => (
              <View
                key={planned.eventId}
                style={styles.card}
                accessibilityLabel={`${planned.label}, passage ${formatDateTime(planned.arrivalAt)}`}
              >
                <Text style={styles.cardTitle}>{planned.label}</Text>
                <Text style={styles.cardMeta}>
                  Passage {formatDateTime(planned.arrivalAt)} · {planned.plannedDurationMinutes} min
                  sur place
                </Text>
                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.cardActionButton}
                    onPress={() => router.push(`/events/${planned.eventId}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ouvrir la fiche de ${planned.label}`}
                  >
                    <Text style={styles.cardActionText}>Ouvrir la fiche</Text>
                  </Pressable>
                  <Pressable
                    style={styles.cardActionButton}
                    onPress={() => void removeFromProgram(planned.eventId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Retirer ${planned.label} du programme`}
                  >
                    <Text style={styles.cardActionText}>Retirer du programme</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {searched && !loading && route && visibleCandidates.length === 0 ? (
          <View style={styles.emptyBox} accessibilityRole="text">
            <Text style={styles.emptyTitle}>Aucun moment sur ce trajet</Text>
            <Text style={styles.emptyText}>
              Essayez un détour plus large (20 ou 40 min), une autre date, d’autres catégories, ou
              désactivez « gratuits uniquement ».
            </Text>
          </View>
        ) : null}

        {timeline.map((day) => (
          <View key={day.dayKey} style={styles.dayBlock}>
            <Text style={styles.dayTitle} accessibilityRole="header">
              {day.title}
            </Text>
            {day.sections.map((section) => (
              <View key={`${day.dayKey}-${section.key}`} style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.subtitle ? (
                  <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
                ) : null}
                {section.candidates.map((candidate) => (
                  <Pressable
                    key={candidate.event.id}
                    style={[
                      styles.card,
                      selectedEventId === candidate.event.id && styles.cardSelected,
                    ]}
                    onPress={() => setSelectedEventId(candidate.event.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${candidate.event.title}, ${candidateReasons(candidate).join('. ')}`}
                    accessibilityState={{ selected: selectedEventId === candidate.event.id }}
                  >
                    <Text style={styles.cardTitle}>{candidate.event.title}</Text>
                    <Text style={styles.cardMeta}>
                      {formatDateTime(candidate.event.starts_at)}
                      {candidate.event.city ? ` · ${candidate.event.city}` : ''}
                    </Text>
                    {candidateReasons(candidate).map((reason) => (
                      <Text key={reason} style={styles.cardReason}>
                        {reason}
                      </Text>
                    ))}
                    {candidate.origin.kind === 'leg' &&
                    preciseDetours[candidate.event.id] !== undefined ? (
                      <Text style={styles.cardReason}>
                        Détour réel (Mapbox) : +{preciseDetours[candidate.event.id]} min
                      </Text>
                    ) : null}
                    <View style={styles.cardActions}>
                      <Pressable
                        style={styles.cardActionButton}
                        onPress={() => void addToProgram(candidate)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ajouter ${candidate.event.title} au programme`}
                      >
                        <Text style={styles.cardActionText}>Ajouter au programme</Text>
                      </Pressable>
                      <Pressable
                        style={styles.cardActionButton}
                        onPress={() => router.push(`/events/${candidate.event.id}`)}
                        accessibilityRole="button"
                        accessibilityLabel="Ouvrir la fiche"
                      >
                        <Text style={styles.cardActionText}>Ouvrir</Text>
                      </Pressable>
                      <Pressable
                        style={styles.cardActionButton}
                        onPress={() =>
                          setHiddenIds((prev) => {
                            const next = new Set(prev);
                            next.add(candidate.event.id);
                            return next;
                          })
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Masquer cette proposition"
                      >
                        <Text style={styles.cardActionText}>Masquer</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.neutral[0] },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.sm },
  title: { ...typography.h2, color: colors.neutral[900] },
  subtitle: { ...typography.caption, color: colors.neutral[500], marginBottom: spacing.sm },
  sectionLabel: { ...typography.bodyBold, color: colors.neutral[700], marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
    maxWidth: '100%',
  },
  chipActive: {
    backgroundColor: colors.brand.page,
    borderColor: colors.brand.primary,
  },
  chipText: { ...typography.caption, color: colors.neutral[700] },
  chipTextActive: { color: colors.neutral[0], fontWeight: '700' },
  departureBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
  },
  departureText: { ...typography.caption, color: colors.neutral[900], fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  switchLabel: { ...typography.body, color: colors.neutral[700] },
  generateButton: {
    marginTop: spacing.md,
    backgroundColor: colors.brand.page,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButton: {
    marginTop: spacing.xs,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  secondaryButtonText: { ...typography.bodyBold, color: colors.neutral[800] },
  generateButtonDisabled: { opacity: 0.6 },
  generateText: { ...typography.bodyBold, color: colors.neutral[0] },
  loadingBox: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  loadingText: { ...typography.caption, color: colors.neutral[500] },
  errorText: { ...typography.caption, color: colors.error[500], marginTop: spacing.sm },
  routeSummary: { ...typography.bodyBold, color: colors.neutral[900], marginTop: spacing.sm },
  emptyBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    gap: spacing.xs,
  },
  emptyTitle: { ...typography.bodyBold, color: colors.neutral[800], textAlign: 'center' },
  emptyText: {
    ...typography.caption,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  dayBlock: { marginTop: spacing.md, gap: spacing.sm },
  dayTitle: {
    ...typography.h3,
    color: colors.neutral[900],
    textTransform: 'capitalize',
  },
  sectionBlock: { gap: spacing.xs, marginBottom: spacing.sm },
  sectionTitle: { ...typography.bodyBold, color: colors.neutral[800] },
  sectionSubtitle: { ...typography.caption, color: colors.neutral[500], marginBottom: spacing.xs },
  card: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: 2,
    backgroundColor: colors.neutral[0],
  },
  cardSelected: { borderColor: colors.brand.primary, borderWidth: 2 },
  cardTitle: { ...typography.bodyBold, color: colors.neutral[900] },
  cardMeta: { ...typography.caption, color: colors.neutral[500] },
  cardReason: { ...typography.caption, color: colors.brand.primary },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  cardActionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
  },
  cardActionText: { ...typography.caption, color: colors.neutral[700], fontWeight: '600' },
});
