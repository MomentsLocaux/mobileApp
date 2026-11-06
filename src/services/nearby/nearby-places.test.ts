import assert from 'node:assert/strict';
import fs from 'node:fs';
import { afterEach, describe, it } from 'node:test';
import { fetchNearbyFromMapbox, requestNearbyPlaces, selectMapboxPublicToken } from './nearby-places-client';
import {
  decideNearbyServerRequest,
  executeNearbyQuery,
  buildPlaceImageUrl,
  buildPlaceViewUrl,
  formatCrowDistance,
  GOOGLE_MAPS_ATTRIBUTION,
  isOfficialGoogleMapsUrl,
  NEARBY_FIELD_MASK,
  NEARBY_INCLUDED_TYPES,
  NEARBY_RADIUS_METERS,
  nearbyFieldMaskStaysOnProSku,
  normalizeNearbyPlaces,
  openOfficialPlaceUrl,
  parseMapboxCategoryCollection,
  planNearbyLoad,
  resetNearbyInflightForTests,
  resolveNearbyResultLimit,
  resolveNearbyTimeoutMs,
  shouldApplyNearbyResult,
  shouldRevealNearbySection,
  type NearbyFetchResult,
  type NearbyLoader,
  type NearbyRawPlace,
} from './nearby-places';

function ok(places: NearbyRawPlace[]): NearbyFetchResult {
  return { status: 'ok', places, attribution: '© Mapbox and its suppliers' };
}

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const ORIGIN = { latitude: 44.36, longitude: 5.14 };

const ready = {
  featureEnabled: true,
  providerAvailable: true,
  visible: true,
  eventId: EVENT_ID,
  latitude: ORIGIN.latitude,
  longitude: ORIGIN.longitude,
};

function place(overrides: Record<string, unknown> = {}): NearbyRawPlace {
  return {
    id: 'place-1',
    displayName: { text: 'Café du Cours' },
    primaryType: 'cafe',
    types: ['cafe', 'food'],
    location: { latitude: 44.361, longitude: 5.14 },
    googleMapsUri: 'https://maps.google.com/?cid=123',
    ...overrides,
  } as NearbyRawPlace;
}

afterEach(() => {
  resetNearbyInflightForTests();
});

describe('planNearbyLoad', () => {
  it('does not plan a call when the flag is off', () => {
    assert.equal(planNearbyLoad({ ...ready, featureEnabled: false }), 'skip-disabled');
  });

  it('does not plan a call for invalid coordinates', () => {
    assert.equal(planNearbyLoad({ ...ready, latitude: null, longitude: 5 }), 'skip-coordinates');
    assert.equal(planNearbyLoad({ ...ready, latitude: 0, longitude: 0 }), 'skip-coordinates');
    assert.equal(planNearbyLoad({ ...ready, latitude: Number.NaN, longitude: 5 }), 'skip-coordinates');
    assert.equal(planNearbyLoad({ ...ready, latitude: 91, longitude: 5 }), 'skip-coordinates');
  });

  it('does not plan a call before the section is near the viewport', () => {
    assert.equal(planNearbyLoad({ ...ready, visible: false }), 'skip-hidden');
  });

  it('does not plan a call while the provider is unwired', () => {
    assert.equal(planNearbyLoad({ ...ready, providerAvailable: false }), 'skip-provider');
  });
});

