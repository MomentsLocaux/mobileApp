import { useMemo, useState } from 'react';
import type { DateRangeMode, DateRangeValue } from '@/types/eventDate.model';

const normalizeDate = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
};

const isBefore = (a: string, b: string) => new Date(a).getTime() < new Date(b).getTime();
const isSameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

export const useDateRangeSelection = (mode: DateRangeMode, initial?: DateRangeValue) => {
  const [range, setRange] = useState<DateRangeValue>({
    startDate: initial?.startDate ? normalizeDate(initial.startDate) : null,
    endDate: initial?.endDate ? normalizeDate(initial.endDate) : null,
  });

  const onDayPress = (dateString: string) => {
    const date = normalizeDate(dateString);

    if (mode === 'single') {
      setRange({ startDate: date, endDate: null });
      return;
    }

    const { startDate, endDate } = range;
    if (!startDate || (startDate && endDate)) {
      setRange({ startDate: date, endDate: null });
      return;
    }

    // Only start selected
    if (isBefore(date, startDate) || isSameDay(date, startDate)) {
      setRange({ startDate: date, endDate: null });
    } else {
      setRange({ startDate, endDate: date });
    }
  };

  const reset = () => setRange({ startDate: null, endDate: null });

  const markedDates = useMemo(() => {
    const marks: Record<
      string,
      { startingDay?: boolean; endingDay?: boolean; color: string; textColor: string }
    > = {};
    if (!range.startDate) return marks;
    const start = range.startDate;
    const end = range.endDate || range.startDate;
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    for (let ts = startTime; ts <= endTime; ts += 24 * 60 * 60 * 1000) {
      const current = normalizeDate(new Date(ts));
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
