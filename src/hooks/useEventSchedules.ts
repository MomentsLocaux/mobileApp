import { useEffect, useMemo, useState } from 'react';
import type { EventDateConfig, EventScheduleDay } from '@/types/eventDate.model';

const toDateOnly = (iso: string) => iso.split('T')[0];

const formatLabel = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(date),
  );

const enumerateDays = (start: string, end: string) => {
  const days: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current.getTime() <= endDate.getTime()) {
    days.push(toDateOnly(current.toISOString()));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
};

export const useEventSchedules = (config: EventDateConfig) => {
  const [defaultHours, setDefaultHours] = useState(config.defaultHours);
  const [overrides, setOverrides] = useState<Record<string, { start: string; end: string }>>(
    config.dailyOverrides || {},
  );

  useEffect(() => {
    setDefaultHours(config.defaultHours);
  }, [config.defaultHours.start, config.defaultHours.end]);

  // Remove overrides that no longer fit in range
  useEffect(() => {
    const rangeDays = enumerateDays(config.startDate, config.endDate);
    setOverrides((prev) => {
      const next: Record<string, { start: string; end: string }> = {};
      rangeDays.forEach((d) => {
        if (prev[d]) next[d] = prev[d];
      });
      return next;
    });
  }, [config.startDate, config.endDate]);

  const days: EventScheduleDay[] = useMemo(() => {
    return enumerateDays(config.startDate, config.endDate).map((date) => {
      const override = overrides[date];
      return {
        date,
        label: formatLabel(date),
        start: override?.start || defaultHours.start,
        end: override?.end || defaultHours.end,
        isCustom: Boolean(override),
      };
    });
  }, [config.startDate, config.endDate, overrides, defaultHours]);

  const toggleCustom = (date: string, active: boolean) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (!active) {
        delete next[date];
      } else {
        next[date] = { start: defaultHours.start, end: defaultHours.end };
      }
      return next;
    });
  };

  const updateDay = (date: string, hours: { start?: string; end?: string }) => {
    setOverrides((prev) => ({
      ...prev,
      [date]: {
        start: hours.start ?? prev[date]?.start ?? defaultHours.start,
        end: hours.end ?? prev[date]?.end ?? defaultHours.end,
      },
    }));
  };

  return {
    days,
    defaultHours,
    setDefaultHours,
    overrides,
    toggleCustom,
    updateDay,
  };
};
