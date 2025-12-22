import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

type Props = {
  label: string;
  date: string;
  start: string;
  end: string;
  isCustom: boolean;
  onToggleCustom: (active: boolean) => void;
  onChangeTime: (payload: { start?: string; end?: string }) => void;
};

const parseTime = (value: string) => {
  const [hours, minutes] = value.split(':').map((v) => Number(v));
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
};

const toTimeString = (date: Date) =>
  `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

export const DayScheduleRow = ({
  label,
  start,
  end,
  isCustom,
  onToggleCustom,
  onChangeTime,
}: Props) => {
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Switch value={isCustom} onValueChange={onToggleCustom} />
      </View>

      <View style={styles.hoursRow}>
        <Pressable
          style={[styles.timeChip, !isCustom && styles.disabledChip]}
          onPress={() => setShowStart(true)}
          disabled={!isCustom}
        >
          <Text style={[styles.timeText, !isCustom && styles.disabledText]}>{start}</Text>
        </Pressable>
        <Text style={styles.separator}>—</Text>
        <Pressable
          style={[styles.timeChip, !isCustom && styles.disabledChip]}
          onPress={() => setShowEnd(true)}
          disabled={!isCustom}
        >
          <Text style={[styles.timeText, !isCustom && styles.disabledText]}>{end}</Text>
        </Pressable>
      </View>

      {showStart && (
        <DateTimePicker
          value={parseTime(start)}
          mode="time"
          display="spinner"
          onChange={(_, selected) => {
            setShowStart(false);
            if (selected) onChangeTime({ start: toTimeString(selected) });
          }}
        />
      )}

      {showEnd && (
        <DateTimePicker
          value={parseTime(end)}
          mode="time"
          display="spinner"
          onChange={(_, selected) => {
            setShowEnd(false);
            if (selected) onChangeTime({ end: toTimeString(selected) });
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  disabledChip: {
    backgroundColor: colors.neutral[100],
  },
  timeText: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  disabledText: {
    color: colors.neutral[500],
  },
  separator: {
    ...typography.body,
    color: colors.neutral[700],
    fontWeight: '600',
  },
});
