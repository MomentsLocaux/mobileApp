import test from 'node:test';
import assert from 'node:assert/strict';
import { pickCorrectionDiff } from '../types/event-correction';
import {
  baselineCorrectionFields,
  buildDuplicateCorrectionComment,
  buildFieldCorrectionComment,
  changedCorrectionGroupLabels,
  countTodayCorrectionProposals,
  diffCorrectionFields,
  formatCorrectionQuotaLabel,
  proposedCorrectionFields,
} from './event-correction';
import type { EventScheduleDraft } from './event-schedule';

const schedule: EventScheduleDraft = {
  startDate: '2026-09-12T16:00:00.000Z',
  endDate: '2026-09-12T18:00:00.000Z',
  scheduleMode: 'single_day',
  scheduleOpenDays: [1, 2, 3, 4, 5, 6, 7],
  scheduleFixedSlots: [{ start: '09:00', end: '18:00' }],
  scheduleVariableDays: {},
};

const event = {
  id: 'evt-1',
  creator_id: 'u1',
  title: 'Marché',
  description: 'Ancien texte',
  category: 'cat-1',
  subcategory: 'sub-1',
  tags: [],
  starts_at: '2026-09-12T16:00:00.000Z',
  ends_at: '2026-09-12T18:00:00.000Z',
  schedule_mode: 'ponctuel',
  recurrence_rule: null,
  latitude: 45.75,
  longitude: 4.85,
  address: '1 rue des Halles',
  city: 'Lyon',
  postal_code: '69001',
  venue_name: 'Halles',
  visibility: 'public' as const,
  is_free: true,
  price: null,
  cover_url: 'https://example.com/cover.jpg',
  max_participants: null,
  registration_required: null,
  external_url: 'https://example.com',
  operating_hours: null,
  comments_count: 0,
  media_count: 0,
  rating_count: 0,
  rating_avg: 0,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  status: 'published',
  ambiance: null,
};

test('pickCorrectionDiff keeps only user-submittable fields', () => {
  const picked = pickCorrectionDiff({
    title: 'Nouveau titre',
    description: 'Nouveau texte',
    cover_url: 'https://example.com/x.jpg',
    price: 8,
    is_free: false,
    category: 'cat-2',
  });
  assert.equal('title' in picked, false);
  assert.equal('description' in picked, false);
  assert.equal('cover_url' in picked, false);
  assert.equal(picked.price, 8);
  assert.equal(picked.category, 'cat-2');
});

test('diff ignores untouched schedule and place', () => {
  const baseline = baselineCorrectionFields(event as any, schedule);
  const next = proposedCorrectionFields({
    schedule,
    location: {
      latitude: 45.75,
      longitude: 4.85,
      addressLabel: '1 rue des Halles',
      city: 'Lyon',
      postalCode: '69001',
      country: 'FR',
    },
    venueName: 'Halles',
    isFree: true,
    price: '',
    category: 'cat-1',
    subcategory: 'sub-1',
  });
  assert.deepEqual(diffCorrectionFields(baseline, next), {});
});

test('generated comment describes only the groups that changed', () => {
  const baseline = baselineCorrectionFields(event as any, schedule);
  const next = proposedCorrectionFields({
    schedule: {
      ...schedule,
      startDate: '2026-09-12T18:00:00.000Z',
      endDate: '2026-09-12T20:00:00.000Z',
    },
    location: {
      latitude: 45.76,
      longitude: 4.86,
      addressLabel: '2 place de la Paix',
      city: 'Villeurbanne',
      postalCode: '69100',
      country: 'FR',
    },
    venueName: 'Halle Tropique',
    isFree: false,
    price: '8',
    category: 'cat-2',
    subcategory: '',
  });
  const diff = diffCorrectionFields(baseline, next);
  assert.deepEqual(changedCorrectionGroupLabels(diff).sort(), [
    'Catégorie et sous-catégorie',
    'Date et horaires',
    'Lieu',
    'Tarif',
  ].sort());

  const comment = buildFieldCorrectionComment({
    diff,
    baseline,
    labels: {
      category: (id) => (id === 'cat-2' ? 'Concert' : 'Marché'),
      subcategory: (id) => (id ? 'Ancienne' : 'aucune'),
    },
  });
  assert.match(comment, /^Correction proposée — /);
  assert.match(comment, /Date et horaires/);
  assert.match(comment, /Lieu/);
  assert.match(comment, /Tarif : gratuit devient 8 €/);
  assert.match(comment, /Catégorie et sous-catégorie : Marché \/ Ancienne devient Concert \/ aucune/);
  assert.doesNotMatch(comment, /Nouveau titre|Ancien texte|cover/i);
});

test('duplicate justification includes both event ids for moderation', () => {
  const comment = buildDuplicateCorrectionComment({
    comment: 'Même concert, deux fiches',
    sourceEventId: 'src-1',
    duplicateEventId: 'dup-2',
  });
  assert.match(comment, /^Même concert, deux fiches/);
  assert.match(comment, /fiche signalée : src-1/);
  assert.match(comment, /fiche présumée doublon : dup-2/);
});

test('duplicate justification keeps a placeholder when the other fiche is unknown', () => {
  const comment = buildDuplicateCorrectionComment({
    comment: 'Doublon sans id',
    sourceEventId: 'src-1',
  });
  assert.match(comment, /fiche présumée doublon : non identifiée/);
});

test('quota label and today count ignore bugs and yesterday', () => {
  const now = new Date('2026-09-02T15:00:00.000Z');
  assert.equal(formatCorrectionQuotaLabel(3), '3 / 10 propositions aujourd’hui');
  assert.equal(
    countTodayCorrectionProposals(
      [
        { kind: 'duplicate', createdAt: '2026-09-02T01:00:00.000Z' },
        { kind: 'field_correction', createdAt: '2026-09-02T10:00:00.000Z' },
        { kind: 'field_correction', createdAt: '2026-09-01T23:00:00.000Z' },
        { kind: 'bug', createdAt: '2026-09-02T12:00:00.000Z' },
        { kind: 'event_suggest', createdAt: '2026-09-02T12:00:00.000Z' },
      ],
      now,
    ),
    2,
  );
});