describe('executeNearbyQuery', () => {
  it('does not call the loader when the flag is off', async () => {
    let calls = 0;
    const loader: NearbyLoader = async () => {
      calls += 1;
      return ok([place()]);
    };
    const result = await executeNearbyQuery(
      { ...ready, featureEnabled: false },
      { loader },
    );
    assert.equal(result.status, 'disabled');
    assert.equal(calls, 0);
  });

  it('does not call the loader without valid coordinates', async () => {
    let calls = 0;
    const loader: NearbyLoader = async () => {
      calls += 1;
      return ok([]);
    };
    const result = await executeNearbyQuery(
      { ...ready, latitude: 0, longitude: 0 },
      { loader },
    );
    assert.equal(result.status, 'missing-coordinates');
    assert.equal(calls, 0);
  });

  it('returns the nearest places and drops fields we do not show', async () => {
    const farther = place({
      id: 'far',
      displayName: { text: 'Le Plus Loin' },
      location: { latitude: 44.364, longitude: 5.14 },
      rating: 4.9,
      reviews: [{ text: 'secret' }],
      photos: [{ name: 'photo' }],
      currentOpeningHours: { openNow: true },
    });
    const nearer = place({
      id: 'near',
      displayName: { text: 'Le Plus Proche' },
      primaryType: 'bar',
      location: { latitude: 44.3604, longitude: 5.14 },
    });
    let seenLimit = 0;
    const loader: NearbyLoader = async (query) => {
      seenLimit = query.limit;
      assert.equal(query.radiusMeters, NEARBY_RADIUS_METERS);
      assert.deepEqual(query.includedTypes, NEARBY_INCLUDED_TYPES);
      assert.deepEqual(query.fieldMask, NEARBY_FIELD_MASK);
      assert.equal(query.eventId, EVENT_ID);
      return ok([farther, nearer, place({ id: '', displayName: { text: 'Sans id' } })]);
    };
    const result = await executeNearbyQuery(ready, { loader, limit: 99 });
    assert.equal(seenLimit, 5);
    assert.equal(result.status, 'success');
    if (result.status !== 'success') return;
    assert.equal(result.attribution, '© Mapbox and its suppliers');
    assert.deepEqual(result.places.map((item) => item.id), ['near', 'far']);
    assert.equal(result.places[0]?.categoryLabel, 'Bar');
    assert.equal('rating' in result.places[0], false);
    assert.match(result.places[0]?.distanceLabel ?? '', /vol d’oiseau/);
    assert.doesNotMatch(result.places[0]?.distanceLabel ?? '', /min|pied|trajet/i);
  });

  it('caps the list at five nearest results', async () => {
    const places = Array.from({ length: 8 }, (_item, index) => place({
      id: `p-${index}`,
      displayName: { text: `Lieu ${index}` },
      location: { latitude: ORIGIN.latitude + (index + 1) * 0.001, longitude: ORIGIN.longitude },
    }));
    const loader: NearbyLoader = async () => ok(places);
    const result = await executeNearbyQuery(ready, { loader });
    assert.equal(result.status, 'success');
    if (result.status !== 'success') return;
    assert.equal(result.places.length, 5);
    assert.deepEqual(result.places.map((item) => item.id), ['p-0', 'p-1', 'p-2', 'p-3', 'p-4']);
  });

  it('returns an empty result without inventing a place', async () => {
    const loader: NearbyLoader = async () => ok([]);
    const result = await executeNearbyQuery(ready, { loader });
    assert.deepEqual(result, { status: 'empty' });
  });

  it('returns a timeout once and does not call again', async () => {
    let calls = 0;
    const loader: NearbyLoader = () => {
      calls += 1;
      return new Promise<NearbyFetchResult>(() => {});
    };
    const result = await executeNearbyQuery(ready, { loader, timeoutMs: 20 });
    assert.deepEqual(result, { status: 'error', reason: 'timeout' });
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(calls, 1);
  });

  it('returns an error when the loader fails', async () => {
    const loader: NearbyLoader = async () => {
      throw new Error('down');
    };
    const result = await executeNearbyQuery(ready, { loader, timeoutMs: 200 });
    assert.deepEqual(result, { status: 'error', reason: 'unavailable' });
  });

  it('shares one loader call for the same event', async () => {
    let calls = 0;
    const gate: { resolve: ((value: NearbyFetchResult) => void) | null } = { resolve: null };
    const loader: NearbyLoader = () => {
      calls += 1;
      return new Promise((resolve) => {
        gate.resolve = resolve;
      });
    };
    const first = executeNearbyQuery(ready, { loader, timeoutMs: 2000 });
    const second = executeNearbyQuery(ready, { loader, timeoutMs: 2000 });
    assert.equal(calls, 1);
    gate.resolve?.(ok([place()]));
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.status, 'success');
    assert.equal(b.status, 'success');
  });

  it('ignores a response aborted after the event changed', async () => {
    const gate: { resolve: ((value: NearbyFetchResult) => void) | null } = { resolve: null };
    const loader: NearbyLoader = () => new Promise((resolve) => {
      gate.resolve = resolve;
    });
    const signal = new AbortController();
    const pending = executeNearbyQuery(ready, { loader, signal: signal.signal, timeoutMs: 2000 });
    signal.abort();
    gate.resolve?.(ok([place({ displayName: { text: 'Trop tard' } })]));
    const result = await pending;
    assert.equal(result.status, 'aborted');
  });

  it('keeps the other listener when only one request is aborted', async () => {
    let calls = 0;
    const gate: { resolve: ((value: NearbyFetchResult) => void) | null } = { resolve: null };
    const loader: NearbyLoader = () => {
      calls += 1;
      return new Promise((resolve) => {
        gate.resolve = resolve;
      });
    };
    const signal = new AbortController();
    const first = executeNearbyQuery(ready, { loader, signal: signal.signal, timeoutMs: 2000 });
    const second = executeNearbyQuery(ready, { loader, timeoutMs: 2000 });
    signal.abort();
    gate.resolve?.(ok([place()]));
    const [left, right] = await Promise.all([first, second]);
    assert.equal(calls, 1);
    assert.equal(left.status, 'aborted');
    assert.equal(right.status, 'success');
  });

  it('does not call the loader when the provider is unavailable', async () => {
    let calls = 0;
    const loader: NearbyLoader = async () => {
      calls += 1;
      return ok([place()]);
    };
    const result = await executeNearbyQuery(
      { ...ready, providerAvailable: false },
      { loader },
    );
    assert.equal(result.status, 'blocked');
    assert.equal(calls, 0);
  });
});

