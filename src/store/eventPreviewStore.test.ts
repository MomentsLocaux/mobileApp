import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { EventMedia, EventWithCreator } from '../types/database';
import {
  EVENT_CACHE_BULK_LIMIT,
  EVENT_CACHE_PERSIST_LIMIT,
  collectPinnedIds,
  mergeCachedEvent,
  partializeEventCache,
  pinOpenedEventIntoCache,
  pinVisibleEventsIntoCache,
  rememberEventsIntoCache,
  eventHeroIdentity,
  EMPTY_EVENT_CACHE,
} from './eventCache';
import {
  resolveCachedMapEvent,
  resolveSeededEventDetail,
  useEventPreviewStore,
} from './eventPreviewStore';

const sample = (id: string, title: string, extra?: Partial<EventWithCreator>): EventWithCreator =>
  ({ id, title, ...extra } as EventWithCreator);

const media = (id: string, url: string): EventMedia =>
  ({
    id,
    event_id: 'a',
    url,
    type: 'image',
    order: 0,
    created_at: '2026-01-01',
  }) as EventMedia;

describe('event cache merge', () => {
  it('keeps a non-empty cover when the next payload sends null', () => {
    const merged = mergeCachedEvent(
      sample('a', 'Concert', { cover_url: 'https://cdn.example/cover.jpg' }),
      sample('a', 'Concert', { cover_url: null }),
    );
    assert.equal(merged.cover_url, 'https://cdn.example/cover.jpg');
  });

  it('does not replace an existing cover URI with a different one', () => {
    const merged = mergeCachedEvent(
      sample('a', 'Concert', { cover_url: 'https://cdn.example/list.jpg' }),
      sample('a', 'Concert', { cover_url: 'https://cdn.example/original.jpg' }),
    );
    assert.equal(merged.cover_url, 'https://cdn.example/list.jpg');
  });

  it('keeps existing media URLs when enrich sends a different url for the same id', () => {
    const merged = mergeCachedEvent(
      sample('a', 'Concert', { media: [media('m1', 'https://cdn.example/list.jpg')] }),
      sample('a', 'Concert', { media: [media('m1', 'https://cdn.example/original.jpg')] }),
    );
    assert.equal(merged.media[0]?.url, 'https://cdn.example/list.jpg');
  });

  it('keeps the hero identity stable when only stats change', () => {
    const seed = sample('a', 'Concert', { cover_url: 'https://cdn.example/cover.jpg' });
    const merged = mergeCachedEvent(seed, sample('a', 'Concert', {
      cover_url: 'https://cdn.example/other.jpg',
      likes_count: 12,
    } as EventWithCreator));
    assert.equal(eventHeroIdentity(seed), eventHeroIdentity(merged));
  });
});

describe('event preview cache', () => {
  beforeEach(() => {
    useEventPreviewStore.setState({ ...EMPTY_EVENT_CACHE });
  });

  it('returns a remembered event without waiting for the network', () => {
    useEventPreviewStore.getState().rememberEvent(sample('a', 'Concert'));
    assert.equal(useEventPreviewStore.getState().getCachedEvent('a')?.title, 'Concert');
  });

  it('merges a later payload onto the same id', () => {
    useEventPreviewStore.getState().rememberEvent(sample('a', 'Concert'));
    useEventPreviewStore.getState().rememberEvent({
      ...sample('a', 'Concert'),
      cover_url: 'https://cdn.example/cover.jpg',
    } as EventWithCreator);
    assert.equal(
      useEventPreviewStore.getState().getCachedEvent('a')?.cover_url,
      'https://cdn.example/cover.jpg',
    );
  });

  it('evicts the oldest unpinned events when the bulk cache is full', () => {
    const events = Array.from({ length: EVENT_CACHE_BULK_LIMIT + 2 }, (_, index) =>
      sample(`e-${index}`, `Event ${index}`),
    );
    useEventPreviewStore.getState().rememberEvents(events);
    assert.equal(useEventPreviewStore.getState().getCachedEvent('e-0'), null);
    assert.ok(useEventPreviewStore.getState().getCachedEvent(`e-${EVENT_CACHE_BULK_LIMIT + 1}`));
  });

  it('does not evict pinned Home events when a larger map ingest arrives', () => {
    const home = Array.from({ length: 8 }, (_, index) => sample(`home-${index}`, `Home ${index}`));
    useEventPreviewStore.getState().rememberEvents(home);
    useEventPreviewStore.getState().pinVisibleEvents(
      'home',
      home.map((event) => event.id),
    );
    const mapBulk = Array.from({ length: EVENT_CACHE_BULK_LIMIT + 5 }, (_, index) =>
      sample(`map-${index}`, `Map ${index}`),
    );
    useEventPreviewStore.getState().rememberEvents(mapBulk);
    assert.equal(useEventPreviewStore.getState().getCachedEvent('home-0')?.title, 'Home 0');
    assert.equal(useEventPreviewStore.getState().getCachedEvent('map-0'), null);
  });

  it('seeds map detail from the transition payload first', () => {
    useEventPreviewStore.getState().rememberEvent(sample('cached', 'Cached'));
    const seeded = resolveSeededEventDetail({
      eventId: 'live',
      origin: 'map-unit',
      mapOrigin: 'map-unit',
      mapEventId: 'live',
      mapEvent: sample('live', 'From map'),
    });
    assert.equal(seeded?.title, 'From map');
  });

  it('seeds a feed detail from the preview cache', () => {
    useEventPreviewStore.getState().rememberEvent(sample('home', 'Home card'));
    const seeded = resolveSeededEventDetail({
      eventId: 'home',
      origin: undefined,
    });
    assert.equal(seeded?.title, 'Home card');
  });

  it('pins an opened event so a later bulk ingest cannot evict it', () => {
    useEventPreviewStore.getState().prepareEventDetail(sample('open', 'Opened'));
    const mapBulk = Array.from({ length: EVENT_CACHE_BULK_LIMIT + 5 }, (_, index) =>
      sample(`map-${index}`, `Map ${index}`),
    );
    useEventPreviewStore.getState().rememberEvents(mapBulk);
    assert.equal(useEventPreviewStore.getState().getCachedEvent('open')?.title, 'Opened');
  });

  it('resolves a map pin from the preview cache before scanning lists', () => {
    useEventPreviewStore.getState().rememberEvent(sample('pin', 'Pin'));
    const resolved = resolveCachedMapEvent('pin', [[{ id: 'other', title: 'Other' } as EventWithCreator]]);
    assert.equal(resolved?.title, 'Pin');
  });
});

describe('event cache persist slice', () => {
  it('keeps pinned events inside the persist cap', () => {
    let state = EMPTY_EVENT_CACHE;
    const home = Array.from({ length: 12 }, (_, index) => sample(`h-${index}`, `H ${index}`));
    state = rememberEventsIntoCache(state, home);
    state = pinVisibleEventsIntoCache(
      state,
      'home',
      home.map((event) => event.id),
    );
    state = pinOpenedEventIntoCache(state, 'h-0');
    const persisted = partializeEventCache(state);
    assert.ok(persisted.byId['h-0']);
    assert.ok(collectPinnedIds(persisted).has('h-0'));
    assert.ok(Object.keys(persisted.byId).length <= EVENT_CACHE_PERSIST_LIMIT);
  });
});
