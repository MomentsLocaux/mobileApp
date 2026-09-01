import { useEffect, useMemo, useRef, useState } from 'react';
import type { DateRangeMode, DateRangeValue } from '@/types/eventDate.model';
import { nextDateRangeOnDayPress, toDateOnlyString } from '@/utils/date-range-selection';

const emptyRange = (): DateRangeValue => ({ startDate: null, endDate: null });

const fromValue = (value?: DateRangeValue): DateRangeValue => ({
  startDate: value?.startDate ? toDateOnlyString(value.startDate) : null,
  endDate: value?.endDate ? toDateOnlyString(value.endDate) : null,
});

export const useDateRangeSelection = (
  mode: DateRangeMode,
  initial?: DateRangeValue,
  open = true
) => {
  const [range, setRange] = useState<DateRangeValue>(() => fromValue(initial));
  const valueRef = useRef(initial);
  valueRef.current = initial;

  useEffect(() => {
    if (!open) return;
    setRange(fromValue(valueRef.current));
  }, [open]);

  const onDayPress = (dateString: string) => {
    setRange((current) => nextDateRangeOnDayPress(mode, current, dateString));
  };

  const reset = () => setRange(emptyRange());

  const markedDates = useMemo(() => {
    const marks: Record<
      string,
      { startingDay?: boolean; endingDay?: boolean; color: string; textColor: string }
    > = {};
    if (!range.startDate) return marks;
    const start = range.startDate;
    const end = range.endDate || range.startDate;
    const startTime = new Date(`${start}T00:00:00.000Z`).getTime();
    const endTime = new Date(`${end}T00:00:00.000Z`).getTime();
    for (let ts = startTime; ts <= endTime; ts += 24 * 60 * 60 * 1000) {
      const current = toDateOnlyString(new Date(ts).toISOString());
      marks[current] = {
        startingDay: current === start,
        endingDay: current === end,
        color: '#FF5A5F',
        textColor: '#fff',
      };
    }
    return marks;
  }, [range]);

  return {
    range,
    setRange,
    onDayPress,
    reset,
    markedDates,
  };
};
