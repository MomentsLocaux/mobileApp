/**
 * Push policy chosen in onboarding.
 *
 * Answers are stored on user_preferences.push_personalization and copied onto
 * the notify_* columns the dispatcher already reads. Discovery is not part of
 * this policy.
 */

export const PUSH_PERSONALIZATION_VERSION = 1 as const;

export type PushPolicy = 'essentiel' | 'local';

export type PushPersonalizationAnswers = {
  version: typeof PUSH_PERSONALIZATION_VERSION;
  policy: PushPolicy;
  answered_at: string;
};

export type PushPersonalizationPreferencePatch = {
  push_personalization: PushPersonalizationAnswers;
  notify_event_nearby: boolean;
  notify_event_reminders: true;
  notify_proximity_live?: false;
};

const POLICIES: PushPolicy[] = ['essentiel', 'local'];

export const PUSH_POLICY_OPTIONS: {
  id: PushPolicy;
  title: string;
  detail: string;
}[] = [
  {
    id: 'essentiel',
    title: 'L’essentiel',
    detail:
      'Rappels des moments que tu gardes, et les messages de compte. Pas de nouveau moment dans le rayon.',
  },
  {
    id: 'local',
    title: 'Autour de toi',
    detail: 'Les nouveaux moments dans le rayon choisi à l’étape précédente.',
  },
];

export function buildPushPersonalizationAnswers(input: {
  policy: PushPolicy | null;
  answeredAt: string;
}): PushPersonalizationAnswers | null {
  if (!input.policy || !POLICIES.includes(input.policy)) return null;
  return {
    version: PUSH_PERSONALIZATION_VERSION,
    policy: input.policy,
    answered_at: input.answeredAt,
  };
}

export function preferencePatchFromPushPolicy(
  answers: PushPersonalizationAnswers,
): PushPersonalizationPreferencePatch {
  const patch: PushPersonalizationPreferencePatch = {
    push_personalization: answers,
    notify_event_nearby: answers.policy !== 'essentiel',
    notify_event_reminders: true,
  };
  if (answers.policy === 'essentiel') {
    patch.notify_proximity_live = false;
  }
  return patch;
}

export function parsePushPersonalization(value: unknown): PushPersonalizationAnswers | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const policy = row.policy;
  if (row.version !== PUSH_PERSONALIZATION_VERSION) return null;
  if (policy !== 'essentiel' && policy !== 'local') return null;
  return buildPushPersonalizationAnswers({
    policy,
    answeredAt: typeof row.answered_at === 'string' ? row.answered_at : '',
  });
}

export function describePushPersonalization(answers: PushPersonalizationAnswers): {
  title: string;
  lines: string[];
} {
  const option = PUSH_POLICY_OPTIONS.find((item) => item.id === answers.policy);
  if (answers.policy === 'essentiel') {
    return {
      title: option?.title ?? 'L’essentiel',
      lines: ['Rappels des moments gardés', 'Pas de nouveau moment dans le rayon'],
    };
  }
  return {
    title: option?.title ?? 'Autour de toi',
    lines: ['Nouveaux moments dans ton rayon'],
  };
}
