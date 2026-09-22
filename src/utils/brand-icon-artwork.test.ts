import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BRAND_ICON_STUDY_NAMES,
  brandIconArtwork,
} from '../constants/brand-icon-artwork';

describe('brand icon artwork (Duo végétal)', () => {
  it('keeps the twelve study glyphs', () => {
    assert.equal(BRAND_ICON_STUDY_NAMES.length, 12);
    for (const name of BRAND_ICON_STUDY_NAMES) {
      assert.ok(name in brandIconArtwork, `${name} missing from artwork`);
    }
  });

  it('keeps navigation, heart and disclosure glyphs used by the event sheet', () => {
    assert.ok(brandIconArtwork.heart.body.length > 0);
    assert.ok(brandIconArtwork.pin.body.length > 0);
    assert.ok(brandIconArtwork.calendar.body.length > 0);
    assert.ok(brandIconArtwork.navigation.body.length > 0);
    assert.ok(brandIconArtwork.back.detail.length > 0);
    assert.ok(brandIconArtwork.share.detail.length > 0);
  });
});
