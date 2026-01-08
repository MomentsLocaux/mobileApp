import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { DateRangePicker } from '@/components/DateRangePicker';

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
  const setTitle = useCreateEventStore((s) => s.setTitle);
  const setStartDate = useCreateEventStore((s) => s.setStartDate);
  const setEndDate = useCreateEventStore((s) => s.setEndDate);
  const setDescription = useCreateEventStore((s) => s.setDescription);

  const [showRangePicker, setShowRangePicker] = useState(false);

  const hasBaseValid = useMemo(() => {
    return !!title.trim() && !!startDate && !!location;
  }, [title, startDate, location]);

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

  const rangeValue = useMemo(() => {
    return {
      startDate: startDate ? startDate.split('T')[0] : null,
      endDate: endDate ? endDate.split('T')[0] : null,
    };
  }, [startDate, endDate]);

  const mergeDateWithTime = (dateStr: string, existing?: string) => {
    const base = existing ? new Date(existing) : new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return base.toISOString();
    const merged = new Date(base);
    merged.setFullYear(year, month - 1, day);
    merged.setSeconds(0, 0);
    return merged.toISOString();
  };

  const handleRangeChange = (range: { startDate: string | null; endDate: string | null }) => {
    if (range.startDate) {
      const nextStart = mergeDateWithTime(range.startDate, startDate);
      setStartDate(nextStart);
      if (endDate && new Date(endDate) < new Date(nextStart)) {
        setEndDate(undefined);
      }
    } else {
      setStartDate(undefined);
    }

    if (range.endDate) {
      const nextEnd = mergeDateWithTime(range.endDate, endDate || startDate);
      setEndDate(nextEnd);
    } else {
      setEndDate(undefined);
    }
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
          <Text style={styles.pillText}>
            {formatDateRange(startDate, endDate) || 'Choisir des dates'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Emplacement</Text>
        <TouchableOpacity style={styles.pill}  onPress={onOpenLocation} activeOpacity={0.8}>
          <Text style={[styles.pillText, location && styles.valueText]}>
            {location?.addressLabel || "Choisir l'emplacement"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Ajouter plus d'informations (facultatif)</Text>
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
    color: colors.neutral[800],
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    backgroundColor: colors.neutral[0],
  },
  placeholderText: {
    color: colors.neutral[400],
  },
  valueText: {
    color: colors.neutral[800],
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    flex: 1,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pill: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
  },
  pillText: {
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '600',
    textAlign: 'center',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  counter: {
    ...typography.caption,
    color: colors.neutral[500],
    alignSelf: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 72,
    height: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[300],
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: {
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  linkStrong: {
    color: colors.primary[600],
  },
});
