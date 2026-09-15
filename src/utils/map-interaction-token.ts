export const consumeBooleanFlag = (flag: { current: boolean }): boolean => {
  if (!flag.current) return false;
  flag.current = false;
  return true;
};
