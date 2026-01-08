import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';

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

  const [showStartTime, setShowStartTime] = useState(false); // legacy fallback
  const [showEndTime, setShowEndTime] = useState(false); // legacy fallback
  const [datePicker, setDatePicker] = useState<{
    visible: boolean;
    type: 'start' | 'end';
    temp: Date;
  }>({ visible: false, type: 'start', temp: new Date() });
  const [timePicker, setTimePicker] = useState<{
    visible: boolean;
    type: 'start' | 'end';
    temp: Date;
  }>({ visible: false, type: 'start', temp: new Date() });

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

  const formatTime = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const openDateModal = (type: 'start' | 'end') => {
    const base =
      type === 'start'
        ? startDate
          ? new Date(startDate)
          : new Date()
        : endDate
          ? new Date(endDate)
          : startDate
            ? new Date(startDate)
            : new Date();
    setDatePicker({ visible: true, type, temp: base });
  };

  const handleConfirmDate = () => {
    const { type, temp } = datePicker;
    const existing =
      type === 'start'
        ? startDate
          ? new Date(startDate)
          : new Date()
        : endDate
          ? new Date(endDate)
          : startDate
            ? new Date(startDate)
            : new Date();
    const merged = new Date(temp);
    merged.setHours(existing.getHours(), existing.getMinutes(), 0, 0);

    if (type === 'start') {
      setStartDate(merged.toISOString());
      if (endDate && new Date(endDate) < merged) {
        setEndDate(undefined);
      }
    } else {
      setEndDate(merged.toISOString());
    }
    setDatePicker((s) => ({ ...s, visible: false }));
  };

  const handleDateChange = (_event: any, date?: Date) => {
    if (!date) return;
    setDatePicker((s) => ({ ...s, temp: date }));
  };

  const openTimeModal = (type: 'start' | 'end') => {
    const base =
      type === 'start'
        ? startDate
          ? new Date(startDate)
          : new Date()
        : endDate
          ? new Date(endDate)
          : startDate
            ? new Date(startDate)
            : new Date();
    setTimePicker({ visible: true, type, temp: base });
  };

  const handleTimeChange = (_event: any, date?: Date) => {
    if (!date) return;
    setTimePicker((s) => ({ ...s, temp: date }));
  };

  const handleConfirmTime = () => {
    const { type, temp } = timePicker;
    if (type === 'start') {
      const base = startDate ? new Date(startDate) : new Date();
      const merged = new Date(base.setHours(temp.getHours(), temp.getMinutes()));
      setStartDate(merged.toISOString());
      if (endDate && new Date(endDate) < merged) {
        setEndDate(undefined);
      }
    } else {
      const base = endDate ? new Date(endDate) : new Date(startDate || Date.now());
      const merged = new Date(base.setHours(temp.getHours(), temp.getMinutes()));
      setEndDate(merged.toISOString());
    }
    setTimePicker((s) => ({ ...s, visible: false }));
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

      <View style={styles.inlineRow}>
        <Text style={styles.label}>Début</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.pill} onPress={() => openDateModal('start')}>
            <Text style={styles.pillText}>{formatDate(startDate) || 'Date'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pill} onPress={() => openTimeModal('start')}>
            <Text style={styles.pillText}>{formatTime(startDate) || 'Heure'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inlineRow}>
        <Text style={styles.label}>Fin (facultatif)</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.pill} onPress={() => openDateModal('end')}>
            <Text style={styles.pillText}>{formatDate(endDate) || 'Date'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pill} onPress={() => openTimeModal('end')}>
            <Text style={styles.pillText}>{formatTime(endDate) || 'Heure'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Emplacement</Text>
        <TouchableOpacity style={styles.input} onPress={onOpenLocation} activeOpacity={0.8}>
          <Text style={[styles.placeholderText, location && styles.valueText]}>
            {location?.addressLabel || 'Emplacement'}
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

      <Modal
        animationType="slide"
        transparent
        visible={datePicker.visible}
        onRequestClose={() => setDatePicker((s) => ({ ...s, visible: false }))}
      >
        <Pressable style={styles.backdrop} onPress={() => setDatePicker((s) => ({ ...s, visible: false }))} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={() => setDatePicker((s) => ({ ...s, visible: false }))}>
              <Text style={styles.link}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirmDate}>
              <Text style={[styles.link, styles.linkStrong]}>Valider</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={datePicker.temp}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
            onChange={handleDateChange}
            locale="fr-FR"
            style={{ alignSelf: 'center' }}
          />
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={timePicker.visible}
        onRequestClose={() => setTimePicker((s) => ({ ...s, visible: false }))}
      >
        <Pressable style={styles.backdrop} onPress={() => setTimePicker((s) => ({ ...s, visible: false }))} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={() => setTimePicker((s) => ({ ...s, visible: false }))}>
              <Text style={styles.link}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirmTime}>
              <Text style={[styles.link, styles.linkStrong]}>Valider</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={timePicker.temp}
            mode="time"
            is24Hour
            display="spinner"
            onChange={handleTimeChange}
          />
        </View>
      </Modal>
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
    width: 110,
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
