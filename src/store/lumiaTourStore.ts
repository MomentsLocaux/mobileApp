import { create } from 'zustand';

type LumiaTourStore = {
  replayRequested: boolean;
  requestReplay: () => void;
  consumeReplay: () => void;
};

export const useLumiaTourStore = create<LumiaTourStore>((set) => ({
  replayRequested: false,
  requestReplay: () => set({ replayRequested: true }),
  consumeReplay: () => set({ replayRequested: false }),
}));
