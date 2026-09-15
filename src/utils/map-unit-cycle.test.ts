import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  unitCycleCardReveal,
  unitCycleSheetReveal,
  UNIT_CARD_CYCLE_CARD_START,
  UNIT_CARD_CYCLE_SHEET_END,
} from './map-unit-cycle';

describe('map unit card cycle', () => {
  it('hides the sheet before the unit card is fully visible', () => {
    assert.equal(unitCycleSheetReveal(0), 1);
    assert.equal(unitCycleSheetReveal(UNIT_CARD_CYCLE_SHEET_END), 0);
    assert.equal(unitCycleSheetReveal(1), 0);
    assert.ok(unitCycleSheetReveal(0.2) > unitCycleSheetReveal(0.4));
  });

  it('brings the unit card in with overlap after the sheet has started leaving', () => {
    assert.equal(unitCycleCardReveal(0), 0);
    assert.equal(unitCycleCardReveal(UNIT_CARD_CYCLE_CARD_START), 0);
    assert.equal(unitCycleCardReveal(1), 1);
    assert.ok(unitCycleCardReveal(0.7) > 0);
    assert.ok(unitCycleCardReveal(0.7) < 1);
    const overlapProgress = (UNIT_CARD_CYCLE_SHEET_END + UNIT_CARD_CYCLE_CARD_START) / 2;
    assert.ok(unitCycleSheetReveal(overlapProgress) > 0);
    assert.ok(unitCycleCardReveal(overlapProgress) > 0);
  });
});