describe('normalizeNearbyPlaces', () => {
  it('keeps a place with missing optional fields and drops an unofficial url', () => {
    const [kept] = normalizeNearbyPlaces([
      place({
        primaryType: 'museum',
        types: [],
        googleMapsUri: 'https://evil.example/place',
        imageUrl: 'https://evil.example/photo.jpg',
        location: undefined,
        latitude: undefined,
        longitude: undefined,
        attributions: ['Données partenaires', GOOGLE_MAPS_ATTRIBUTION],
      }),
    ], ORIGIN);
    assert.equal(kept?.name, 'Café du Cours');
    assert.equal(kept?.categoryLabel, null);
    assert.equal(kept?.distanceLabel, null);
    assert.equal(kept?.googleMapsUri, null);
    assert.equal(kept?.imageUrl, null);
    assert.deepEqual(kept?.attributions, ['Données partenaires']);
  });

  it('labels a coffee shop as a café and rejects other types', () => {
    const places = normalizeNearbyPlaces([
      place({ id: 'coffee', primaryType: 'coffee_shop', types: ['coffee_shop'] }),
      place({ id: 'museum', displayName: { text: 'Musée' }, primaryType: 'museum', types: ['museum'] }),
      place({ id: 'blank', displayName: { text: '   ' } }),
    ], ORIGIN);
    assert.deepEqual(places.map((item) => item.id), ['coffee']);
    assert.equal(places[0]?.categoryLabel, 'Café');
  });
});

describe('distance and links', () => {
  it('formats a straight-line distance', () => {
    assert.equal(formatCrowDistance(350), '350 m à vol d’oiseau');
    assert.match(formatCrowDistance(1200) ?? '', /^1,2 km à vol d’oiseau$/);
  });

  it('opens the place by name and shows a map preview without a pin', () => {
    const url = buildPlaceViewUrl({
      name: 'Café du Cours',
      address: '12 Rue du Test',
      locality: 'Nyons',
    });
    assert.equal(url, 'https://www.google.com/search?q=Caf%C3%A9%20du%20Cours%2012%20Rue%20du%20Test%20Nyons');
    assert.equal(url?.includes('/maps'), false);
    assert.equal(url?.includes('44.36'), false);
    const image = buildPlaceImageUrl(44.361, 5.14, 'pk.test-token');
    assert.equal(image?.startsWith('https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/5.14000,44.36100,16,0/400x220@2x'), true);
    assert.equal(image?.includes('pin-'), false);
    assert.equal(buildPlaceImageUrl(44.361, 5.14, 'sk.secret'), null);
  });

  it('accepts only official Google Maps https links', () => {
    assert.equal(isOfficialGoogleMapsUrl('https://maps.google.com/?cid=1'), true);
    assert.equal(isOfficialGoogleMapsUrl('https://www.google.com/maps/place/?q=place_id:abc'), true);
    assert.equal(isOfficialGoogleMapsUrl('https://maps.app.goo.gl/abc'), true);
    assert.equal(isOfficialGoogleMapsUrl('http://maps.google.com/?cid=1'), false);
    assert.equal(isOfficialGoogleMapsUrl('https://maps.google.com.evil.com/'), false);
    assert.equal(isOfficialGoogleMapsUrl('https://www.google.com/search?q=cafe'), true);
    assert.equal(isOfficialGoogleMapsUrl('https://www.google.com/search?q=cafe&btnI=1'), false);
    assert.equal(isOfficialGoogleMapsUrl('https://www.google.com/url?q=https://evil.example'), false);
    assert.equal(isOfficialGoogleMapsUrl('javascript:alert(1)'), false);
  });

  it('reports an opening failure and refuses an arbitrary url', async () => {
    let opened = '';
    const rejected = await openOfficialPlaceUrl('https://maps.google.com/?cid=1', async () => {
      throw new Error('no handler');
    });
    const blocked = await openOfficialPlaceUrl('https://evil.example', async (url) => {
      opened = url;
    });
    assert.equal(rejected, 'rejected');
    assert.equal(blocked, 'unavailable');
    assert.equal(opened, '');
  });
});

