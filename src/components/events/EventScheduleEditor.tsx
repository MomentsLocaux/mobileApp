import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DateRangePicker } from '@/components/DateRangePicker';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import {
  DEFAULT_EVENT_TIME_SLOT,
  enumerateDateRange,
  isSameDayRange,
  normalizeScheduleByDateRange,
  validateEventSchedule,
  type EventScheduleDraft,
  type EventTimeSlot,
} from '@/utils/event-schedule';

type TimePickerTarget =
  | { type: 'start' }
  | { type: 'end' }
  | { type: 'fixed'; slotIndex: number; field: 'start' | 'end' }
  | { type: 'variable'; date: string; slotIndex: number; field: 'start' | 'end' };

const WEEK_DAYS = [
  { key: 1, label: 'Lun' },
  { key: 2, label: 'Mar' },
  { key: 3, label: 'Mer' },
  { key: 4, label: 'Jeu' },
  { key: 5, label: 'Ven' },
  { key: 6, label: 'Sam' },
  { key: 7, label: 'Dim' },
];

const parseTime = (value: string) => {
  const [hours, minutes] = value.split(':').map((v) => Number(v));
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
};

const toTimeString = (date: Date) =>
  `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

const withTime = (iso: string | undefined, time: string) => {
  const base = iso ? new Date(iso) : new Date();
  const [hours, minutes] = time.split(':').map((v) => Number(v));
  const next = new Date(base);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next.toISOString();
};

const mergeDateWithTime = (dateStr: string, existing?: string, defaultTime = '09:00') => {
  const base = existing ? new Date(existing) : new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = defaultTime.split(':').map(Number);
  if (!year || !month || !day) return base.toISOString();
  const merged = new Date(base);
  merged.setFullYear(year, month - 1, day);
  merged.setHours(hours || 0, minutes || 0, 0, 0);
  return merged.toISOString();
};

type Props = {
  value: EventScheduleDraft;
  onChange: (next: EventScheduleDraft) => void;
  changed?: boolean;
  hint?: string;
};

export function EventScheduleEditor({ value, onChange, changed = false, hint }: Props) {
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const [showRangePicker, setShowRangePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<TimePickerTarget | null>(null);
  const [pickerValue, setPickerValue] = useState<Date>(new Date());

  const { startDate, endDate, scheduleMode, scheduleOpenDays, scheduleFixedSlots, scheduleVariableDays } = value;
  const sameDayEvent = useMemo(() => isSameDayRange(startDate, endDate), [startDate, endDate]);

  useEffect(() => {
    const current = valueRef.current;
    if (!current.startDate || current.endDate) return;
    const autoEnd = new Date(current.startDate);
    if (Number.isNaN(autoEnd.getTime())) return;
    autoEnd.setHours(autoEnd.getHours() + 2);
    onChangeRef.current({ ...current, endDate: autoEnd.toISOString() });
  }, [startDate, endDate]);

  useEffect(() => {
    const current = valueRef.current;
    if (!current.startDate || !current.endDate) return;
    const normalized = normalizeScheduleByDateRange({
      startDate: current.startDate,
      endDate: current.endDate,
      variableSchedules: current.scheduleVariableDays,
    });
    if (JSON.stringify(normalized) !== JSON.stringify(current.scheduleVariableDays)) {
      onChangeRef.current({ ...current, scheduleVariableDays: normalized });
    }
  }, [startDate, endDate, scheduleVariableDays]);

  useEffect(() => {
    const current = valueRef.current;
    if (!current.startDate || !current.endDate) return;
    if (sameDayEvent && current.scheduleMode !== 'single_day') {
      onChangeRef.current({ ...current, scheduleMode: 'single_day' });
      return;
    }
    if (!sameDayEvent && current.scheduleMode === 'single_day') {
      onChangeRef.current({ ...current, scheduleMode: 'fixed' });
    }
  }, [sameDayEvent, scheduleMode, startDate, endDate]);

  const scheduleValidation = useMemo(
    () =>
      validateEventSchedule({
        startDate,
        endDate,
        mode: scheduleMode,
        fixedSlots: scheduleFixedSlots,
        openDays: scheduleOpenDays,
        variableSchedules: scheduleVariableDays,
      }),
    [startDate, endDate, scheduleMode, scheduleFixedSlots, scheduleOpenDays, scheduleVariableDays],
  );

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatDateRange = (start?: string, end?: string) => {
    if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
    if (start) return formatDate(start);
    if (end) return formatDate(end);
    return '';
  };

  const formatLongDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const rangeValue = useMemo(
    () => ({
      startDate: startDate ? startDate.split('T')[0] : null,
      endDate: endDate ? endDate.split('T')[0] : null,
    }),
    [startDate, endDate],
  );

  const patch = (partial: Partial<EventScheduleDraft>) => onChange({ ...value, ...partial });

  const handleRangeChange = (range: { startDate: string | null; endDate: string | null }) => {
    let nextStart = startDate;
    let nextEnd = endDate;
    if (range.startDate) {
      nextStart = mergeDateWithTime(range.startDate, startDate, '09:00');
      if (!range.endDate) {
        const autoEnd = new Date(nextStart);
        autoEnd.setHours(autoEnd.getHours() + 2);
        nextEnd = autoEnd.toISOString();
      } else if (endDate && new Date(endDate) <= new Date(nextStart)) {
        nextEnd = mergeDateWithTime(range.startDate, nextStart, '18:00');
      }
    } else {
      nextStart = undefined;
      nextEnd = undefined;
    }
    if (range.endDate) {
      nextEnd = mergeDateWithTime(range.endDate, nextEnd || nextStart, '18:00');
    }
    patch({ startDate: nextStart, endDate: nextEnd });
  };

  const getPickerValue = (target: TimePickerTarget | null) => {
    if (!target) return new Date();
    if (target.type === 'start') {
      return parseTime(startDate ? new Date(startDate).toTimeString().slice(0, 5) : '09:00');
    }
    if (target.type === 'end') {
      return parseTime(endDate ? new Date(endDate).toTimeString().slice(0, 5) : '18:00');
    }
    if (target.type === 'fixed') {
      return parseTime(scheduleFixedSlots[target.slotIndex]?.[target.field] || '09:00');
    }
    return parseTime(scheduleVariableDays[target.date]?.slots[target.slotIndex]?.[target.field] || '09:00');
  };

  const openTimePicker = (target: TimePickerTarget) => {
    setTimePickerTarget(target);
    setPickerValue(getPickerValue(target));
  };

  const handleTimePicked = (selected: Date) => {
    if (!timePickerTarget) return;
    const time = toTimeString(selected);

    if (timePickerTarget.type === 'start') {
      const nextStart = withTime(startDate, time);
      let nextEnd = endDate;
      if (endDate && new Date(endDate) <= new Date(nextStart)) {
        const fallbackEnd = withTime(endDate || nextStart, time);
        const d = new Date(fallbackEnd);
        d.setHours(d.getHours() + 1);
        nextEnd = d.toISOString();
      }
      patch({ startDate: nextStart, endDate: nextEnd });
      return;
    }

    if (timePickerTarget.type === 'end') {
      patch({ endDate: withTime(endDate || startDate, time) });
      return;
    }

    if (timePickerTarget.type === 'fixed') {
      patch({
        scheduleFixedSlots: scheduleFixedSlots.map((slot, index) =>
          index === timePickerTarget.slotIndex ? { ...slot, [timePickerTarget.field]: time } : slot,
        ),
      });
      return;
    }

    const targetDay = scheduleVariableDays[timePickerTarget.date];
    if (!targetDay) return;
    patch({
      scheduleVariableDays: {
        ...scheduleVariableDays,
        [timePickerTarget.date]: {
          ...targetDay,
          slots: targetDay.slots.map((slot, index) =>
            index === timePickerTarget.slotIndex ? { ...slot, [timePickerTarget.field]: time } : slot,
          ),
        },
      },
    });
  };

  const toggleOpenDay = (day: number) => {
    patch({
      scheduleOpenDays: scheduleOpenDays.includes(day)
        ? scheduleOpenDays.filter((d) => d !== day)
        : [...scheduleOpenDays, day].sort((a, b) => a - b),
    });
  };

  const addFixedSlot = () => patch({ scheduleFixedSlots: [...scheduleFixedSlots, { ...DEFAULT_EVENT_TIME_SLOT }] });

  const removeFixedSlot = (slotIndex: number) => {
    const next = scheduleFixedSlots.filter((_, index) => index !== slotIndex);
    if (next.length > 0) patch({ scheduleFixedSlots: next });
  };

  const datesInRange = useMemo(() => enumerateDateRange(startDate, endDate), [startDate, endDate]);

  const toggleVariableDate = (date: string) => {
    const current = scheduleVariableDays[date] || { enabled: true, slots: [{ ...DEFAULT_EVENT_TIME_SLOT }] };
    patch({
      scheduleVariableDays: {
        ...scheduleVariableDays,
        [date]: { ...current, enabled: !current.enabled },
      },
    });
  };

  const addVariableSlot = (date: string) => {
    const current = scheduleVariableDays[date] || { enabled: true, slots: [{ ...DEFAULT_EVENT_TIME_SLOT }] };
    patch({
      scheduleVariableDays: {
        ...scheduleVariableDays,
        [date]: { ...current, slots: [...current.slots, { ...DEFAULT_EVENT_TIME_SLOT }] },
      },
    });
  };

  const removeVariableSlot = (date: string, slotIndex: number) => {
    const current = scheduleVariableDays[date];
    if (!current || current.slots.length <= 1) return;
    patch({
      scheduleVariableDays: {
        ...scheduleVariableDays,
        [date]: { ...current, slots: current.slots.filter((_, index) => index !== slotIndex) },
      },
    });
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Dates</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TouchableOpacity
        style={[styles.pill, changed && styles.changedCard]}
        onPress={() => setShowRangePicker(true)}
        accessibilityRole="button"
        accessibilityLabel="Choisir des dates"
      >
        <Text style={styles.pillText}>{formatDateRange(startDate, endDate) || 'Choisir des dates'}</Text>
      </TouchableOpacity>

      {startDate && endDate ? (
        <View style={styles.section}>
          <Text style={styles.label}>Gestion des horaires</Text>
          {sameDayEvent ? (
            <View style={[styles.scheduleCard, changed && styles.changedCard]}>
              <Text style={styles.scheduleHint}>Cas simple: indiquez l&apos;heure de début et de fin.</Text>
              <View style={styles.inlineRow}>
                <TouchableOpacity style={styles.timeChip} onPress={() => openTimePicker({ type: 'start' })}>
                  <Text style={styles.timeChipLabel}>Début</Text>
                  <Text style={styles.timeChipValue}>
                    {new Date(startDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.timeChip} onPress={() => openTimePicker({ type: 'end' })}>
                  <Text style={styles.timeChipLabel}>Fin</Text>
                  <Text style={styles.timeChipValue}>
                    {new Date(endDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.scheduleCard, changed && styles.changedCard]}>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeBtn, scheduleMode === 'fixed' && styles.modeBtnActive]}
                  onPress={() => patch({ scheduleMode: 'fixed' })}
                >
                  <Text style={[styles.modeText, scheduleMode === 'fixed' && styles.modeTextActive]}>Horaires fixes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, scheduleMode === 'variable' && styles.modeBtnActive]}
                  onPress={() => patch({ scheduleMode: 'variable' })}
                >
                  <Text style={[styles.modeText, scheduleMode === 'variable' && styles.modeTextActive]}>
                    Horaires variables
                  </Text>
                </TouchableOpacity>
              </View>

              {scheduleMode === 'fixed' ? (
                <>
                  <Text style={styles.scheduleHint}>Jours d&apos;ouverture</Text>
                  <View style={styles.daysWrap}>
                    {WEEK_DAYS.map((day) => (
                      <TouchableOpacity
                        key={day.key}
                        style={[styles.dayChip, scheduleOpenDays.includes(day.key) && styles.dayChipActive]}
                        onPress={() => toggleOpenDay(day.key)}
                      >
                        <Text
                          style={[styles.dayChipText, scheduleOpenDays.includes(day.key) && styles.dayChipTextActive]}
                        >
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.scheduleHint}>Créneaux appliqués à tous les jours ouverts</Text>
                  {scheduleFixedSlots.map((slot, slotIndex) => (
                    <View key={`fixed-${slotIndex}`} style={styles.slotRow}>
                      <TouchableOpacity
                        style={styles.slotTimeChip}
                        onPress={() => openTimePicker({ type: 'fixed', slotIndex, field: 'start' })}
                      >
                        <Text style={styles.slotTimeText}>{slot.start}</Text>
                      </TouchableOpacity>
                      <Text style={styles.slotSeparator}>→</Text>
                      <TouchableOpacity
                        style={styles.slotTimeChip}
                        onPress={() => openTimePicker({ type: 'fixed', slotIndex, field: 'end' })}
                      >
                        <Text style={styles.slotTimeText}>{slot.end}</Text>
                      </TouchableOpacity>
                      {scheduleFixedSlots.length > 1 ? (
                        <TouchableOpacity onPress={() => removeFixedSlot(slotIndex)}>
                          <Text style={styles.removeText}>Suppr.</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addBtn} onPress={addFixedSlot}>
                    <Text style={styles.addBtnText}>+ Ajouter un créneau</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.scheduleHint}>Définissez les horaires pour chaque jour</Text>
                  {datesInRange.map((date) => {
                    const day =
                      scheduleVariableDays[date] ||
                      ({ enabled: true, slots: [{ ...DEFAULT_EVENT_TIME_SLOT }] } as {
                        enabled: boolean;
                        slots: EventTimeSlot[];
                      });
                    return (
                      <View key={date} style={styles.dayBlock}>
                        <View style={styles.dayBlockHeader}>
                          <Text style={styles.dayBlockTitle}>{formatLongDate(date)}</Text>
                          <TouchableOpacity
                            style={[styles.toggleBtn, day.enabled && styles.toggleBtnActive]}
                            onPress={() => toggleVariableDate(date)}
                          >
                            <Text style={[styles.toggleBtnText, day.enabled && styles.toggleBtnTextActive]}>
                              {day.enabled ? 'Ouvert' : 'Fermé'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {day.enabled ? (
                          <>
                            {day.slots.map((slot, slotIndex) => (
                              <View key={`${date}-${slotIndex}`} style={styles.slotRow}>
                                <TouchableOpacity
                                  style={styles.slotTimeChip}
                                  onPress={() => openTimePicker({ type: 'variable', date, slotIndex, field: 'start' })}
                                >
                                  <Text style={styles.slotTimeText}>{slot.start}</Text>
                                </TouchableOpacity>
                                <Text style={styles.slotSeparator}>→</Text>
                                <TouchableOpacity
                                  style={styles.slotTimeChip}
                                  onPress={() => openTimePicker({ type: 'variable', date, slotIndex, field: 'end' })}
                                >
                                  <Text style={styles.slotTimeText}>{slot.end}</Text>
                                </TouchableOpacity>
                                {day.slots.length > 1 ? (
                                  <TouchableOpacity onPress={() => removeVariableSlot(date, slotIndex)}>
                                    <Text style={styles.removeText}>Suppr.</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            ))}
                            <TouchableOpacity style={styles.addBtn} onPress={() => addVariableSlot(date)}>
                              <Text style={styles.addBtnText}>+ Ajouter un créneau</Text>
                            </TouchableOpacity>
                          </>
                        ) : null}
                      </View>
                    );
                  })}
                </>
              )}
            </View>
          )}
          {!scheduleValidation.valid ? <Text style={styles.scheduleError}>{scheduleValidation.message}</Text> : null}
        </View>
      ) : null}

      <DateRangePicker
        open={showRangePicker}
        mode="range"
        value={rangeValue}
        onChange={handleRangeChange}
        onClose={() => setShowRangePicker(false)}
        context="creation"
      />

      <Modal
        visible={!!timePickerTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerTarget(null)}
      >
        <View style={styles.pickerModalBackdrop}>
          <View style={styles.pickerModalCard}>
            <Text style={styles.pickerTitle}>Choisir une heure</Text>
            <DateTimePicker
              value={pickerValue}
              mode="time"
              display="spinner"
              is24Hour
              themeVariant="dark"
              textColor={colors.brand.text}
              onChange={(_, selected) => {
                if (selected) setPickerValue(selected);
              }}
            />
            <View style={styles.pickerActions}>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setTimePickerTarget(null)}>
                <Text style={styles.pickerBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerBtn, styles.pickerBtnPrimary]}
                onPress={() => {
                  handleTimePicked(pickerValue);
                  setTimePickerTarget(null);
                }}
              >
                <Text style={[styles.pickerBtnText, styles.pickerBtnTextPrimary]}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  label: {
    ...typography.body,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  hint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    lineHeight: 18,
  },
  pill: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
    alignItems: 'center',
    backgroundColor: colors.brand.surface,
  },
  pillText: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  changedCard: {
    borderColor: 'rgba(124, 181, 24, 0.55)',
    backgroundColor: 'rgba(124, 181, 24, 0.08)',
  },
  scheduleCard: {
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  scheduleHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  scheduleError: {
    ...typography.caption,
    color: colors.error[500],
    marginTop: 2,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  timeChip: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
    backgroundColor: colors.brand.page,
    gap: 2,
  },
  timeChipLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  timeChipValue: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: 'rgba(124, 181, 24,0.2)',
    borderColor: 'rgba(124, 181, 24,0.45)',
  },
  modeText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  modeTextActive: {
    color: colors.brand.secondary,
  },
  daysWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
  },
  dayChipActive: {
    backgroundColor: 'rgba(124, 181, 24,0.2)',
    borderColor: 'rgba(124, 181, 24,0.5)',
  },
  dayChipText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  dayChipTextActive: {
    color: colors.brand.secondary,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  slotTimeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.page,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
  },
  slotTimeText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  slotSeparator: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  removeText: {
    ...typography.caption,
    color: colors.error[500],
    fontWeight: '700',
  },
  addBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(124, 181, 24,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24,0.4)',
  },
  addBtnText: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  dayBlock: {
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.08)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  dayBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dayBlockTitle: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
    textTransform: 'capitalize',
    flex: 1,
  },
  toggleBtn: {
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.15)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderColor: 'rgba(16,185,129,0.45)',
  },
  toggleBtnText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  toggleBtnTextActive: {
    color: '#34D399',
  },
  pickerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  pickerModalCard: {
    width: '100%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.14)',
    backgroundColor: colors.brand.surface,
    overflow: 'hidden',
  },
  pickerTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '800',
    textAlign: 'center',
    paddingTop: spacing.md,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  pickerBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.2)',
    paddingVertical: spacing.sm,
    backgroundColor: colors.brand.page,
  },
  pickerBtnPrimary: {
    borderColor: colors.brand.secondary,
    backgroundColor: colors.brand.secondary,
  },
  pickerBtnText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  pickerBtnTextPrimary: {
    color: colors.brand.onAccent,
  },
});
