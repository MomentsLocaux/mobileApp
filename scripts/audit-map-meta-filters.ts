/**
 * Audit: expected counts per map meta filter vs full published public DB.
 * Run: npx tsx scripts/audit-map-meta-filters.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { filterEventsByMetaStatus, type EventMetaFilter } from '../src/utils/filter-events';
import { resolveEventTimeScope, type EventTimeScope } from '../src/utils/event-time-scope';
import type { EventWithCreator } from '../src/types/database';

type DbEvent = Pick<
  EventWithCreator,
  'id' | 'starts_at' | 'ends_at' | 'latitude' | 'longitude' | 'title' | 'city' | 'operating_hours'
>;

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  const url = raw.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
  const key = raw.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return { url, key };
}

function isOnMap(event: DbEvent): boolean {
  const lat = Number(event.latitude);
  const lon = Number(event.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return !(lat === 0 && lon === 0);
}

function matchesServerScope(event: DbEvent, scope: EventTimeScope, now: Date): boolean {
  const startsAt = event.starts_at ? new Date(event.starts_at) : null;
  const endsAt = event.ends_at ? new Date(event.ends_at) : null;
  const nowIso = now.toISOString();

  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    return scope === 'all';
  }

  if (scope === 'all') return true;
  if (scope === 'upcoming') return startsAt.toISOString() > nowIso;

  const started = startsAt.toISOString() <= nowIso;
  const notEnded = !endsAt || Number.isNaN(endsAt.getTime()) || endsAt.toISOString() >= nowIso;

  if (scope === 'ongoing') return started && notEnded;
  if (scope === 'current') {
    return startsAt.toISOString() > nowIso || (started && notEnded);
  }
  return false;
}

async function fetchAllPublished(url: string, key: string): Promise<DbEvent[]> {
  const pageSize = 1000;
  let offset = 0;
  const all: DbEvent[] = [];

  while (true) {
    const params = new URLSearchParams({
      select: 'id,starts_at,ends_at,latitude,longitude,title,city,operating_hours',
      status: 'eq.published',
      visibility: 'eq.public',
      order: 'starts_at.asc',
    });
    const res = await fetch(`${url}/rest/v1/events?${params}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${offset}-${offset + pageSize - 1}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`);
    }
    const batch = (await res.json()) as DbEvent[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function fetchServerCount(url: string, key: string, filter: string): Promise<number | string> {
  const params = new URLSearchParams({
    select: 'id',
    status: 'eq.published',
    visibility: 'eq.public',
    limit: '1',
  });
  const res = await fetch(`${url}/rest/v1/events?${params}&${filter}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
    },
  });
  if (!res.ok) return `error ${res.status}`;
  const range = res.headers.get('content-range');
  return range ? Number(range.split('/')[1]) : '?';
}

function pipelineCount(events: DbEvent[], metaFilter: EventMetaFilter, now: Date) {
  const serverScope = resolveEventTimeScope({ metaFilter });
  const serverSet = events.filter((e) => matchesServerScope(e, serverScope, now));
  const clientSet = filterEventsByMetaStatus(serverSet as EventWithCreator[], metaFilter);
  return { serverScope, afterServer: serverSet.length, afterClient: clientSet.length };
}

function fmtSample(events: DbEvent[], n = 5) {
  return events.slice(0, n).map((e) => ({
    title: (e.title || '').slice(0, 45),
    city: e.city,
    starts_at: e.starts_at,
    ends_at: e.ends_at ?? null,
  }));
}

async function main() {
  const { url, key } = loadEnv();
  const now = new Date();
  const nowIso = now.toISOString();

  console.log('=== Audit filtres carte — base complète ===');
  console.log(`Now (UTC): ${nowIso}`);
  console.log(`Now (local): ${now.toLocaleString('fr-FR')}\n`);

  const all = await fetchAllPublished(url, key);
  const onMap = all.filter(isOnMap);

  console.log(`Total published + public: ${all.length}`);
  console.log(`With map coordinates (not 0,0): ${onMap.length}`);
  console.log(`Excluded from map (0,0 or missing): ${all.length - onMap.length}\n`);

  const metaFilters: EventMetaFilter[] = ['all', 'live', 'upcoming', 'past'];
  const labels: Record<EventMetaFilter, string> = {
    all: 'Tous',
    live: 'En cours',
    upcoming: 'À venir',
    past: 'Passés',
  };

  console.log('--- Pipeline app (serveur → client) sur événements cartographiables ---');
  console.log('Filtre          | Scope serveur | Après serveur | Après client (affiché)');
  console.log('----------------|---------------|---------------|------------------------');

  const buckets: Record<EventMetaFilter, DbEvent[]> = {
    all: [],
    live: [],
    upcoming: [],
    past: [],
  };

  for (const meta of metaFilters) {
    const scope = resolveEventTimeScope({ metaFilter: meta });
    const serverSet = onMap.filter((e) => matchesServerScope(e, scope, now));
    const clientSet = filterEventsByMetaStatus(serverSet as EventWithCreator[], meta);
    buckets[meta] = clientSet as DbEvent[];
    const { afterServer, afterClient } = pipelineCount(onMap, meta, now);
    console.log(
      `${labels[meta].padEnd(15)} | ${scope.padEnd(13)} | ${String(afterServer).padStart(13)} | ${String(afterClient).padStart(22)}`
    );
  }

  console.log('\n--- Vérification directe Supabase REST (counts) ---');
  const enc = encodeURIComponent;
  const counts = {
    all_published: await fetchServerCount(url, key, ''),
    upcoming_gt: await fetchServerCount(url, key, `starts_at=gt.${enc(nowIso)}`),
    ongoing: await fetchServerCount(
      url,
      key,
      `starts_at=lte.${enc(nowIso)}&or=(ends_at.is.null,ends_at.gte.${enc(nowIso)})`
    ),
    current_or: await fetchServerCount(
      url,
      key,
      `or=(starts_at.gt.${enc(nowIso)},and(starts_at.lte.${enc(nowIso)},or(ends_at.is.null,ends_at.gte.${enc(nowIso)})))`
    ),
  };
  for (const [k, v] of Object.entries(counts)) {
    console.log(`${k}: ${v}`);
  }

  console.log('\n--- Écarts serveur vs client (sur carte) ---');
  for (const meta of metaFilters) {
    const scope = resolveEventTimeScope({ metaFilter: meta });
    const serverSet = onMap.filter((e) => matchesServerScope(e, scope, now));
    const clientSet = buckets[meta];
    if (meta === 'all') {
      console.log(`${labels[meta]}: pas de filtre client (affiche tout le scope serveur « current »)`);
      continue;
    }
    const serverOnly = serverSet.filter((e) => !clientSet.some((c) => c.id === e.id)).length;
    const clientOnly = clientSet.filter((e) => !serverSet.some((s) => s.id === e.id)).length;
    console.log(
      `${labels[meta]}: ${serverOnly} exclus par filtre client, ${clientOnly} ajoutés par filtre client (devrait être 0)`
    );
  }

  console.log('\n--- Échantillons (après pipeline complet) ---');
  for (const meta of metaFilters) {
    console.log(`\n${labels[meta]} (${buckets[meta].length}):`);
    if (buckets[meta].length === 0) {
      console.log('  (aucun)');
      continue;
    }
    console.log(JSON.stringify(fmtSample(buckets[meta]), null, 2));
  }

  const overlap = {
    upcoming_and_live: buckets.upcoming.filter((e) => buckets.live.some((l) => l.id === e.id)).length,
    upcoming_in_tous: buckets.upcoming.filter((e) => buckets.all.some((t) => t.id === e.id)).length,
    live_in_tous: buckets.live.filter((e) => buckets.all.some((t) => t.id === e.id)).length,
  };
  console.log('\n--- Cohérence attendue ---');
  console.log(`À venir ⊆ Tous: ${overlap.upcoming_in_tous}/${buckets.upcoming.length}`);
  console.log(`En cours ⊆ Tous: ${overlap.live_in_tous}/${buckets.live.length}`);
  console.log(`À venir ∩ En cours: ${overlap.upcoming_and_live} (devrait être 0)`);

  const nullStarts = onMap.filter((e) => !e.starts_at).length;
  const pastStarts = onMap.filter((e) => e.starts_at && new Date(e.starts_at) <= now).length;
  const futureStarts = onMap.filter((e) => e.starts_at && new Date(e.starts_at) > now).length;
  console.log('\n--- Répartition starts_at (carte) ---');
  console.log(`starts_at null: ${nullStarts}`);
  console.log(`starts_at <= now: ${pastStarts}`);
  console.log(`starts_at > now: ${futureStarts}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
