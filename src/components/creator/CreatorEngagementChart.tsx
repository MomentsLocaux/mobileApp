import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { borderRadius, colors, minimumTouchTarget, spacing, typography } from '@/constants/theme';
import { Card } from '@/components/ui';

const AnimatedView = Animated.createAnimatedComponent(View);

export type EngagementRange = '7D' | '30D' | '90D';

export interface EngagementPoint {
  label: string;
  value: number;
}

interface CreatorEngagementChartProps {
  dataByRange: Record<EngagementRange, EngagementPoint[]>;
  activeRange: EngagementRange;
  onRangeChange: (range: EngagementRange) => void;
}

const RANGES: EngagementRange[] = ['7D', '30D', '90D'];
const CHART_HEIGHT = 168;
const VERTICAL_PADDING = 16;
const HORIZONTAL_PADDING = 12;

function buildLinePath(points: { x: number; y: number }[]) {
  if (!points.length) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

function buildAreaPath(points: { x: number; y: number }[], chartHeight: number) {
  if (!points.length) return '';
  const line = buildLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x} ${chartHeight} L ${first.x} ${chartHeight} Z`;
}

export function CreatorEngagementChart({
  dataByRange,
  activeRange,
  onRangeChange,
}: CreatorEngagementChartProps) {
  const [chartWidth, setChartWidth] = useState(0);
  const animatedOpacity = useSharedValue(1);

  const activePoints = useMemo(() => dataByRange[activeRange] ?? [], [activeRange, dataByRange]);

  const chartGeometry = useMemo(() => {
    const safeWidth = Math.max(220, chartWidth || 220);
    const usableWidth = safeWidth - HORIZONTAL_PADDING * 2;
    const usableHeight = CHART_HEIGHT - VERTICAL_PADDING * 2;
    const values = activePoints.map((point) => Number(point.value || 0));
    const maxValue = Math.max(1, ...values);

    const mapped = activePoints.map((point, index) => {
      const x =
        HORIZONTAL_PADDING +
        (activePoints.length <= 1
          ? 0
          : (index / (activePoints.length - 1)) * usableWidth);
      const ratio = Number(point.value || 0) / maxValue;
      const y = VERTICAL_PADDING + (1 - ratio) * usableHeight;
      return { ...point, x, y };
    });

    return {
      safeWidth,
      maxValue,
      mapped,
      linePath: buildLinePath(mapped),
      areaPath: buildAreaPath(mapped, CHART_HEIGHT - VERTICAL_PADDING),
      last: mapped[mapped.length - 1],
    };
  }, [activePoints, chartWidth]);

  const animatedChartStyle = useAnimatedStyle(() => ({
    opacity: animatedOpacity.value,
    transform: [{ translateY: (1 - animatedOpacity.value) * 6 }],
  }));

  const handleRangeChange = (range: EngagementRange) => {
    if (range === activeRange) return;
    animatedOpacity.value = 0.2;
    animatedOpacity.value = withTiming(1, { duration: 180 });
    onRangeChange(range);
  };

  const onChartLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== chartWidth) {
      setChartWidth(nextWidth);
    }
  };

  return (
    <Card padding="md" elevation="sm" style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Engagement</Text>
        <View style={styles.rangeTabs}>
          {RANGES.map((range) => {
            const active = range === activeRange;
            return (
              <Pressable
                key={range}
                onPress={() => handleRangeChange(range)}
                style={[styles.rangeButton, active && styles.rangeButtonActive]}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Filtre ${range}`}
              >
                <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{range}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <AnimatedView style={[styles.chartContainer, animatedChartStyle]} onLayout={onChartLayout}>
        <Svg width={chartGeometry.safeWidth} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="engagementArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.primary[500]} stopOpacity="0.28" />
              <Stop offset="100%" stopColor={colors.primary[500]} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {chartGeometry.areaPath ? (
            <Path d={chartGeometry.areaPath} fill="url(#engagementArea)" />
          ) : null}

          {chartGeometry.linePath ? (
            <Path
              d={chartGeometry.linePath}
              fill="none"
              stroke={colors.primary[600]}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {chartGeometry.last ? (
            <Path
              d={`M ${chartGeometry.last.x} ${chartGeometry.last.y} m -5, 0 a 5,5 0 1,0 10,0 a 5,5 0 1,0 -10,0`}
              fill={colors.secondaryAccent[500]}
              stroke={colors.primary[600]}
              strokeWidth={2}
            />
          ) : null}
        </Svg>
      </AnimatedView>

      <View style={styles.footerRow}>
        <Text style={styles.metricLabel}>Pic sur {activeRange}</Text>
        <Text style={styles.metricValue}>{Math.round(chartGeometry.maxValue)} pts</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.secondaryAccent[500],
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...typography.h6,
    color: colors.textPrimary[500],
  },
  rangeTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rangeButton: {
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background[500],
  },
  rangeButtonActive: {
    backgroundColor: colors.primary[600],
  },
  rangeText: {
    ...typography.bodySmall,
    color: colors.textSecondary[500],
    fontWeight: '700',
  },
  rangeTextActive: {
    color: colors.secondaryAccent[500],
  },
  chartContainer: {
    minHeight: CHART_HEIGHT,
    overflow: 'hidden',
    borderRadius: borderRadius.md,
    backgroundColor: colors.background[500],
    paddingVertical: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textSecondary[500],
  },
  metricValue: {
    ...typography.bodySmall,
    color: colors.primary[700],
    fontWeight: '700',
  },
});
