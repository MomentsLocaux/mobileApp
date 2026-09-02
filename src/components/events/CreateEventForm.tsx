import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { EventScheduleEditor } from '@/components/events/EventScheduleEditor';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { validateEventSchedule, type EventScheduleDraft } from '@/utils/event-schedule';

type Props = {
  onOpenLocation: () => void;
  onValidate: (valid: boolean) => void;
  onInputFocus?: (key: string) => void;
  onInputRef?: (key: string) => (node: any) => void;
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
  const submissionSource = useCreateEventStore((s) => s.submissionSource);

  const scheduleValue = useMemo<EventScheduleDraft>(
    () => ({
      startDate,
      endDate,
      scheduleMode,
      scheduleOpenDays,
      scheduleFixedSlots,
      scheduleVariableDays,
    }),
    [endDate, scheduleFixedSlots, scheduleMode, scheduleOpenDays, scheduleVariableDays, startDate],
  );

  const onScheduleChange = useCallback(
    (next: EventScheduleDraft) => {
      setStartDate(next.startDate);
      setEndDate(next.endDate);
      setScheduleMode(next.scheduleMode);
      setScheduleOpenDays(next.scheduleOpenDays);
      setScheduleFixedSlots(next.scheduleFixedSlots);
      setScheduleVariableDays(next.scheduleVariableDays);
    },
    [setEndDate, setScheduleFixedSlots, setScheduleMode, setScheduleOpenDays, setScheduleVariableDays, setStartDate],
  );

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
    [endDate, scheduleFixedSlots, scheduleMode, scheduleOpenDays, scheduleVariableDays, startDate],
  );

  const hasBaseValid = Boolean(title.trim() && startDate && location && scheduleValidation.valid);

  React.useEffect(() => {
    onValidate(hasBaseValid);
  }, [hasBaseValid, onValidate]);

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

      <EventScheduleEditor
        value={scheduleValue}
        onChange={onScheduleChange}
        hint={
          submissionSource === 'community_suggest'
            ? 'L’affiche ne préremplit que les dates de début et de fin (et l’heure globale si elle est écrite). Les horaires particuliers se règlent ici — aussi en saisie manuelle.'
            : undefined
        }
      />

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
