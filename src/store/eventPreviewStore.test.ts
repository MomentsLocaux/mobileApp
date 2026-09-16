import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { EventWithCreator } from '../types/database';
import {
  EVENT_PREVIEW_CACHE_LIMIT,
  resolveCachedMapEvent,
  resolveSeededEventDetail,
  useEventPreviewStore,
} from './eventPreviewStore';

const sample = (id: string, title: string): EventWithCreator =>
  ({ id, title } as EventWithCreator);

describe('event preview cache', () => {
  beforeEach(() => {
    useEventPreviewStore.setState({ byId: {}, order: [] });
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

  it('evicts the oldest events when the cache is full', () => {
    const events = Array.from({ length: EVENT_PREVIEW_CACHE_LIMIT + 2 }, (_, index) =>
      sample(`e-${index}`, `Event ${index}`),
    );
    useEventPreviewStore.getState().rememberEvents(events);
    assert.equal(useEventPreviewStore.getState().getCachedEvent('e-0'), null);
    assert.ok(useEventPreviewStore.getState().getCachedEvent(`e-${EVENT_PREVIEW_CACHE_LIMIT + 1}`));
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

  it('resolves a map pin from the preview cache before scanning lists', () => {
    useEventPreviewStore.getState().rememberEvent(sample('pin', 'Pin'));
    const resolved = resolveCachedMapEvent('pin', [[{ id: 'other', title: 'Other' } as EventWithCreator]]);
    assert.equal(resolved?.title, 'Pin');
  });
});
