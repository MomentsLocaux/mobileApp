import { create } from 'zustand';
import type { LumiaTourTargetId, LumiaTourTargetRect } from '@/constants/lumiaTour';

type LumiaTourStore = {
  replayRequested: boolean;
  requestReplay: () => void;
  consumeReplay: () => void;
  /** Android-only: icon highlighted in place. iOS keeps the spotlight hole. */
  activeTargetId: LumiaTourTargetId | null;
  setActiveTargetId: (id: LumiaTourTargetId | null) => void;
  /** Laid-out home header height, used so the Android scrim clears that band. */
  headerBandHeight: number;
  setHeaderBandHeight: (height: number) => void;
  targets: Partial<Record<LumiaTourTargetId, LumiaTourTargetRect>>;
  setTarget: (id: LumiaTourTargetId, rect: LumiaTourTargetRect | null) => void;
  measureVersion: number;
  bumpMeasure: () => void;
};

export const useLumiaTourStore = create<LumiaTourStore>((set) => ({
  replayRequested: false,
  requestReplay: () => set({ replayRequested: true }),
  consumeReplay: () => set({ replayRequested: false }),
  activeTargetId: null,
  setActiveTargetId: (id) =>
    set((state) => (state.activeTargetId === id ? state : { activeTargetId: id })),
  headerBandHeight: 0,
  setHeaderBandHeight: (height) =>
    set((state) => (state.headerBandHeight === height ? state : { headerBandHeight: height })),
  targets: {},
  measureVersion: 0,
  bumpMeasure: () => set((state) => ({ measureVersion: state.measureVersion + 1 })),
  setTarget: (id, rect) =>
    set((state) => {
      if (!rect) {
        if (!state.targets[id]) return state;
        const next = { ...state.targets };
        delete next[id];
        return { targets: next };
      }
      const cur = state.targets[id];
      if (
        cur &&
        cur.x === rect.x &&
        cur.y === rect.y &&
        cur.width === rect.width &&
        cur.height === rect.height &&
        cur.radius === rect.radius
      ) {
        return state;
      }
      return { targets: { ...state.targets, [id]: rect } };
    }),
}));
