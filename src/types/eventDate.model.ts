export type DateRangeMode = 'single' | 'range';

export type DateRangeValue = {
  startDate: string | null;
  endDate: string | null;
};

export type DateRangeContext = 'search' | 'creation';

export type DateFilter =
  | { type: 'none' }
  | { type: 'single'; date: string }
  | { type: 'range'; start: string; end: string };

export type EventDateConfig = {
  startDate: string;
  endDate: string;
  defaultHours: {
    start: string;
    end: string;
  };
  dailyOverrides?: {
    [date: string]: {
      start: string;
      end: string;
    };
  };
};

export type EventScheduleDay = {
  date: string; // YYYY-MM-DD
  label: string;
  start: string;
  end: string;
  isCustom: boolean;
};
