import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

// Execute the production TS modules, replacing only network/native boundaries.
function loadModule(path, dependencies) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  const load = (name) => name in dependencies ? dependencies[name] : require(name);
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename: path })(load, module, module.exports);
  return module.exports;
}

const event = { id: 'event-1', title: 'Concert' };
const off = { isLiked: false, isFavorite: false };
const on = { isLiked: true, isFavorite: true };

function fixture(initial = on) {
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const likes = loadModule('src/store/likesStore.ts', { './persistStorage': { persistStorage: storage } }).useLikesStore;
  const favorites = loadModule('src/store/favoritesStore.ts', { './persistStorage': { persistStorage: storage } }).useFavoritesStore;
  let userId = 'alice';
  const server = { ...initial };
  const calls = [];
  const service = {
    unlike: async (user, id) => { calls.push(['unlike', user, id]); server.isLiked = false; },
    removeFavorite: async (user, id) => { calls.push(['removeFavorite', user, id]); server.isFavorite = false; },
    like: async () => { calls.push(['like']); return (server.isLiked = !server.isLiked); },
    toggleFavorite: async () => { calls.push(['toggleFavorite']); return (server.isFavorite = !server.isFavorite); },
    getHeartState: async () => { calls.push(['read']); return { ...server }; },
  };
  const heart = loadModule('src/utils/event-heart.ts', {
    '@/services/social.service': { SocialService: service },
    '@/state/auth': { useAuthStore: { getState: () => ({ session: userId ? { user: { id: userId } } : null }) } },
    '@/store/likesStore': { useLikesStore: likes },
    '@/store/favoritesStore': { useFavoritesStore: favorites },
  });
  const local = () => ({ isLiked: likes.getState().isLiked(event.id), isFavorite: favorites.getState().isFavorite(event.id) });
  return { heart, likes, favorites, server, service, calls, local, switchUser: (id) => { userId = id; } };
}

for (const initial of [{ isLiked: true, isFavorite: false }, { isLiked: false, isFavorite: true }, on, off]) {
  test(`active stale heart removes both relations: ${JSON.stringify(initial)}`, async () => {
    const f = fixture(initial);
    f.likes.getState().setLiked(event.id, true);
    f.favorites.getState().setFavorite(event, true);
    assert.deepEqual(await f.heart.toggleEventHeart('alice', event, on), off);
    assert.deepEqual(f.server, off);
    assert.deepEqual(f.local(), off);
    await f.heart.removeEventHeart('alice', event);
    assert.deepEqual(f.server, off, 'repeated removal must never recreate a relation');
    assert.equal(f.calls.some(([name]) => name === 'like' || name === 'toggleFavorite'), false);
    assert.ok(f.calls.every(([, user, id]) => user === 'alice' && id === event.id));
  });
}

test('remove both server relations even when the client knows only the like', async () => {
  const f = fixture(on);
  await f.heart.toggleEventHeart('alice', event, { isLiked: true, isFavorite: false });
  assert.deepEqual(f.server, off);
});

test('two simultaneous taps share one mutation and do not toggle stores twice', async () => {
  const f = fixture(on);
  const first = f.heart.toggleEventHeart('alice', event, on);
  const second = f.heart.toggleEventHeart('alice', event, on);
  assert.equal(first, second);
  await Promise.all([first, second]);
  assert.equal(f.calls.filter(([name]) => name === 'unlike').length, 1);
  assert.equal(f.calls.filter(([name]) => name === 'removeFavorite').length, 1);
  assert.deepEqual(f.local(), off);
});

test('explicit swipe removal stays a removal even when the local heart is already inactive', async () => {
  const f = fixture(on);
  assert.deepEqual(f.local(), off);
  await f.heart.removeEventHeart('alice', event);
  assert.deepEqual(f.server, off);
  assert.deepEqual(f.local(), off);
  assert.deepEqual(f.calls.map(([name]) => name), ['unlike', 'removeFavorite']);
});

test('swipe removal and heart activation share the same pending operation', async () => {
  const f = fixture(on);
  const removal = f.heart.removeEventHeart('alice', event);
  const heart = f.heart.toggleEventHeart('alice', event, on);
  assert.equal(removal, heart);
  await Promise.all([removal, heart]);
  assert.deepEqual(f.server, off);
  assert.deepEqual(f.calls.map(([name]) => name), ['unlike', 'removeFavorite']);
});

for (const failed of ['unlike', 'removeFavorite']) {
  test(`partial failure (${failed}) reconciles before allowing a retry`, async () => {
    const f = fixture(on);
    f.likes.getState().setLiked(event.id, true);
    f.favorites.getState().setFavorite(event, true);
    const original = f.service[failed];
    f.service[failed] = async () => { throw new Error('network'); };
    await assert.rejects(f.heart.removeEventHeart('alice', event), /network/);
    assert.deepEqual(f.local(), f.server);
    assert.equal(f.server.isLiked || f.server.isFavorite, true);
    f.service[failed] = original;
    await f.heart.toggleEventHeart('alice', event, f.local());
    assert.deepEqual(f.server, off);
    assert.deepEqual(f.local(), off);
  });
}

test('reconciliation waits for the slower write after the other one failed', async () => {
  const f = fixture(on);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  f.service.unlike = async () => { throw new Error('failed'); };
  f.service.removeFavorite = async () => { await gate; f.server.isFavorite = false; };
  const result = assert.rejects(f.heart.removeEventHeart('alice', event), /failed/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.calls.some(([name]) => name === 'read'), false);
  release();
  await result;
  assert.deepEqual(f.local(), { isLiked: true, isFavorite: false });
});

