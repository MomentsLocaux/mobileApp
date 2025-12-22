import React, { useMemo } from 'react';
import {
  Modal,
  SafeAreaView,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useDateRangeSelection } from '@/hooks/useDateRangeSelection';
import type { DateRangeMode, DateRangeValue, DateRangeContext } from '@/types/eventDate.model';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

type Props = {
  open: boolean;
  mode: DateRangeMode;
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  onClose: () => void;
  context?: DateRangeContext;
};

const MONTHS_TO_RENDER = 6;

const formatMonthLabel = (date: Date) =>
  new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);

const getMonthDays = (year: number, month: number) => {
  const days: string[] = [];
  const date = new Date(Date.UTC(year, month, 1));
  while (date.getUTCMonth() === month) {
    days.push(date.toISOString().split('T')[0]);
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return days;
};

const getFirstDayOffset = (date: string) => {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 (Sun) - 6
  return day === 0 ? 6 : day - 1; // start week on Monday
};

const isBetween = (date: string, start?: string | null, end?: string | null) => {
  if (!start) return false;
  const ts = new Date(date).getTime();
  const tsStart = new Date(start).getTime();
  const tsEnd = new Date(end || start).getTime();
  return ts >= tsStart && ts <= tsEnd;
};

export const DateRangePicker = ({ open, mode, value, onChange, onClose, context = 'search' }: Props) => {
  const { range, onDayPress, reset } = useDateRangeSelection(mode, value);

  const months = useMemo(() => {
    const res: { id: string; year: number; month: number; label: string; days: string[] }[] = [];
    const now = new Date();
    for (let i = 0; i < MONTHS_TO_RENDER; i++) {
      const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      const month = current.getUTCMonth();
      const year = current.getUTCFullYear();
      res.push({
        id: `${year}-${month}`,
        year,
        month,
        label: formatMonthLabel(current),
        days: getMonthDays(year, month),
      });
    }
    return res;
  }, []);

  const handleDayPress = (date: string) => {
    onDayPress(date);
  };

  const handleValidate = () => {
    onChange(range);
    onClose();
  };

  const handleReset = () => {
    reset();
    onChange({ startDate: null, endDate: null });
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>{context === 'creation' ? 'Choisir les dates' : 'Quand ?'}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.link}>Fermer</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {months.map((month) => (
            <View key={month.id} style={styles.month}>
              <Text style={styles.monthLabel}>{month.label}</Text>
              <View style={styles.weekHeader}>
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, idx) => (
                  <Text key={`${d}-${idx}`} style={styles.weekDay}>
                    {d}
                  </Text>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {Array.from({ length: getFirstDayOffset(month.days[0]) }).map((_, idx) => (
                  <View key={`empty-${idx}`} style={styles.dayCell} />
                ))}
                {month.days.map((day) => {
                  const active = isBetween(day, range.startDate, range.endDate);
                  const isStart = range.startDate === day;
                  const isEnd = (range.endDate || range.startDate) === day;
                  return (
                    <Pressable
                      key={day}
                      style={[
                        styles.dayCell,
                        active && styles.dayActive,
                        isStart && styles.dayEndpoint,
                        isEnd && styles.dayEndpoint,
                      ]}
                      onPress={() => handleDayPress(day)}
                    >
                      <Text style={[styles.dayText, active && styles.dayTextActive]}>
                        {day.split('-')[2]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={handleReset}>
            <Text style={styles.link}>Réinitialiser</Text>
          </Pressable>
          <Pressable style={styles.validateBtn} onPress={handleValidate}>
            <Text style={styles.validateText}>Valider</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h4,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  content: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  month: {
    gap: spacing.sm,
  },
  monthLabel: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  weekDay: {
    ...typography.caption,
    color: colors.neutral[500],
    width: `${100 / 7}%`,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  dayText: {
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  dayActive: {
    backgroundColor: colors.primary[50],
  },
  dayEndpoint: {
    backgroundColor: colors.primary[600],
  },
  dayTextActive: {
    color: colors.neutral[0],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  validateBtn: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  validateText: {
    ...typography.body,
    color: colors.neutral[0],
    fontWeight: '700',
  },
  link: {
    ...typography.body,
    color: colors.primary[600],
    fontWeight: '600',
  },
});
