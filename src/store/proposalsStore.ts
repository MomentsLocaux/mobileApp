import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { EventWithCreator } from '@/types/database';
import { persistStorage } from './persistStorage';
import type {
  ProposalAnchor,
  ProposalDateWindow,
  ProposalDecision,
  ProposalPhase,
  ProposalPreferences,
  ProposalRadiusKm,
} from '@/screens/proposals/proposal.types';

const defaultPreferences: ProposalPreferences = {
  categoryIds: [],
  radiusKm: 25,
  anchor: null,
  dateWindow: '7_days',
};

interface ProposalsState {
  phase: ProposalPhase;
  wizardStep: 0 | 1 | 2;
  preferences: ProposalPreferences;
  pool: EventWithCreator[];
  currentIndex: number;
  likedEvents: EventWithCreator[];
  passedIds: string[];
  seenIds: string[];
  setWizardStep: (step: 0 | 1 | 2) => void;
  toggleCategory: (categoryId: string) => void;
  setCategories: (categoryIds: string[]) => void;
  setRadius: (radiusKm: ProposalRadiusKm) => void;
  setAnchor: (anchor: ProposalAnchor) => void;
  setDateWindow: (dateWindow: ProposalDateWindow) => void;
  beginLoading: (options?: { resetSession?: boolean }) => void;
  setPool: (pool: EventWithCreator[]) => void;
  applyDecision: (event: EventWithCreator, decision: ProposalDecision) => void;
  editPreferences: () => void;
  showSummary: () => void;
  reset: () => void;
}

const unique = (values: string[]) => Array.from(new Set(values));

export const useProposalsStore = create<ProposalsState>()(
  persist(
    (set) => ({
      phase: 'wizard',
      wizardStep: 0,
      preferences: defaultPreferences,
      pool: [],
      currentIndex: 0,
      likedEvents: [],
      passedIds: [],
      seenIds: [],
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
      beginLoading: (options) =>
        set((state) => ({
          phase: 'loading',
          pool: [],
          currentIndex: 0,
          ...(options?.resetSession
            ? { likedEvents: [], passedIds: [], seenIds: [] }
            : { likedEvents: state.likedEvents }),
        })),
      setPool: (pool) =>
        set({
          pool,
          currentIndex: 0,
          phase: pool.length > 0 ? 'deck' : 'empty',
        }),
      applyDecision: (event, decision) =>
        set((state) => {
          const nextIndex = state.currentIndex + 1;
          const isFinished = nextIndex >= state.pool.length;
          return {
            currentIndex: nextIndex,
            phase: isFinished ? 'summary' : 'deck',
            seenIds: unique([...state.seenIds, event.id]),
            passedIds:
              decision === 'pass' ? unique([...state.passedIds, event.id]) : state.passedIds,
            likedEvents:
              decision === 'like' && !state.likedEvents.some((item) => item.id === event.id)
                ? [...state.likedEvents, event]
                : state.likedEvents,
          };
        }),
      editPreferences: () => set({ phase: 'wizard', wizardStep: 0, pool: [], currentIndex: 0 }),
      showSummary: () => set({ phase: 'summary' }),
      reset: () =>
        set({
          phase: 'wizard',
          wizardStep: 0,
          preferences: defaultPreferences,
          pool: [],
          currentIndex: 0,
          likedEvents: [],
          passedIds: [],
          seenIds: [],
        }),
    }),
    {
      name: 'proposals-preferences-store',
      storage: createJSONStorage(() => persistStorage),
      partialize: (state) => ({ preferences: state.preferences }),
    },
  ),
);
