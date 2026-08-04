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
};

interface ProposalsState {
  hasHydrated: boolean;
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
  setWizardStep: (step: 0 | 1 | 2) => void;
  toggleCategory: (categoryId: string) => void;
  setCategories: (categoryIds: string[]) => void;
  setRadius: (radiusKm: ProposalRadiusKm) => void;
  setAnchor: (anchor: ProposalAnchor) => void;
  setDateWindow: (dateWindow: ProposalDateWindow) => void;
  beginLoading: (options?: { resetSession?: boolean }) => void;
  setPool: (pool: EventWithCreator[]) => void;
  applyDecision: (event: EventWithCreator, decision: ProposalDecision) => void;
  reviseDecision: (sessionId: string, eventId: string, decision: ProposalDecision) => void;
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

export const useProposalsStore = create<ProposalsState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      phase: 'wizard',
      wizardStep: 0,
      preferences: defaultPreferences,
      ...emptySessionState,
      sessions: [],
      activeSessionId: null,
      selectedSessionId: null,
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
        set((state) => ({ preferences: { ...state.preferences, dateWindow } })),
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
      applyDecision: (event, decision) =>
        set((state) => {
          const activeSession = state.activeSessionId
            ? state.sessions.find((session) => session.id === state.activeSessionId)
            : null;
          if (!activeSession) return state;

          const updatedSession = recordProposalDecision(activeSession, event, decision);
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
      reviseDecision: (sessionId, eventId, decision) =>
        set((state) => {
          const target = state.sessions.find((session) => session.id === sessionId);
          if (!target) return state;
          const updated = reviseProposalDecision(target, eventId, decision);
          const sessions = keepRecentProposalSessions(
            state.sessions.map((session) => session.id === sessionId ? updated : session),
          );
          const shouldSyncCurrent = state.activeSessionId === sessionId;
          return shouldSyncCurrent
            ? { sessions, ...getProposalSessionEvents(updated) }
            : { sessions };
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
        phase: 'wizard',
        wizardStep: 0,
        preferences: defaultPreferences,
        ...emptySessionState,
        sessions: [],
        activeSessionId: null,
        selectedSessionId: null,
      }),
    }),
    {
      name: 'proposals-preferences-store',
      version: 2,
      storage: createJSONStorage(() => persistStorage),
      partialize: (state) => ({
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
        return {
          ...state,
          sessions: state.sessions ?? [],
          activeSessionId: state.activeSessionId ?? null,
          selectedSessionId: null,
        };
      },
      onRehydrateStorage: () => (state) => state?.finishHydration(),
    },
  ),
);