test('offline reconciliation preserves last known state and a retry works', async () => {
  const f = fixture(on);
  f.likes.getState().setLiked(event.id, true);
  f.favorites.getState().setFavorite(event, true);
  const original = f.service.removeFavorite;
  f.service.removeFavorite = async () => { throw new Error('offline'); };
  f.service.getHeartState = async () => { throw new Error('offline read'); };
  await assert.rejects(f.heart.removeEventHeart('alice', event), /offline/);
  assert.deepEqual(f.local(), on);
  f.service.removeFavorite = original;
  await f.heart.removeEventHeart('alice', event);
  assert.deepEqual(f.local(), off);
});

test('stale inactive state still adds a heart and keeps both stores active', async () => {
  const f = fixture(on);
  await f.heart.toggleEventHeart('alice', event, off);
  assert.deepEqual(f.server, on);
  assert.deepEqual(f.local(), on);
});

test('idempotent store setters preserve unrelated events and support hydration above 200 items', () => {
  const f = fixture();
  const events = Array.from({ length: 250 }, (_, i) => ({ id: `event-${i}` }));
  f.favorites.getState().replaceFavorites(events);
  f.likes.getState().replaceLikes(events.map((item) => item.id));
  f.favorites.getState().setFavorite(event, false);
  f.favorites.getState().setFavorite(event, false);
  f.likes.getState().setLiked(event.id, false);
  f.likes.getState().setLiked(event.id, false);
  assert.equal(f.favorites.getState().favorites.length, 249);
  assert.equal(f.likes.getState().likedEventIds.length, 249);
  assert.equal(f.favorites.getState().isFavorite('event-249'), true);
});

test('an in-flight result cannot overwrite stores after an account switch', async () => {
  const f = fixture(on);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  f.service.unlike = async () => { await gate; f.server.isLiked = false; };
  const result = assert.rejects(f.heart.removeEventHeart('alice', event), /session/);
  await new Promise((resolve) => setImmediate(resolve));
  f.switchUser('bob');
  f.likes.getState().setLiked(event.id, true);
  f.favorites.getState().setFavorite(event, true);
  release();
  await result;
  assert.deepEqual(f.local(), on);
  assert.equal(f.calls.some(([name]) => name === 'read'), false);
});

function readDatabase(rows, fail = false) {
  const queries = [];
  return {
    queries,
    from(table) {
      const filters = {};
      const result = () => {
        queries.push({ table, filters });
        return fail ? { data: null, error: new Error('read failed') }
          : { data: rows[table].filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value)), error: null };
      };
      const query = {
        delete: () => query,
        select: () => query,
        eq: (key, value) => { filters[key] = value; return query; },
        limit: async () => result(),
        maybeSingle: async () => { const value = result(); return { ...value, data: value.data?.[0] ?? null }; },
        then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
      };
      return query;
    },
  };
}

const rows = {
  favorites: [{ event_id: 'favorite', profile_id: 'alice' }, { event_id: 'both', profile_id: 'alice' }, { event_id: 'other', profile_id: 'bob' }],
  event_likes: [{ event_id: 'like', user_id: 'alice' }, { event_id: 'both', user_id: 'alice' }, { event_id: 'other', user_id: 'bob' }],
};

test('agenda keeps real favorites and likes separate from their display union', async () => {
  const db = readDatabase(rows);
  const { AgendaService } = loadModule('src/services/agenda.service.ts', {
    '@/lib/supabase/client': { supabase: db },
    '@/services/events.service': { EventsService: {} },
    '@/utils/schema-missing': { isMissingSchemaError: () => false },
    '@/utils/suggestion-history': { isCommunitySuggestedEvent: () => false },
  });
  const result = await AgendaService.listHeartMembership('alice');
  assert.deepEqual(result.favoriteIds, ['favorite', 'both']);
  assert.deepEqual(result.likedIds, ['like', 'both']);
  assert.deepEqual(result.interestedIds, ['favorite', 'both', 'like']);
  assert.deepEqual(await AgendaService.listInterestedEventIds('alice'), result.interestedIds);
});

test('reconciliation reads only this user and event, and never treats a failed read as absence', async () => {
  const db = readDatabase(rows);
  const { SocialService } = loadModule('src/services/social.service.ts', {
    '@/lib/supabase/client': { supabase: db }, '@/data-provider': { dataProvider: {} },
  });
  assert.deepEqual(await SocialService.getHeartState('alice', 'like'), { isLiked: true, isFavorite: false });
  assert.deepEqual(await SocialService.getHeartState('alice', 'other'), off);
  const failed = loadModule('src/services/social.service.ts', {
    '@/lib/supabase/client': { supabase: readDatabase(rows, true) }, '@/data-provider': { dataProvider: {} },
  });
  await assert.rejects(failed.SocialService.getHeartState('alice', 'like'), /read failed/);
});

test('both removals keep the initiating account and event as mandatory filters', async () => {
  const db = readDatabase(rows);
  const { SocialService } = loadModule('src/services/social.service.ts', {
    '@/lib/supabase/client': { supabase: db }, '@/data-provider': { dataProvider: {} },
  });
  await SocialService.unlike('alice', 'like');
  await SocialService.removeFavorite('alice', 'favorite');
  assert.deepEqual(db.queries, [
    { table: 'event_likes', filters: { user_id: 'alice', event_id: 'like' } },
    { table: 'favorites', filters: { profile_id: 'alice', event_id: 'favorite' } },
  ]);
});
