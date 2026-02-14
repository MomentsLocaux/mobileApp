import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { DayScheduleRow } from '@/components/DayScheduleRow';
import { useEventSchedules } from '@/hooks/useEventSchedules';
import type { EventDateConfig } from '@/types/eventDate.model';
import { colors, spacing, typography, borderRadius } from '@/components/ui/v2/theme';
import DateTimePicker from '@react-native-community/datetimepicker';

type Props = {
  config: EventDateConfig;
  onChange: (config: EventDateConfig) => void;
};

const parseTime = (value: string) => {
  const [hours, minutes] = value.split(':').map((v) => Number(v));
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
};

const toTimeString = (date: Date) =>
  `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

export const EventScheduleManager = ({ config, onChange }: Props) => {
  const [open, setOpen] = useState(true);
  const { days, toggleCustom, updateDay, defaultHours } = useEventSchedules(config);
  const [showDefaultStart, setShowDefaultStart] = useState(false);
  const [showDefaultEnd, setShowDefaultEnd] = useState(false);

  if (config.startDate === config.endDate) return null;

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={() => setOpen((prev) => !prev)}>
        <Text style={styles.title}>Gérer les horaires</Text>
        <Text style={styles.link}>{open ? 'Masquer' : 'Afficher'}</Text>
      </Pressable>

      {open && (
        <View style={styles.body}>
          <View style={styles.defaultRow}>
            <Text style={styles.subtitle}>Horaires par défaut</Text>
            <View style={styles.defaultHours}>
              <Pressable
                style={styles.timeChip}
                onPress={() => setShowDefaultStart(true)}
              >
                <Text style={styles.timeText}>{defaultHours.start}</Text>
              </Pressable>
              <Text style={styles.separator}>—</Text>
              <Pressable
                style={styles.timeChip}
                onPress={() => setShowDefaultEnd(true)}
              >
                <Text style={styles.timeText}>{defaultHours.end}</Text>
              </Pressable>
            </View>
          </View>

          {showDefaultStart && (
            <DateTimePicker
              value={parseTime(defaultHours.start)}
              mode="time"
              display="spinner"
              onChange={(_, selected) => {
                setShowDefaultStart(false);
                if (selected) {
                  const next = { ...defaultHours, start: toTimeString(selected) };
                  onChange({ ...config, defaultHours: next });
                }
              }}
            />
          )}

          {showDefaultEnd && (
            <DateTimePicker
              value={parseTime(defaultHours.end)}
              mode="time"
              display="spinner"
              onChange={(_, selected) => {
                setShowDefaultEnd(false);
                if (selected) {
                  const next = { ...defaultHours, end: toTimeString(selected) };
                  onChange({ ...config, defaultHours: next });
                }
              }}
            />
          )}

          <FlatList
            data={days}
            keyExtractor={(item) => item.date}
            renderItem={({ item }) => (
              <DayScheduleRow
                label={item.label}
                date={item.date}
                start={item.start}
                end={item.end}
                isCustom={item.isCustom}
                onToggleCustom={(active) => {
                  toggleCustom(item.date, active);
                  onChange({
                    ...config,
                    dailyOverrides: {
                      ...(config.dailyOverrides || {}),
                      ...(active ? { [item.date]: { start: item.start, end: item.end } } : {}),
                    },
                  });
                }}
                onChangeTime={(hours) => {
                  updateDay(item.date, hours);
                  onChange({
                    ...config,
                    dailyOverrides: {
                      ...(config.dailyOverrides || {}),
                      [item.date]: {
                        start: hours.start ?? item.start,
                        end: hours.end ?? item.end,
                      },
                    },
                  });
                }}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.scale.neutral[200],
    backgroundColor: colors.scale.neutral[0],
    overflow: 'hidden',
  },
  header: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.body,
    color: colors.scale.neutral[900],
    fontWeight: '700',
  },
  link: {
    ...typography.bodySmall,
    color: colors.scale.primary[600],
    fontWeight: '600',
  },
  body: {
    padding: spacing.md,
    gap: spacing.md,
  },
  defaultRow: {
    gap: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.scale.neutral[800],
    fontWeight: '700',
  },
  defaultHours: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.scale.neutral[300],
  },
  timeText: {
    ...typography.body,
    color: colors.scale.neutral[900],
    fontWeight: '600',
  },
  separator: {
    ...typography.body,
    color: colors.scale.neutral[700],
    fontWeight: '600',
  },
});
