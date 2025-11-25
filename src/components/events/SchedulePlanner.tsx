import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Clock } from 'lucide-react-native';
import { Input } from '../ui';
import type { ScheduleMode, DailyScheduleSlot } from '../../types/event-form';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

interface SchedulePlannerProps {
  mode: ScheduleMode;
  uniformOpening: string;
  uniformClosing: string;
  dailySchedule: DailyScheduleSlot[];
  startsAt: string;
  endsAt: string;
  onModeChange: (mode: ScheduleMode) => void;
  onUniformOpeningChange: (time: string) => void;
  onUniformClosingChange: (time: string) => void;
  onDailyScheduleChange: (schedule: DailyScheduleSlot[]) => void;
}

export function SchedulePlanner({
  mode,
  uniformOpening,
  uniformClosing,
  dailySchedule,
  startsAt,
  endsAt,
  onModeChange,
  onUniformOpeningChange,
  onUniformClosingChange,
  onDailyScheduleChange,
}: SchedulePlannerProps) {
  const generateDailySchedule = (): DailyScheduleSlot[] => {
    if (!startsAt || !endsAt) return [];

    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

    const slots: DailyScheduleSlot[] = [];
    const current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const existing = dailySchedule.find((s) => s.date === dateStr);

      slots.push({
        date: dateStr,
        opensAt: existing?.opensAt || uniformOpening || '09:00',
        closesAt: existing?.closesAt || uniformClosing || '18:00',
      });

      current.setDate(current.getDate() + 1);
    }

    return slots;
  };

  const handleGenerateSchedule = () => {
    const schedule = generateDailySchedule();
    onDailyScheduleChange(schedule);
  };

  const updateSlot = (date: string, field: 'opensAt' | 'closesAt', value: string) => {
    const updated = dailySchedule.map((slot) =>
      slot.date === date ? { ...slot, [field]: value } : slot
    );
    onDailyScheduleChange(updated);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'uniform' && styles.modeButtonActive]}
          onPress={() => onModeChange('uniform')}
        >
          <Text
            style={[
              styles.modeButtonText,
              mode === 'uniform' && styles.modeButtonTextActive,
            ]}
          >
            Horaires uniformes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, mode === 'daily' && styles.modeButtonActive]}
          onPress={() => onModeChange('daily')}
        >
          <Text
            style={[
              styles.modeButtonText,
              mode === 'daily' && styles.modeButtonTextActive,
            ]}
          >
            Par jour
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'uniform' && (
        <View style={styles.uniformSection}>
          <View style={styles.timeRow}>
            <View style={styles.timeInput}>
              <Input
                label="Ouverture"
                value={uniformOpening}
                onChangeText={onUniformOpeningChange}
                placeholder="09:00"
              />
            </View>
            <View style={styles.timeInput}>
              <Input
                label="Fermeture"
                value={uniformClosing}
                onChangeText={onUniformClosingChange}
                placeholder="18:00"
              />
            </View>
          </View>
          <Text style={styles.hint}>
            Ces horaires seront appliqués à tous les jours de l'événement
          </Text>
        </View>
      )}

      {mode === 'daily' && (
        <View style={styles.dailySection}>
          {dailySchedule.length === 0 ? (
            <TouchableOpacity
              style={styles.generateButton}
              onPress={handleGenerateSchedule}
            >
              <Clock size={18} color={colors.primary[600]} />
              <Text style={styles.generateButtonText}>
                Générer le planning
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.headerText}>Planning détaillé</Text>
                <TouchableOpacity onPress={handleGenerateSchedule}>
                  <Text style={styles.regenerateText}>Régénérer</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scheduleList}
                showsVerticalScrollIndicator={false}
              >
                {dailySchedule.map((slot) => (
                  <View key={slot.date} style={styles.slotCard}>
                    <Text style={styles.slotDate}>{formatDate(slot.date)}</Text>
                    <View style={styles.slotTimes}>
                      <View style={styles.slotTimeInput}>
                        <Input
                          label="De"
                          value={slot.opensAt}
                          onChangeText={(value) =>
                            updateSlot(slot.date, 'opensAt', value)
                          }
                          placeholder="09:00"
                        />
                      </View>
                      <View style={styles.slotTimeInput}>
                        <Input
                          label="À"
                          value={slot.closesAt}
                          onChangeText={(value) =>
                            updateSlot(slot.date, 'closesAt', value)
                          }
                          placeholder="18:00"
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.neutral[100],
    padding: spacing.xs,
    borderRadius: borderRadius.md,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  modeButtonActive: {
    backgroundColor: colors.neutral[0],
  },
  modeButtonText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: colors.neutral[900],
    fontWeight: '600',
  },
  uniformSection: {
    gap: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeInput: {
    flex: 1,
  },
  hint: {
    ...typography.caption,
    color: colors.neutral[600],
    fontStyle: 'italic',
  },
  dailySection: {
    gap: spacing.md,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderStyle: 'dashed',
  },
  generateButtonText: {
    ...typography.body,
    color: colors.primary[600],
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  regenerateText: {
    ...typography.bodySmall,
    color: colors.primary[600],
    fontWeight: '600',
  },
  scheduleList: {
    maxHeight: 400,
  },
  slotCard: {
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  slotDate: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  slotTimes: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  slotTimeInput: {
    flex: 1,
  },
});
