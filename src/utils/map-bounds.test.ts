import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeMapBounds,
  shouldUseViewportGrid,
  splitBoundsIntoGrid,
  insetMapBoundsByPixels,
  getMapQueryChromeInsets,
} from './map-bounds';

describe('map bounds tiling', () => {
  it('normalizes swapped corners into an AABB', () => {
    const normalized = normalizeMapBounds({
      ne: [-5, 42],
      sw: [8, 51],
    });
    assert.deepEqual(normalized, {
      sw: [-5, 42],
      ne: [8, 51],
    });
  });

  it('tiles wide bounds into a 2x2 grid covering the parent', () => {
    const cells = splitBoundsIntoGrid(
      {
        sw: [-8, 40],
        ne: [12, 52],
      },
      2,
      2
    );
    assert.equal(cells.length, 4);
    assert.deepEqual(cells[0], { sw: [-8, 40], ne: [2, 46] });
    assert.deepEqual(cells[3], { sw: [2, 46], ne: [12, 52] });
  });

  it('enables grid fetch for country zoom / large spans', () => {
    assert.equal(
      shouldUseViewportGrid({ sw: [-8, 40], ne: [12, 52] }, 6),
      true
    );
    assert.equal(
      shouldUseViewportGrid({ sw: [2.2, 48.8], ne: [2.5, 49.0] }, 14),
      false
    );
  });
});

describe('map bounds chrome inset', () => {
  it('raises the south edge for the peek sheet and pads the other sides', () => {
    const inset = insetMapBoundsByPixels(
      { sw: [0, 0], ne: [100, 100] },
      { width: 100, height: 100 },
      { top: 10, right: 10, bottom: 20, left: 10 }
    );
    assert.deepEqual(inset, {
      sw: [10, 20],
      ne: [90, 90],
    });
  });

  it('uses peek + edge defaults from getMapQueryChromeInsets', () => {
    const chrome = getMapQueryChromeInsets();
    assert.ok(chrome.bottom > chrome.top);
    assert.equal(chrome.left, chrome.right);
    const inset = insetMapBoundsByPixels(
      { sw: [2, 48], ne: [3, 49] },
      { width: 400, height: 800 },
      chrome
    );
    assert.ok(inset.sw[1] > 48);
    assert.ok(inset.ne[1] < 49);
    assert.ok(inset.sw[0] > 2);
    assert.ok(inset.ne[0] < 3);
  });
});
