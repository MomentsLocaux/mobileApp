import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { DateRangePicker } from '@/components/DateRangePicker';
import {
  enumerateDateRange,
  isSameDayRange,
  normalizeScheduleByDateRange,
  validateEventSchedule,
  type EventTimeSlot,
} from '@/utils/event-schedule';

type Props = {
  onOpenLocation: () => void;
  onValidate: (valid: boolean) => void;
  onInputFocus?: (key: string) => void;
  onInputRef?: (key: string) => (node: any) => void;
};

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

const DEFAULT_SLOT: EventTimeSlot = { start: '09:00', end: '18:00' };

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

export const CreateEventForm = ({ onOpenLocation, onValidate, onInputFocus, onInputRef }: Props) => {
  const title = useCreateEventStore((s) => s.title);
  const startDate = useCreateEventStore((s) => s.startDate);
  const endDate = useCreateEventStore((s) => s.endDate);
  const location = useCreateEventStore((s) => s.location);
  const description = useCreateEventStore((s) => s.description);
  const scheduleMode = useCreateEventStore((s) => s.scheduleMode);
  const scheduleOpenDays = useCreateEventStore((s) => s.scheduleOpenDays);
  const scheduleFixedSlots = useCreateEventStore((s) => s.scheduleFixedSlots);
  const scheduleVariableDays = useCreateEventStore((s) => s.scheduleVariableDays);
  const setTitle = useCreateEventStore((s) => s.setTitle);
  const setStartDate = useCreateEventStore((s) => s.setStartDate);
  const setEndDate = useCreateEventStore((s) => s.setEndDate);
  const setDescription = useCreateEventStore((s) => s.setDescription);
  const setScheduleMode = useCreateEventStore((s) => s.setScheduleMode);
  const setScheduleOpenDays = useCreateEventStore((s) => s.setScheduleOpenDays);
  const setScheduleFixedSlots = useCreateEventStore((s) => s.setScheduleFixedSlots);
  const setScheduleVariableDays = useCreateEventStore((s) => s.setScheduleVariableDays);

  const [showRangePicker, setShowRangePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<TimePickerTarget | null>(null);

  const sameDayEvent = useMemo(() => isSameDayRange(startDate, endDate), [startDate, endDate]);

  React.useEffect(() => {
    // Even when the user only selects a start date, keep a default end datetime
    // so single-day events always expose editable opening/closing hours.
    if (!startDate || endDate) return;
    const autoEnd = new Date(startDate);
    if (Number.isNaN(autoEnd.getTime())) return;
    autoEnd.setHours(autoEnd.getHours() + 2);
    setEndDate(autoEnd.toISOString());
  }, [startDate, endDate, setEndDate]);

  React.useEffect(() => {
    if (!startDate || !endDate) return;
    const normalized = normalizeScheduleByDateRange({
      startDate,
      endDate,
      variableSchedules: scheduleVariableDays,
    });
    if (JSON.stringify(normalized) !== JSON.stringify(scheduleVariableDays)) {
      setScheduleVariableDays(normalized);
    }
  }, [startDate, endDate, scheduleVariableDays, setScheduleVariableDays]);

  React.useEffect(() => {
    if (!startDate || !endDate) return;
    if (sameDayEvent && scheduleMode !== 'single_day') {
      setScheduleMode('single_day');
      return;
    }
    if (!sameDayEvent && scheduleMode === 'single_day') {
      setScheduleMode('fixed');
    }
  }, [sameDayEvent, scheduleMode, startDate, endDate, setScheduleMode]);

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

  const hasBaseValid = useMemo(() => {
    return !!title.trim() && !!startDate && !!location && scheduleValidation.valid;
  }, [title, startDate, location, scheduleValidation.valid]);

  React.useEffect(() => {
    onValidate(hasBaseValid);
  }, [hasBaseValid, onValidate]);

  const formatDate = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatDateRange = (start?: string, end?: string) => {
    if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
    if (start) return formatDate(start);
    if (end) return formatDate(end);
    return '';
  };

  const formatLongDate = (value: string) => {
    const date = new Date(value);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const rangeValue = useMemo(() => {
    return {
      startDate: startDate ? startDate.split('T')[0] : null,
      endDate: endDate ? endDate.split('T')[0] : null,
    };
  }, [startDate, endDate]);

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

  const handleRangeChange = (range: { startDate: string | null; endDate: string | null }) => {
    if (range.startDate) {
      const nextStart = mergeDateWithTime(range.startDate, startDate, '09:00');
      setStartDate(nextStart);
      if (!range.endDate) {
        const autoEnd = new Date(nextStart);
        autoEnd.setHours(autoEnd.getHours() + 2);
        setEndDate(autoEnd.toISOString());
      } else if (endDate && new Date(endDate) <= new Date(nextStart)) {
        const adjustedEnd = mergeDateWithTime(range.startDate, nextStart, '18:00');
        setEndDate(adjustedEnd);
      }
    } else {
      setStartDate(undefined);
      setEndDate(undefined);
    }

    if (range.endDate) {
      const nextEnd = mergeDateWithTime(range.endDate, endDate || startDate, '18:00');
      setEndDate(nextEnd);
    }
  };

  const getPickerValue = () => {
    if (!timePickerTarget) return new Date();
    if (timePickerTarget.type === 'start') {
      return parseTime(startDate ? new Date(startDate).toTimeString().slice(0, 5) : '09:00');
    }
    if (timePickerTarget.type === 'end') {
      return parseTime(endDate ? new Date(endDate).toTimeString().slice(0, 5) : '18:00');
    }
    if (timePickerTarget.type === 'fixed') {
      return parseTime(scheduleFixedSlots[timePickerTarget.slotIndex]?.[timePickerTarget.field] || '09:00');
    }
    return parseTime(
      scheduleVariableDays[timePickerTarget.date]?.slots[timePickerTarget.slotIndex]?.[timePickerTarget.field] ||
        '09:00',
    );
  };

  const handleTimePicked = (selected: Date) => {
    if (!timePickerTarget) return;
    const time = toTimeString(selected);

    if (timePickerTarget.type === 'start') {
      const nextStart = withTime(startDate, time);
      setStartDate(nextStart);
      if (endDate && new Date(endDate) <= new Date(nextStart)) {
        const fallbackEnd = withTime(endDate || nextStart, time);
        const d = new Date(fallbackEnd);
        d.setHours(d.getHours() + 1);
        setEndDate(d.toISOString());
      }
      return;
    }

    if (timePickerTarget.type === 'end') {
      const nextEnd = withTime(endDate || startDate, time);
      setEndDate(nextEnd);
      return;
    }

    if (timePickerTarget.type === 'fixed') {
      const next = scheduleFixedSlots.map((slot, index) =>
        index === timePickerTarget.slotIndex ? { ...slot, [timePickerTarget.field]: time } : slot,
      );
      setScheduleFixedSlots(next);
      return;
    }

    const targetDay = scheduleVariableDays[timePickerTarget.date];
    if (!targetDay) return;
    const nextDay = {
      ...targetDay,
      slots: targetDay.slots.map((slot, index) =>
        index === timePickerTarget.slotIndex ? { ...slot, [timePickerTarget.field]: time } : slot,
      ),
    };
    setScheduleVariableDays({
      ...scheduleVariableDays,
      [timePickerTarget.date]: nextDay,
    });
  };

  const toggleOpenDay = (day: number) => {
    if (scheduleOpenDays.includes(day)) {
      setScheduleOpenDays(scheduleOpenDays.filter((d) => d !== day));
    } else {
      setScheduleOpenDays([...scheduleOpenDays, day].sort((a, b) => a - b));
    }
  };

  const addFixedSlot = () => {
    setScheduleFixedSlots([...scheduleFixedSlots, { ...DEFAULT_SLOT }]);
  };

  const removeFixedSlot = (slotIndex: number) => {
    const next = scheduleFixedSlots.filter((_, index) => index !== slotIndex);
    if (next.length > 0) setScheduleFixedSlots(next);
  };

  const datesInRange = useMemo(() => enumerateDateRange(startDate, endDate), [startDate, endDate]);

  const toggleVariableDate = (date: string) => {
    const current = scheduleVariableDays[date] || { enabled: true, slots: [{ ...DEFAULT_SLOT }] };
    setScheduleVariableDays({
      ...scheduleVariableDays,
      [date]: {
        ...current,
        enabled: !current.enabled,
      },
    });
  };

  const addVariableSlot = (date: string) => {
    const current = scheduleVariableDays[date] || { enabled: true, slots: [{ ...DEFAULT_SLOT }] };
    setScheduleVariableDays({
      ...scheduleVariableDays,
      [date]: {
        ...current,
        slots: [...current.slots, { ...DEFAULT_SLOT }],
      },
    });
  };

  const removeVariableSlot = (date: string, slotIndex: number) => {
    const current = scheduleVariableDays[date];
    if (!current || current.slots.length <= 1) return;
    setScheduleVariableDays({
      ...scheduleVariableDays,
      [date]: {
        ...current,
        slots: current.slots.filter((_, index) => index !== slotIndex),
      },
    });
  };

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Nom de l'événement</Text>
      <TextInput
        style={styles.input}
        placeholder="Nom de l'événement"
        value={title}
        maxLength={80}
        onChangeText={setTitle}
        ref={onInputRef?.('title')}
        onFocus={() => onInputFocus?.('title')}
      />

      <View style={styles.section}>
        <Text style={styles.label}>Dates</Text>
        <TouchableOpacity style={styles.pill} onPress={() => setShowRangePicker(true)}>
          <Text style={styles.pillText}>{formatDateRange(startDate, endDate) || 'Choisir des dates'}</Text>
        </TouchableOpacity>
      </View>

      {startDate && endDate ? (
        <View style={styles.section}>
          <Text style={styles.label}>Gestion des horaires</Text>

          {sameDayEvent ? (
            <View style={styles.scheduleCard}>
              <Text style={styles.scheduleHint}>Cas simple: indiquez l'heure de début et de fin.</Text>
              <View style={styles.inlineRow}>
                <TouchableOpacity style={styles.timeChip} onPress={() => setTimePickerTarget({ type: 'start' })}>
                  <Text style={styles.timeChipLabel}>Début</Text>
                  <Text style={styles.timeChipValue}>
                    {new Date(startDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.timeChip} onPress={() => setTimePickerTarget({ type: 'end' })}>
                  <Text style={styles.timeChipLabel}>Fin</Text>
                  <Text style={styles.timeChipValue}>
                    {new Date(endDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.scheduleCard}>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeBtn, scheduleMode === 'fixed' && styles.modeBtnActive]}
                  onPress={() => setScheduleMode('fixed')}
                >
                  <Text style={[styles.modeText, scheduleMode === 'fixed' && styles.modeTextActive]}>
                    Horaires fixes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, scheduleMode === 'variable' && styles.modeBtnActive]}
                  onPress={() => setScheduleMode('variable')}
                >
                  <Text style={[styles.modeText, scheduleMode === 'variable' && styles.modeTextActive]}>
                    Horaires variables
                  </Text>
                </TouchableOpacity>
              </View>

              {scheduleMode === 'fixed' ? (
                <>
                  <Text style={styles.scheduleHint}>Jours d'ouverture</Text>
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
                        onPress={() => setTimePickerTarget({ type: 'fixed', slotIndex, field: 'start' })}
                      >
                        <Text style={styles.slotTimeText}>{slot.start}</Text>
                      </TouchableOpacity>
                      <Text style={styles.slotSeparator}>→</Text>
                      <TouchableOpacity
                        style={styles.slotTimeChip}
                        onPress={() => setTimePickerTarget({ type: 'fixed', slotIndex, field: 'end' })}
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
                      ({ enabled: true, slots: [{ ...DEFAULT_SLOT }] } as {
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
                                  onPress={() =>
                                    setTimePickerTarget({
                                      type: 'variable',
                                      date,
                                      slotIndex,
                                      field: 'start',
                                    })
                                  }
                                >
                                  <Text style={styles.slotTimeText}>{slot.start}</Text>
                                </TouchableOpacity>
                                <Text style={styles.slotSeparator}>→</Text>
                                <TouchableOpacity
                                  style={styles.slotTimeChip}
                                  onPress={() =>
                                    setTimePickerTarget({
                                      type: 'variable',
                                      date,
                                      slotIndex,
                                      field: 'end',
                                    })
                                  }
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

      <View style={styles.section}>
        <Text style={styles.label}>Emplacement</Text>
        <TouchableOpacity style={styles.pill} onPress={onOpenLocation} activeOpacity={0.8}>
          <Text style={[styles.pillText, location && styles.valueText]}>
            {location?.addressLabel || "Choisir l'emplacement"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Description"
          value={description}
          onChangeText={(text) => {
            if (text.length <= 1000) setDescription(text);
          }}
          multiline
          ref={onInputRef?.('description')}
          onFocus={() => onInputFocus?.('description')}
        />
        <Text style={styles.counter}>{(description || '').length}/1000</Text>
      </View>

      <DateRangePicker
        open={showRangePicker}
        mode="range"
        value={rangeValue}
        onChange={handleRangeChange}
        onClose={() => setShowRangePicker(false)}
        context="creation"
      />

      {timePickerTarget ? (
        <DateTimePicker
          value={getPickerValue()}
          mode="time"
          display="spinner"
          is24Hour
          onChange={(_, selected) => {
            setTimePickerTarget(null);
            if (selected) {
              handleTimePicked(selected);
            }
          }}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  label: {
    ...typography.body,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    backgroundColor: colors.brand.surface,
    color: colors.brand.text,
  },
  valueText: {
    color: colors.brand.text,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pill: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    backgroundColor: colors.brand.surface,
  },
  pillText: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  scheduleCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
  timeChip: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
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
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: 'rgba(43,191,227,0.2)',
    borderColor: 'rgba(43,191,227,0.45)',
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
    borderColor: 'rgba(255,255,255,0.12)',
  },
  dayChipActive: {
    backgroundColor: 'rgba(43,191,227,0.2)',
    borderColor: 'rgba(43,191,227,0.5)',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
    backgroundColor: 'rgba(43,191,227,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(43,191,227,0.4)',
  },
  addBtnText: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  dayBlock: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    borderColor: 'rgba(255,255,255,0.15)',
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
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  counter: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    alignSelf: 'flex-end',
  },
});
