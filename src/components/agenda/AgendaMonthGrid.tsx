import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { runOnJS } from 'react-native-reanimated';
import { colors, spacing, typography } from '@/constants/theme';
import {
  formatMonthTitle,
  formatWeekdayShort,
  isSameLocalDay,
  startOfLocalDay,
  toLocalDateKey,
} from '@/utils/agenda';

type Props = {
  days: Date[];
  month: Date;
  today: Date;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  markedKeys: Set<string>;
  onSelect: (day: Date) => void;
  onShiftMonth: (delta: -1 | 1) => void;
};

function inRange(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start) return false;
  const from = startOfLocalDay(start).getTime();
  const to = startOfLocalDay(end ?? start).getTime();
  const value = startOfLocalDay(day).getTime();
  return value >= Math.min(from, to) && value <= Math.max(from, to);
}

export function AgendaMonthGrid({
  days,
  month,
  today,
  rangeStart,
  rangeEnd,
  markedKeys,
  onSelect,
  onShiftMonth,
}: Props) {
  const swipeMonth = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-16, 16])
    .onEnd((event) => {
      if (event.translationX <= -48) runOnJS(onShiftMonth)(1);
      else if (event.translationX >= 48) runOnJS(onShiftMonth)(-1);
    });

  return (
    <View style={styles.wrap}>
      <View style={styles.monthRow}>
        <TouchableOpacity
          onPress={() => onShiftMonth(-1)}
          accessibilityRole="button"
          accessibilityLabel="Mois précédent"
          hitSlop={8}
          style={styles.monthNav}
        >
          <ChevronLeft size={18} color={colors.brand.text} />
        </TouchableOpacity>
        <Text style={styles.month}>{formatMonthTitle(month)}</Text>
        <TouchableOpacity
          onPress={() => onShiftMonth(1)}
          accessibilityRole="button"
          accessibilityLabel="Mois suivant"
          hitSlop={8}
          style={styles.monthNav}
        >
          <ChevronRight size={18} color={colors.brand.text} />
        </TouchableOpacity>
      </View>
      <GestureDetector gesture={swipeMonth}>
      <View>
      <View style={styles.weekdays}>
        {Array.from({ length: 7 }, (_, index) => {
          const day = new Date(2026, 8, 21 + index);
          return (
            <Text key={index} style={styles.weekday}>
              {formatWeekdayShort(day)}
            </Text>
          );
        })}
      </View>
      <View style={styles.grid}>
        {days.map((day) => {
          const key = toLocalDateKey(day);
          const outside = day.getMonth() !== month.getMonth();
          const selected = inRange(day, rangeStart, rangeEnd);
          const edge = (rangeStart && isSameLocalDay(day, rangeStart)) || (rangeEnd && isSameLocalDay(day, rangeEnd));
          const isToday = isSameLocalDay(day, today);
          const marked = markedKeys.has(key);
          return (
            <Pressable
              key={key}
              style={styles.cell}
              onPress={() => onSelect(day)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${day.getDate()} ${formatMonthTitle(day)}`}
            >
              <View style={[styles.disc, selected && styles.discSelected, edge && styles.discEdge, isToday && !selected && styles.discToday]}>
                <Text style={[styles.dayNum, outside && !edge && styles.dayOutside, edge && styles.dayNumSelected]}>
                  {day.getDate()}
                </Text>
              </View>
              <View style={[styles.dot, marked ? styles.dotOn : styles.dotOff]} />
            </Pressable>
          );
        })}
      </View>
      </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  monthNav: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  month: {
    ...typography.caption,
    minWidth: 140,
    textAlign: 'center',
    color: colors.brand.text,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  weekdays: { flexDirection: 'row' },
  weekday: {
    ...typography.caption,
    flex: 1,
    textAlign: 'center',
    color: colors.brand.textSecondary,
    textTransform: 'lowercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285%', alignItems: 'center', paddingVertical: 4, gap: 4 },
  disc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discSelected: { backgroundColor: 'rgba(124, 181, 24, 0.22)' },
  discEdge: { backgroundColor: colors.brand.secondary },
  discToday: { borderWidth: 1.5, borderColor: colors.brand.secondary },
  dayNum: { ...typography.bodySmall, color: colors.brand.text, fontWeight: '700' },
  dayOutside: { color: colors.brand.textSecondary },
  dayNumSelected: { color: colors.brand.onAccent },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotOn: { backgroundColor: colors.brand.secondary },
  dotOff: { backgroundColor: 'transparent' },
});