describe('viewport and stale results', () => {
  it('reveals only when the anchor approaches the viewport', () => {
    assert.equal(shouldRevealNearbySection(2000, 0, 700), false);
    assert.equal(shouldRevealNearbySection(2000, 1000, 700), true);
    assert.equal(shouldRevealNearbySection(null, 1000, 700), false);
  });

  it('drops a result that belongs to a previous request', () => {
    assert.equal(shouldApplyNearbyResult(2, 3), false);
    assert.equal(shouldApplyNearbyResult(3, 3), true);
  });
});

describe('server contract', () => {
  it('rejects a disabled flag, a bad id, and any field other than eventId', () => {
    assert.deepEqual(
      decideNearbyServerRequest({
        featureEnabled: false,
        body: { eventId: EVENT_ID },
        eventStatus: 'published',
      }),
      { ok: false, httpStatus: 404 },
    );
    assert.equal(
      decideNearbyServerRequest({
        featureEnabled: true,
        body: { eventId: 'nope' },
        eventStatus: 'published',
      }).ok,
      false,
    );
    assert.deepEqual(
      decideNearbyServerRequest({
        featureEnabled: true,
        body: { eventId: EVENT_ID, url: 'https://maps.googleapis.com' },
        eventStatus: 'published',
      }),
      { ok: false, httpStatus: 400 },
    );
    assert.equal(
      decideNearbyServerRequest({
        featureEnabled: true,
        body: { eventId: EVENT_ID, latitude: 44.3, longitude: 5.1 },
        eventStatus: 'published',
      }).ok,
      false,
    );
  });

  it('allows a published event for a guest and refuses other statuses', () => {
    const allowed = decideNearbyServerRequest({
      featureEnabled: true,
      body: { eventId: EVENT_ID },
      eventStatus: 'published',
      maxResults: 99,
    });
    assert.deepEqual(allowed, { ok: true, eventId: EVENT_ID, limit: 5 });
    for (const eventStatus of ['draft', 'pending', 'refused', 'archived', null]) {
      assert.equal(
        decideNearbyServerRequest({
          featureEnabled: true,
          body: { eventId: EVENT_ID },
          eventStatus,
        }).ok,
        false,
      );
    }
  });

  it('cannot raise the result cap above five', () => {
    assert.equal(resolveNearbyResultLimit(99), 5);
    assert.equal(resolveNearbyResultLimit(2), 2);
    assert.equal(resolveNearbyResultLimit(0), 1);
    assert.equal(nearbyFieldMaskStaysOnProSku(), true);
    assert.equal(resolveNearbyTimeoutMs(20), 1000);
    assert.equal(resolveNearbyTimeoutMs(20_000), 15_000);
  });
});

