import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { EventWithCreator } from '@/types/database';
import {
  createProposalSession,
  getProposalSessionEvents,
  keepRecentProposalSessions,
  recordProposalDecision,
  reviseProposalDecision,
} from '@/screens/proposals/proposal-session-history';
import type {
  ProposalAnchor,
  ProposalDateWindow,
  ProposalDecision,
  ProposalPhase,
  ProposalPreferences,
  ProposalRadiusKm,
  ProposalSession,
} from '@/screens/proposals/proposal.types';
import { persistStorage } from './persistStorage';

const defaultPreferences: ProposalPreferences = {
  categoryIds: [],
  radiusKm: 25,
  anchor: null,
  dateWindow: '7_days',
  customStartDate: null,
  customEndDate: null,
};

interface ProposalsState {
  hasHydrated: boolean;
  /** Owner of persisted sessions — prevents cross-account leakage on shared devices. */
  ownerUserId: string | null;
  phase: ProposalPhase;
  wizardStep: 0 | 1 | 2;
  preferences: ProposalPreferences;
  pool: EventWithCreator[];
  currentIndex: number;
  likedEvents: EventWithCreator[];
  passedIds: string[];
  seenIds: string[];
  sessions: ProposalSession[];
  activeSessionId: string | null;
  selectedSessionId: string | null;
  finishHydration: () => void;
  /** Bind store to the signed-in user; clears history when the account changes or signs out. */
  bindToUser: (userId: string | null) => void;
  setWizardStep: (step: 0 | 1 | 2) => void;
  toggleCategory: (categoryId: string) => void;
  setCategories: (categoryIds: string[]) => void;
  setRadius: (radiusKm: ProposalRadiusKm) => void;
  setAnchor: (anchor: ProposalAnchor) => void;
  setDateWindow: (dateWindow: ProposalDateWindow) => void;
  setCustomDateRange: (range: { startDate: string | null; endDate: string | null }) => void;
  beginLoading: (options?: { resetSession?: boolean }) => void;
  setPool: (pool: EventWithCreator[]) => void;
  applyDecision: (
    event: EventWithCreator,
    decision: ProposalDecision,
    options?: { heartCreatedBySession?: boolean },
  ) => void;
  reviseDecision: (
    sessionId: string,
    eventId: string,
    decision: ProposalDecision,
    options?: { heartCreatedBySession?: boolean },
  ) => void;
  deleteSessions: (sessionIds: string[]) => void;
  pauseSession: () => void;
  resumeSession: (sessionId?: string) => void;
  startNewSession: () => void;
  showEntry: () => void;
  showHistory: (sessionId?: string | null) => void;
  selectHistorySession: (sessionId: string | null) => void;
  editPreferences: () => void;
  showSummary: () => void;
  reset: () => void;
}

const unique = (values: string[]) => Array.from(new Set(values));

const emptySessionState = {
  pool: [] as EventWithCreator[],
  currentIndex: 0,
  likedEvents: [] as EventWithCreator[],
  passedIds: [] as string[],
  seenIds: [] as string[],
};

const emptyOwnedState = {
  phase: 'wizard' as ProposalPhase,
  wizardStep: 0 as 0 | 1 | 2,
  preferences: defaultPreferences,
  ...emptySessionState,
  sessions: [] as ProposalSession[],
  activeSessionId: null as string | null,
  selectedSessionId: null as string | null,
};

