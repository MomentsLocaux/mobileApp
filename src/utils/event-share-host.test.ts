import test from 'node:test';
import assert from 'node:assert/strict';
import { openInAppEventShare, registerEventShareOpener } from './event-share-host';

test('the focused screen handles share, then the previous opener returns', () => {
  const seen: string[] = [];
  const unregisterRoot = registerEventShareOpener((event) => {
    seen.push(`root:${event.id}`);
  });
  const unregisterDetail = registerEventShareOpener((event) => {
    seen.push(`detail:${event.id}`);
  });

  assert.equal(openInAppEventShare({ id: '1', title: 'Sur la fiche' }), true);
  unregisterDetail();
  assert.equal(openInAppEventShare({ id: '2', title: 'Sur la carte' }), true);
  unregisterRoot();
  assert.equal(openInAppEventShare({ id: '3', title: 'Sans hôte' }), false);
  assert.deepEqual(seen, ['detail:1', 'root:2']);
});