describe('client boundary', () => {
  it('does not call the network without a public token', async () => {
    const saved = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    const original = globalThis.fetch;
    let called = false;
    globalThis.fetch = (() => {
      called = true;
      throw new Error('network');
    }) as typeof fetch;
    try {
      assert.equal(selectMapboxPublicToken('sk.secret-token', ''), null);
      assert.equal(selectMapboxPublicToken('pk.public-token'), 'pk.public-token');
      const result = await requestNearbyPlaces({
        eventId: EVENT_ID,
        latitude: ORIGIN.latitude,
        longitude: ORIGIN.longitude,
        radiusMeters: NEARBY_RADIUS_METERS,
        includedTypes: NEARBY_INCLUDED_TYPES,
        limit: 5,
        fieldMask: NEARBY_FIELD_MASK,
      }, new AbortController().signal);
      assert.deepEqual(result, { status: 'blocked' });
      assert.equal(called, false);
    } finally {
      globalThis.fetch = original;
      if (saved === undefined) delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
      else process.env.EXPO_PUBLIC_MAPBOX_TOKEN = saved;
    }
  });

  it('loads cafés, bars and restaurants from Mapbox and drops private fields', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      assert.equal(url.searchParams.get('access_token'), 'pk.test-token');
      assert.equal(url.searchParams.get('language'), 'fr');
      assert.equal(url.searchParams.get('limit'), '10');
      assert.equal(url.searchParams.get('exclude_fields'), 'photos,reviews');
      assert.equal(url.searchParams.get('proximity'), `${ORIGIN.longitude},${ORIGIN.latitude}`);
      assert.equal(url.searchParams.has('eta_type'), false);
      const category = url.pathname.split('/').pop();
      const far = category === 'restaurant';
      return {
        ok: category !== 'bar',
        status: category === 'bar' ? 404 : 200,
        json: async () => ({
          attribution: '© Mapbox and its suppliers',
          features: [
            {
              properties: {
                mapbox_id: `${category}-1`,
                name: category,
                address: '12 Rue du Test',
                context: { place: { name: 'Nyons' } },
                poi_category_ids: category === 'coffee' ? ['coffee', 'cafe'] : [category],
                coordinates: {
                  latitude: ORIGIN.latitude + (far ? 0.02 : 0.001),
                  longitude: ORIGIN.longitude,
                },
                metadata: { phone: '0600000000', website: 'https://evil.example', open_hours: {} },
              },
            },
          ],
        }),
      } as Response;
    }) as typeof fetch;

    const result = await fetchNearbyFromMapbox({
      eventId: EVENT_ID,
      latitude: ORIGIN.latitude,
      longitude: ORIGIN.longitude,
      radiusMeters: NEARBY_RADIUS_METERS,
      includedTypes: NEARBY_INCLUDED_TYPES,
      limit: 5,
      fieldMask: NEARBY_FIELD_MASK,
    }, new AbortController().signal, { token: 'pk.test-token', fetchImpl });

    assert.deepEqual(calls.map((path) => path.split('/').pop()), ['coffee', 'restaurant', 'bar']);
    assert.equal(result.status, 'ok');
    if (result.status !== 'ok') return;
    assert.equal(result.attribution, '© Mapbox and its suppliers');
    assert.deepEqual(result.places.map((place) => place.id), ['coffee-1']);
    const uri = result.places[0]?.googleMapsUri;
    assert.equal(uri, 'https://www.google.com/search?q=coffee%2012%20Rue%20du%20Test%20Nyons');
    assert.equal(uri?.includes('/maps'), false);
    assert.equal(uri?.includes(String(ORIGIN.latitude)), false);
    const image = typeof result.places[0]?.imageUrl === 'string' ? new URL(result.places[0].imageUrl) : null;
    assert.equal(image?.hostname, 'api.mapbox.com');
    assert.equal(image?.pathname.includes('/static/'), true);
    assert.equal(image?.pathname.includes('pin-'), false);
    assert.equal(JSON.stringify(result.places).includes('0600000000'), false);
    assert.equal(JSON.stringify(result.places).includes('evil.example'), false);
    const parsed = parseMapboxCategoryCollection({
      attribution: '© Mapbox and its suppliers',
      features: [{ properties: { mapbox_id: 'x', name: '   ' } }],
    }, 'coffee');
    assert.deepEqual(parsed.places, []);
  });

  it('keeps Google credentials out of the client sources', () => {
    const files = [
      'src/services/nearby/nearby-places.ts',
      'src/services/nearby/nearby-places-client.ts',
      'src/hooks/useEventNearbyPlaces.ts',
      'src/components/events/EventNearbySection.tsx',
    ];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      assert.equal(/AIza[0-9A-Za-z_-]{10,}/.test(source), false, file);
      assert.equal(source.includes('places.googleapis.com'), false, file);
      assert.equal(source.includes('maps.googleapis.com'), false, file);
      assert.equal(source.includes('GOOGLE_MAPS_API_KEY'), false, file);
      assert.equal(source.includes('EXPO_PUBLIC_GOOGLE'), false, file);
    }
    const client = fs.readFileSync('src/services/nearby/nearby-places-client.ts', 'utf8');
    const flags = client.match(/EXPO_PUBLIC_[A-Z0-9_]+/g) ?? [];
    assert.deepEqual([...new Set(flags)].sort(), [
      'EXPO_PUBLIC_FEATURE_NEARBY_PLACES',
      'EXPO_PUBLIC_MAPBOX_TOKEN',
    ].sort());
  });
});
