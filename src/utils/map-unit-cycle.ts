export const UNIT_CARD_CYCLE_SHEET_END = 0.55;
export const UNIT_CARD_CYCLE_CARD_START = 0.35;

export const unitCycleSheetReveal = (progress: number): number => {
  'worklet';
  if (progress <= 0) return 1;
  if (progress >= UNIT_CARD_CYCLE_SHEET_END) return 0;
  return 1 - progress / UNIT_CARD_CYCLE_SHEET_END;
};

export const unitCycleCardReveal = (progress: number): number => {
  'worklet';
  if (progress <= UNIT_CARD_CYCLE_CARD_START) return 0;
  if (progress >= 1) return 1;
  return (progress - UNIT_CARD_CYCLE_CARD_START) / (1 - UNIT_CARD_CYCLE_CARD_START);
};