export const useProposalsStore = create<ProposalsState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      ownerUserId: null,
      ...emptyOwnedState,
      finishHydration: () => {
        const state = get();
        const active = state.activeSessionId
          ? state.sessions.find((session) => session.id === state.activeSessionId)
          : null;
        set({
          hasHydrated: true,
          phase: active || state.sessions.length > 0 ? 'entry' : 'wizard',
        });
      },
      bindToUser: (userId) => {
        const state = get();
        if (!userId) {
          if (
            state.ownerUserId === null &&
            state.sessions.length === 0 &&
            state.pool.length === 0
          ) {
            return;
          }
          set({ hasHydrated: true, ownerUserId: null, ...emptyOwnedState });
          return;
        }
        if (state.ownerUserId === userId) return;
        // Account switch, or unscoped legacy persist (v≤3): never keep another user's history.
        set({ hasHydrated: true, ownerUserId: userId, ...emptyOwnedState });
      },
      setWizardStep: (wizardStep) => set({ wizardStep }),
      toggleCategory: (categoryId) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            categoryIds: state.preferences.categoryIds.includes(categoryId)
              ? state.preferences.categoryIds.filter((id) => id !== categoryId)
              : [...state.preferences.categoryIds, categoryId],
          },
        })),
      setCategories: (categoryIds) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            categoryIds: unique(categoryIds),
          },
        })),
      setRadius: (radiusKm) =>
        set((state) => ({ preferences: { ...state.preferences, radiusKm } })),
      setAnchor: (anchor) =>
        set((state) => ({ preferences: { ...state.preferences, anchor } })),
      setDateWindow: (dateWindow) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            dateWindow,
            ...(dateWindow === 'custom'
              ? {}
              : { customStartDate: null, customEndDate: null }),
          },
        })),
      setCustomDateRange: (range) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            dateWindow: range.startDate ? 'custom' : state.preferences.dateWindow,
            customStartDate: range.startDate,
            customEndDate: range.endDate,
          },
        })),
      beginLoading: () => set({ phase: 'loading', ...emptySessionState, activeSessionId: null }),
      setPool: (pool) => {
        if (pool.length === 0) {
          set({ ...emptySessionState, phase: 'empty', activeSessionId: null });
          return;
        }
        const session = createProposalSession(pool, get().preferences);
        set((state) => ({
          pool,
          currentIndex: 0,
          likedEvents: [],
          passedIds: [],
          seenIds: [],
          phase: 'deck',
          sessions: keepRecentProposalSessions([session, ...state.sessions]),
          activeSessionId: session.id,
          selectedSessionId: null,
        }));
      },
      applyDecision: (event, decision, options) =>
        set((state) => {
          const activeSession = state.activeSessionId
            ? state.sessions.find((session) => session.id === state.activeSessionId)
            : null;
          if (!activeSession) return state;

          const updatedSession = recordProposalDecision(activeSession, event, decision, options);
          const derived = getProposalSessionEvents(updatedSession);
          return {
            sessions: keepRecentProposalSessions(
              state.sessions.map((session) =>
                session.id === updatedSession.id ? updatedSession : session,
              ),
            ),
            currentIndex: updatedSession.currentIndex,
            phase: updatedSession.status === 'completed' ? 'summary' : 'deck',
            activeSessionId: updatedSession.status === 'completed' ? null : updatedSession.id,
            ...derived,
          };
        }),
      reviseDecision: (sessionId, eventId, decision, options) =>
        set((state) => {
          const target = state.sessions.find((session) => session.id === sessionId);
          if (!target) return state;
          const updated = reviseProposalDecision(target, eventId, decision, options);
          const sessions = keepRecentProposalSessions(
            state.sessions.map((session) => session.id === sessionId ? updated : session),
          );
          const shouldSyncCurrent = state.activeSessionId === sessionId;
          return shouldSyncCurrent
            ? { sessions, ...getProposalSessionEvents(updated) }
            : { sessions };
        }),
      deleteSessions: (sessionIds) =>
        set((state) => {
          const deletedIds = new Set(sessionIds);
          const sessions = state.sessions.filter((session) => !deletedIds.has(session.id));
          if (sessions.length === state.sessions.length) return state;

          const activeSessionDeleted = state.activeSessionId
            ? deletedIds.has(state.activeSessionId)
            : false;
          const selectedSessionDeleted = state.selectedSessionId
            ? deletedIds.has(state.selectedSessionId)
            : false;

          if (sessions.length === 0) {
            return {
              sessions,
              phase: 'wizard',
              wizardStep: 0,
              ...emptySessionState,
              activeSessionId: null,
              selectedSessionId: null,
            };
          }

          return {
            sessions,
            ...(activeSessionDeleted ? emptySessionState : {}),
            activeSessionId: activeSessionDeleted ? null : state.activeSessionId,
            selectedSessionId: selectedSessionDeleted ? null : state.selectedSessionId,
            phase: activeSessionDeleted && state.phase !== 'history' ? 'entry' : state.phase,
          };
        }),
      pauseSession: () => set({ phase: 'entry', selectedSessionId: null }),
      resumeSession: (sessionId) => {
        const state = get();
        const targetId = sessionId ?? state.activeSessionId;
        const session = targetId
          ? state.sessions.find((item) => item.id === targetId)
          : state.sessions.find((item) => item.status === 'in_progress');
        if (!session) return;
        set({
          preferences: session.preferences,
          pool: session.pool,
          currentIndex: session.currentIndex,
          ...getProposalSessionEvents(session),
          activeSessionId: session.status === 'in_progress' ? session.id : null,
          selectedSessionId: null,
          phase: session.status === 'completed' ? 'summary' : 'deck',
        });
      },
      startNewSession: () => set({
        phase: 'wizard',
        wizardStep: 0,
        preferences: defaultPreferences,
        ...emptySessionState,
        activeSessionId: null,
        selectedSessionId: null,
      }),
      showEntry: () => set({ phase: 'entry', selectedSessionId: null }),
      showHistory: (sessionId = null) => set({ phase: 'history', selectedSessionId: sessionId }),
      selectHistorySession: (selectedSessionId) => set({ selectedSessionId }),
      editPreferences: () => set({
        phase: 'wizard',
        wizardStep: 0,
        ...emptySessionState,
        activeSessionId: null,
        selectedSessionId: null,
      }),
      showSummary: () => set({ phase: 'summary' }),
      reset: () => set({
        hasHydrated: true,
        ownerUserId: null,
        ...emptyOwnedState,
      }),
    }),
    {
      name: 'proposals-preferences-store',
      version: 5,
      storage: createJSONStorage(() => persistStorage),
      partialize: (state) => ({
        ownerUserId: state.ownerUserId,
        preferences: state.preferences,
        pool: state.pool,
        currentIndex: state.currentIndex,
        likedEvents: state.likedEvents,
        passedIds: state.passedIds,
        seenIds: state.seenIds,
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        selectedSessionId: state.selectedSessionId,
      }),
      migrate: (persistedState) => {
        const state = persistedState as Partial<ProposalsState>;
        const preferences = state.preferences
          ? {
              ...defaultPreferences,
              ...state.preferences,
              customStartDate: state.preferences.customStartDate ?? null,
              customEndDate: state.preferences.customEndDate ?? null,
              dateWindow:
                state.preferences.dateWindow === 'custom' && !state.preferences.customStartDate
                  ? '7_days'
                  : (state.preferences.dateWindow ?? '7_days'),
            }
          : defaultPreferences;
        return {
          ...state,
          ownerUserId: state.ownerUserId ?? null,
          preferences,
          sessions: state.sessions ?? [],
          activeSessionId: state.activeSessionId ?? null,
          selectedSessionId: null,
        };
      },
      onRehydrateStorage: () => (state) => state?.finishHydration(),
    },
  ),
);
