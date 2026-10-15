import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPushPersonalizationAnswers,
  parsePushPersonalization,
  preferencePatchFromPushPolicy,
} from './push-personalization';

const answeredAt = '2026-10-09T09:00:00.000Z';

describe('push personalization policy', () => {
  it('requires a policy', () => {
    assert.equal(buildPushPersonalizationAnswers({ policy: null, answeredAt }), null);
  });

  it('maps essentiel to reminders only', () => {
    const answers = buildPushPersonalizationAnswers({ policy: 'essentiel', answeredAt });
    assert.ok(answers);
    const patch = preferencePatchFromPushPolicy(answers);
    assert.equal(patch.notify_event_nearby, false);
    assert.equal(patch.notify_proximity_live, false);
    assert.equal(patch.notify_event_reminders, true);
    assert.equal('discovery_push_enabled' in patch, false);
  });

  it('keeps nearby alerts for a local policy', () => {
    const answers = buildPushPersonalizationAnswers({ policy: 'local', answeredAt });
    assert.ok(answers);
    const patch = preferencePatchFromPushPolicy(answers);
    assert.equal(patch.notify_event_nearby, true);
    assert.equal(patch.notify_proximity_live, undefined);
    assert.equal(patch.notify_event_reminders, true);
  });

  it('ignores a discovery-era snapshot', () => {
    assert.equal(
      parsePushPersonalization({
        version: 1,
        policy: 'personnalise',
        suggestions: ['right_now'],
        answered_at: answeredAt,
      }),
      null,
    );
    const local = buildPushPersonalizationAnswers({ policy: 'local', answeredAt });
    assert.deepEqual(parsePushPersonalization(local), local);
  });
});
