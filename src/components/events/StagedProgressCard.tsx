import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { BrandLogoSpinner } from '@/components/ui';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import {
  stagedProgressEase,
  stagedProgressPercent,
  stagedProgressStepStatus,
  type StagedProgressStep,
} from '@/utils/staged-progress';

type Props = {
  steps: readonly StagedProgressStep[];
  stepId: string;
  complete?: boolean;
  spinnerLabel?: string;
  readyCaption?: string;
  accessibilityPrefix?: string;
  /** Time constant for the in-step ease. Cover generation is slower than poster OCR. */
  easeTauMs?: number;
};

export function StagedProgressCard({
  steps,
  stepId,
  complete = false,
  spinnerLabel = 'En cours',
  readyCaption = 'C’est prêt',
  accessibilityPrefix = 'Progression',
  easeTauMs = 8000,
}: Props) {
  const reduceMotion = useReduceMotion();
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    setElapsedMs(0);
    if (reduceMotion || complete) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 200);
    return () => clearInterval(timer);
  }, [complete, reduceMotion, stepId]);

  const stepProgress = complete ? 1 : reduceMotion ? 0 : stagedProgressEase(elapsedMs, easeTauMs);
  const percent = stagedProgressPercent(steps, stepId, stepProgress, { complete });
  const activeLabel = steps.find((step) => step.id === stepId)?.label ?? spinnerLabel;

  const rows = useMemo(
    () =>
      steps.map((step) => ({
        ...step,
        status: stagedProgressStepStatus(steps, step.id, stepId, { complete }),
      })),
    [complete, stepId, steps],
  );

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${accessibilityPrefix}, ${percent} pour cent. ${activeLabel}.`}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <BrandLogoSpinner size={56} accessibilityLabel={spinnerLabel} />
      </View>
      <Text style={styles.percent}>{percent} %</Text>
      <Text style={styles.caption}>{complete ? readyCaption : activeLabel}</Text>

      <View style={styles.track} accessibilityElementsHidden>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>

      <View style={styles.timeline}>
        {rows.map((step, index) => {
          const isLast = index === rows.length - 1;
          return (
            <View key={step.id} style={styles.row}>
              <View style={styles.rail}>
                <View
                  style={[
                    styles.dot,
                    step.status === 'done' && styles.dotDone,
                    step.status === 'active' && styles.dotActive,
                  ]}
                >
                  {step.status === 'done' ? (
                    <Check size={12} color={colors.brand.onAccent} strokeWidth={3} />
                  ) : null}
                </View>
                {isLast ? null : (
                  <View style={[styles.connector, step.status === 'done' && styles.connectorDone]} />
                )}
              </View>
              <View style={[styles.labels, isLast && styles.labelsLast]}>
                <Text
                  style={[
                    styles.stepLabel,
                    step.status === 'pending' && styles.stepLabelPending,
                    step.status === 'active' && styles.stepLabelActive,
                  ]}
                >
                  {step.label}
                </Text>
                <Text style={styles.stepDetail}>{step.detail}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  percent: {
    ...typography.h2,
    color: colors.brand.text,
    fontWeight: '700',
  },
  caption: {
    ...typography.body,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
  track: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(124, 181, 24, 0.18)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.brand.secondary,
  },
  timeline: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rail: {
    width: 22,
    alignItems: 'center',
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    backgroundColor: colors.brand.page,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    borderColor: colors.brand.secondary,
    backgroundColor: 'rgba(124, 181, 24, 0.16)',
  },
  dotDone: {
    borderColor: colors.brand.secondary,
    backgroundColor: colors.brand.secondary,
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 18,
    backgroundColor: colors.neutral[200],
  },
  connectorDone: {
    backgroundColor: colors.brand.secondary,
  },
  labels: {
    flex: 1,
    paddingBottom: spacing.md,
    gap: 2,
  },
  labelsLast: {
    paddingBottom: 0,
  },
  stepLabel: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  stepLabelActive: {
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  stepLabelPending: {
    color: colors.brand.textSecondary,
    fontWeight: '500',
  },
  stepDetail: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
});
