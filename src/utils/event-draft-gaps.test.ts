import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatEventDraftGaps, listEventDraftContinueGaps, type EventDraftGapInput } from './event-draft-gaps';

const ready = (overrides: Partial<EventDraftGapInput> = {}): EventDraftGapInput => ({
  step: 0,
  title: 'Roller disco',
  startDate: '2026-11-05T18:00:00.000Z',
  endDate: '2026-11-05T22:00:00.000Z',
  hasLocation: true,
  hasCategory: true,
  hasCover: true,
  scheduleMode: 'single_day',
  scheduleOpenDays: [],
  scheduleFixedSlots: [],
  scheduleVariableDays: {},
  ...overrides,
});

describe('event draft continue gaps', () => {
  it('names each missing field on the first step', () => {
    const gaps = listEventDraftContinueGaps(
      ready({
        title: '  ',
        startDate: undefined,
        endDate: undefined,
        hasLocation: false,
      }),
    );
    assert.deepEqual(gaps, ['un titre', 'une date de début', 'une date de fin', 'un lieu']);
  });

  it('lets a complete first step continue', () => {
    assert.deepEqual(listEventDraftContinueGaps(ready()), []);
  });

  it('asks for a category only from the second step', () => {
    assert.deepEqual(listEventDraftContinueGaps(ready({ hasCategory: false })), []);
    assert.deepEqual(listEventDraftContinueGaps(ready({ step: 1, hasCategory: false })), ['une catégorie']);
  });

  it('asks for a cover on the cover step and at submit', () => {
    assert.deepEqual(listEventDraftContinueGaps(ready({ step: 2, hasCover: false })), ['une couverture']);
    assert.ok(listEventDraftContinueGaps(ready({ step: 3, hasCover: false })).includes('une couverture'));
  });

  it('names an invalid multi-day schedule instead of a generic block', () => {
    const gaps = listEventDraftContinueGaps(
      ready({
        endDate: '2026-11-07T22:00:00.000Z',
        scheduleMode: 'single_day',
      }),
    );
    assert.deepEqual(gaps, ['Pour plusieurs jours, choisissez des horaires fixes ou variables']);
  });

  it('formats the alert as a bullet list', () => {
    assert.equal(formatEventDraftGaps(['un titre', 'un lieu']), '• un titre\n• un lieu');
  });
});
