import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRIBUTION_FAB_SIZE,
  clampContributionFabDragPosition,
  clampContributionFabPosition,
  defaultContributionFabPosition,
  getContributionFabAccessibilityLabel,
  getContributionFabBounds,
  parseContributionFabStoredPosition,
  resolveContributionFabRelease,
  restoreContributionFabPosition,
  shouldShowContributionFab,
  snapContributionFabToEdge,
} from './contribution-fab';

const portrait = getContributionFabBounds({
  width: 390,
  height: 844,
  topInset: 47,
  leftInset: 0,
  rightInset: 0,
  tabBarHeight: 94,
});

test('FAB is shown for contribute even when logged out', () => {
  assert.equal(shouldShowContributionFab({ canContribute: true, isAuthenticated: false }), true);
});

test('FAB is shown for authenticated users so they can report a bug', () => {
  assert.equal(shouldShowContributionFab({ canContribute: false, isAuthenticated: true }), true);
});

test('FAB is hidden when there is nothing to contribute or report', () => {
  assert.equal(shouldShowContributionFab({ canContribute: false, isAuthenticated: false }), false);
});

test('accessibility label covers both contribute and bug report when both exist', () => {
  assert.equal(
    getContributionFabAccessibilityLabel({ canContribute: true, canReportBug: true }),
    'Suggérer un événement ou signaler un bug',
  );
});

test('accessibility label is bug-only when contribute is unavailable', () => {
  assert.equal(
    getContributionFabAccessibilityLabel({ canContribute: false, canReportBug: true }),
    'Reporter un bug ou suggérer une amélioration',
  );
});

test('default FAB sits bottom-right above the tab bar', () => {
  const point = defaultContributionFabPosition(portrait);
  assert.equal(point.x, portrait.maxX);
  assert.equal(point.y, portrait.maxY);
  assert.ok(point.y + CONTRIBUTION_FAB_SIZE + 16 <= 844 - 94);
});

test('clamp keeps the FAB inside the safe rectangle', () => {
  const point = clampContributionFabPosition(-40, 9000, portrait);
  assert.equal(point.x, portrait.minX);
  assert.equal(point.y, portrait.maxY);
});

test('drag clamp can leave a peek strip off-screen', () => {
  const left = clampContributionFabDragPosition(-80, 200, portrait);
  const right = clampContributionFabDragPosition(800, 200, portrait);
  assert.equal(left.x, portrait.peekMinX);
  assert.equal(right.x, portrait.peekMaxX);
});

test('snap uses the nearest vertical edge', () => {
  const left = snapContributionFabToEdge(40, 200, portrait);
  const right = snapContributionFabToEdge(300, 200, portrait);
  assert.equal(left.x, portrait.minX);
  assert.equal(right.x, portrait.maxX);
  assert.equal(left.y, 200);
});

test('a fast fling wins over the current half of the screen', () => {
  const flungRight = snapContributionFabToEdge(20, 180, portrait, 900);
  const flungLeft = snapContributionFabToEdge(300, 180, portrait, -900);
  assert.equal(flungRight.x, portrait.maxX);
  assert.equal(flungLeft.x, portrait.minX);
});

test('restore keeps the docked side and y ratio after rotation', () => {
  const stored = { x: portrait.minX, y: 400, width: 390, height: 844 };
  const landscape = getContributionFabBounds({
    width: 844,
    height: 390,
    topInset: 0,
    leftInset: 47,
    rightInset: 47,
    tabBarHeight: 60,
  });
  const restored = restoreContributionFabPosition(stored, landscape);
  assert.equal(restored.x, landscape.minX);
  assert.ok(restored.y >= landscape.minY);
  assert.ok(restored.y <= landscape.maxY);
});

test('stored FAB JSON that is incomplete is ignored', () => {
  assert.equal(parseContributionFabStoredPosition(null), null);
  assert.equal(parseContributionFabStoredPosition('{'), null);
  assert.equal(parseContributionFabStoredPosition('{"x":1}'), null);
});

test('stored FAB JSON keeps the peeked flag', () => {
  const parsed = parseContributionFabStoredPosition(
    JSON.stringify({ x: -36, y: 400, width: 390, height: 844, peeked: true }),
  );
  assert.equal(parsed?.peeked, true);
  const docked = parseContributionFabStoredPosition(
    JSON.stringify({ x: 318, y: 400, width: 390, height: 844 }),
  );
  assert.equal(docked?.peeked, false);
});

test('pushing past the docked edge hides the FAB into a peek strip', () => {
  const peekedLeft = resolveContributionFabRelease(portrait.minX - 12, 200, portrait);
  const peekedRight = resolveContributionFabRelease(portrait.maxX + 12, 200, portrait);
  assert.equal(peekedLeft.peeked, true);
  assert.equal(peekedLeft.x, portrait.peekMinX);
  assert.equal(peekedRight.peeked, true);
  assert.equal(peekedRight.x, portrait.peekMaxX);
  assert.ok(peekedLeft.x + CONTRIBUTION_FAB_SIZE > 0);
  assert.ok(peekedRight.x < 390);
});

test('a normal snap to the edge stays fully visible', () => {
  const docked = resolveContributionFabRelease(300, 200, portrait);
  assert.equal(docked.peeked, false);
  assert.equal(docked.x, portrait.maxX);
});

test('a shove while already on the edge also peeks', () => {
  const shoved = resolveContributionFabRelease(portrait.maxX, 180, portrait, 900);
  assert.equal(shoved.peeked, true);
  assert.equal(shoved.x, portrait.peekMaxX);
});

test('pulling a peeked FAB out keeps it on the same edge even with a fast fling', () => {
  const fromLeft = resolveContributionFabRelease(portrait.minX, 200, portrait, 900, 'left');
  assert.equal(fromLeft.peeked, false);
  assert.equal(fromLeft.x, portrait.minX);

  const fromRight = resolveContributionFabRelease(portrait.maxX, 200, portrait, -900, 'right');
  assert.equal(fromRight.peeked, false);
  assert.equal(fromRight.x, portrait.maxX);
});

test('a short pull on a peeked FAB leaves it peeked on the same side', () => {
  const left = resolveContributionFabRelease(portrait.peekMinX + 4, 200, portrait, 400, 'left');
  assert.equal(left.peeked, true);
  assert.equal(left.x, portrait.peekMinX);

  const right = resolveContributionFabRelease(portrait.peekMaxX - 4, 200, portrait, -400, 'right');
  assert.equal(right.peeked, true);
  assert.equal(right.x, portrait.peekMaxX);
});

test('peeked drag cannot cross to the other edge', () => {
  const left = clampContributionFabDragPosition(300, 200, portrait, 'left');
  assert.equal(left.x, portrait.minX);
  const right = clampContributionFabDragPosition(0, 200, portrait, 'right');
  assert.equal(right.x, portrait.maxX);
});

test('restore keeps a peeked FAB peeked after rotation', () => {
  const stored = { x: portrait.peekMinX, y: 400, width: 390, height: 844, peeked: true };
  const landscape = getContributionFabBounds({
    width: 844,
    height: 390,
    topInset: 0,
    leftInset: 47,
    rightInset: 47,
    tabBarHeight: 60,
  });
  const restored = restoreContributionFabPosition(stored, landscape);
  assert.equal(restored.peeked, true);
  assert.equal(restored.x, landscape.peekMinX);
});


