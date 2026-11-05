import {
  validateEventSchedule,
  type EventScheduleModeMobile,
  type EventTimeSlot,
  type VariableSchedules,
} from './event-schedule';

export type EventDraftContinueStep = 0 | 1 | 2 | 3;

export type EventDraftGapInput = {
  step: EventDraftContinueStep;
  title: string;
  startDate?: string;
  endDate?: string;
  hasLocation: boolean;
  hasCategory: boolean;
  hasCover: boolean;
  scheduleMode: EventScheduleModeMobile;
  scheduleOpenDays: number[];
  scheduleFixedSlots: EventTimeSlot[];
  scheduleVariableDays: VariableSchedules;
};

const basics = (input: EventDraftGapInput): string[] => {
  const gaps: string[] = [];
  if (!input.title.trim()) gaps.push('un titre');
  if (!input.startDate) gaps.push('une date de début');
  if (!input.endDate) gaps.push('une date de fin');
  if (!input.hasLocation) gaps.push('un lieu');
  if (input.startDate && input.endDate) {
    const schedule = validateEventSchedule({
      startDate: input.startDate,
      endDate: input.endDate,
      mode: input.scheduleMode,
      fixedSlots: input.scheduleFixedSlots,
      openDays: input.scheduleOpenDays,
      variableSchedules: input.scheduleVariableDays,
    });
    if (!schedule.valid && schedule.message) {
      gaps.push(schedule.message.replace(/\.$/, ''));
    }
  }
  return gaps;
};

/** Names what still blocks Continuer or the final submit on the suggest/create form. */
export function listEventDraftContinueGaps(input: EventDraftGapInput): string[] {
  if (input.step === 2) {
    return input.hasCover ? [] : ['une couverture'];
  }

  const gaps = basics(input);
  if ((input.step === 1 || input.step === 3) && !input.hasCategory) {
    gaps.push('une catégorie');
  }
  if (input.step === 3 && !input.hasCover) {
    gaps.push('une couverture');
  }
  return gaps;
}

export function formatEventDraftGaps(gaps: string[]): string {
  return gaps.map((gap) => `• ${gap}`).join('\n');
}
