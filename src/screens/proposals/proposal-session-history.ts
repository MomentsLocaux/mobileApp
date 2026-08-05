import type { EventWithCreator } from '@/types/database';
import type {
  ProposalDecision,
  ProposalPreferences,
  ProposalSession,
} from './proposal.types';

export const PROPOSAL_HISTORY_LIMIT = 10;

export function createProposalSession(
  pool: EventWithCreator[],
  preferences: ProposalPreferences,
  options?: { id?: string; now?: string },
): ProposalSession {
  const now = options?.now ?? new Date().toISOString();
  return {
    id: options?.id ?? `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'in_progress',
    preferences: {
      ...preferences,
      categoryIds: [...preferences.categoryIds],
      anchor: preferences.anchor ? { ...preferences.anchor } : null,
    },
    pool,
    currentIndex: 0,
    decisions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function recordProposalDecision(
  session: ProposalSession,
  event: EventWithCreator,
  decision: ProposalDecision,
  options?: { now?: string; heartCreatedBySession?: boolean },
): ProposalSession {
  const now = options?.now ?? new Date().toISOString();
  const existingIndex = session.decisions.findIndex((item) => item.event.id === event.id);
  const nextDecision = {
    event,
    decision,
    decidedAt: now,
    heartCreatedBySession: decision === 'like' && options?.heartCreatedBySession === true,
  };
  const decisions = [...session.decisions];
  if (existingIndex >= 0) decisions[existingIndex] = nextDecision;
  else decisions.push(nextDecision);

  const eventIndex = session.pool.findIndex((item) => item.id === event.id);
  const currentIndex = Math.max(
    session.currentIndex,
    eventIndex >= 0 ? eventIndex + 1 : session.currentIndex + 1,
  );
  const completed = currentIndex >= session.pool.length;

  return {
    ...session,
    currentIndex,
    decisions,
    status: completed ? 'completed' : 'in_progress',
    updatedAt: now,
    completedAt: completed ? now : undefined,
  };
}

export function reviseProposalDecision(
  session: ProposalSession,
  eventId: string,
  decision: ProposalDecision,
  options?: { now?: string; heartCreatedBySession?: boolean },
): ProposalSession {
  const now = options?.now ?? new Date().toISOString();
  const existingIndex = session.decisions.findIndex((item) => item.event.id === eventId);
  if (existingIndex < 0) return session;

  const decisions = [...session.decisions];
  decisions[existingIndex] = {
    ...decisions[existingIndex],
    decision,
    decidedAt: now,
    heartCreatedBySession: decision === 'like' && options?.heartCreatedBySession === true,
  };
  return { ...session, decisions, updatedAt: now };
}

export function getProposalSessionEvents(session: ProposalSession) {
  return {
    likedEvents: session.decisions
      .filter((item) => item.decision === 'like')
      .map((item) => item.event),
    passedIds: session.decisions
      .filter((item) => item.decision === 'pass')
      .map((item) => item.event.id),
    seenIds: session.decisions.map((item) => item.event.id),
  };
}

export function keepRecentProposalSessions(sessions: ProposalSession[]): ProposalSession[] {
  return [...sessions]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, PROPOSAL_HISTORY_LIMIT);
}

export function getSessionCreatedHeartEvents(
  sessions: ProposalSession[],
): EventWithCreator[] {
  const eventsById = new Map<string, EventWithCreator>();
  sessions.forEach((session) => {
    session.decisions.forEach((item) => {
      if (item.decision === 'like' && item.heartCreatedBySession === true) {
        eventsById.set(item.event.id, item.event);
      }
    });
  });
  return Array.from(eventsById.values());
}
