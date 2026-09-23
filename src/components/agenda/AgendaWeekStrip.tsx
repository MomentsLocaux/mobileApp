import { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, Pressable } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { BrandIcon } from '@/components/ui';
import { colors, spacing, typography } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/utils/haptics';
import {
  formatActivityCount,
  formatMonthTitle,
  formatWeekdayShort,
  isSameLocalDay,
  toLocalDateKey,
} from '@/utils/agenda';

type Props = {
  days: Date[];
  selected: Date;
  today: Date;
  markedKeys: Set<string>;
  onSelect: (day: Date) => void;
  onShiftWeek: (delta: -1 | 1) => void;
};

const SWIPE_DISTANCE = 48;
const SWIPE_VELOCITY = 650;
const FAIL_VERTICAL = 16;
const ACTIVE_HORIZONTAL = 16;

export function AgendaWeekStrip({ days, selected, today, markedKeys, onSelect, onShiftWeek }: Props) {
  const reduceMotion = useReduceMotion();
  const shiftRef = useRef(onShiftWeek);
  shiftRef.current = onShiftWeek;
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const pressLocked = useRef(false);

  const translateX = useSharedValue(0);
  const stripWidth = useSharedValue(280);
  const reduceMotionSv = useSharedValue(reduceMotion);
  reduceMotionSv.value = reduceMotion;

  const commitShift = useCallback((delta: -1 | 1) => {
    pressLocked.current = true;
    haptics.selection();
    shiftRef.current(delta);
    requestAnimationFrame(() => {
      pressLocked.current = false;
    });
  }, []);

  const finishIdle = useCallback(() => {
    requestAnimationFrame(() => {
      pressLocked.current = false;
    });
  }, []);

  const lockPress = useCallback(() => {
    pressLocked.current = true;
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activeOffsetX([-ACTIVE_HORIZONTAL, ACTIVE_HORIZONTAL])
        .failOffsetY([-FAIL_VERTICAL, FAIL_VERTICAL])
        .onUpdate((event) => {
          if (Math.abs(event.translationX) > ACTIVE_HORIZONTAL) {
            runOnJS(lockPress)();
          }
          if (reduceMotionSv.value) return;
          const max = stripWidth.value * 0.4;
          translateX.value = Math.max(-max, Math.min(max, event.translationX));
        })
        .onEnd((event) => {
          const goNext =
            event.translationX < -SWIPE_DISTANCE || event.velocityX < -SWIPE_VELOCITY;
          const goPrev =
            event.translationX > SWIPE_DISTANCE || event.velocityX > SWIPE_VELOCITY;

          if (!goNext && !goPrev) {
            translateX.value = withSpring(0, { damping: 16, stiffness: 240, mass: 0.8 });
            runOnJS(finishIdle)();
            return;
          }

          const delta: -1 | 1 = goNext ? 1 : -1;
          if (reduceMotionSv.value) {
            translateX.value = 0;
            runOnJS(commitShift)(delta);
            return;
          }

          const exit = delta === 1 ? -stripWidth.value * 0.55 : stripWidth.value * 0.55;
          const enter = -exit * 0.55;
          translateX.value = withTiming(exit, { duration: 180 }, (finished) => {
            if (!finished) {
              translateX.value = withSpring(0, { damping: 16, stiffness: 240, mass: 0.8 });
              return;
            }
            runOnJS(commitShift)(delta);
            translateX.value = enter;
            translateX.value = withSpring(0, { damping: 16, stiffness: 240, mass: 0.8 });
          });
        })
        .onFinalize((_, success) => {
          if (!success) {
            translateX.value = withSpring(0, { damping: 16, stiffness: 240, mass: 0.8 });
            runOnJS(finishIdle)();
          }
        }),
    [commitShift, finishIdle, lockPress, reduceMotionSv, stripWidth, translateX]
  );

  const weekSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const onPressDay = (day: Date) => {
    if (pressLocked.current) return;
    selectRef.current(day);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.monthRow}>
        <TouchableOpacity
          onPress={() => onShiftWeek(-1)}
          accessibilityRole="button"
          accessibilityLabel="Semaine précédente"
          hitSlop={8}
          style={styles.monthNav}
        >
          <ChevronLeft size={18} color={colors.brand.text} />
        </TouchableOpacity>
        <Text style={styles.month}>{formatMonthTitle(selected)}</Text>
        <TouchableOpacity
          onPress={() => onShiftWeek(1)}
          accessibilityRole="button"
          accessibilityLabel="Semaine suivante"
          hitSlop={8}
          style={styles.monthNav}
        >
          <ChevronRight size={18} color={colors.brand.text} />
        </TouchableOpacity>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View
          collapsable={false}
          style={styles.weekHit}
          onLayout={(event) => {
            stripWidth.value = event.nativeEvent.layout.width;
          }}
          accessibilityHint="Glisser vers la gauche ou la droite pour changer de semaine"
        >
          <Animated.View style={[styles.week, weekSlideStyle]}>
            {days.map((day) => {
              const selectedDay = isSameLocalDay(day, selected);
              const isToday = isSameLocalDay(day, today);
              const marked = markedKeys.has(toLocalDateKey(day));
              return (
                <Pressable
                  key={toLocalDateKey(day)}
                  style={styles.dayCol}
                  onPress={() => onPressDay(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedDay }}
                  accessibilityLabel={`${formatWeekdayShort(day)} ${day.getDate()}`}
                >
                  <Text style={[styles.weekday, selectedDay && styles.weekdaySelected]}>
                    {formatWeekdayShort(day)}
                  </Text>
                  <View
                    style={[
                      styles.disc,
                      selectedDay && styles.discSelected,
                      isToday && !selectedDay && styles.discToday,
                    ]}
                  >
                    <Text style={[styles.dayNum, selectedDay && styles.dayNumSelected]}>
                      {day.getDate()}
                    </Text>
                  </View>
                  <View style={[styles.dot, marked ? styles.dotOn : styles.dotOff]} />
                </Pressable>
              );
            })}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export function AgendaCountLabel({ count }: { count: number }) {
  return (
    <View style={styles.countRow}>
      <BrandIcon name="calendar" size={16} color={colors.brand.textSecondary} />
      <Text style={styles.countText}>{formatActivityCount(count)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  monthNav: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: {
    ...typography.caption,
    color: colors.brand.text,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  weekHit: {
    overflow: 'hidden',
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
  },
  weekday: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textTransform: 'lowercase',
  },
  weekdaySelected: {
    color: colors.brand.text,
    fontWeight: '700',
  },
  disc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discSelected: {
    backgroundColor: colors.brand.secondary,
  },
  discToday: {
    borderWidth: 1.5,
    borderColor: colors.brand.secondary,
  },
  dayNum: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  dayNumSelected: {
    color: colors.brand.onAccent,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotOn: {
    backgroundColor: colors.brand.secondary,
  },
  dotOff: {
    backgroundColor: 'transparent',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: 2,
  },
  countText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
});
