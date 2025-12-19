import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { CoverImageUploader } from '@/components/events/CoverImageUploader';
import { CreateEventForm } from '@/components/events/CreateEventForm';
import { LocationPickerModal } from '@/components/events/LocationPickerModal';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';

export default function CreateEventStep1() {
  const router = useRouter();
  const coverImage = useCreateEventStore((s) => s.coverImage);
  const title = useCreateEventStore((s) => s.title);
  const startDate = useCreateEventStore((s) => s.startDate);
  const location = useCreateEventStore((s) => s.location);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [formValid, setFormValid] = useState(false);

  const canProceed = useMemo(() => {
    return !!coverImage && formValid && !!title.trim() && !!startDate && !!location;
  }, [coverImage, formValid, title, startDate, location]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <ChevronLeft size={20} color={colors.neutral[800]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouvel évènement</Text>
          <TouchableOpacity
            style={[styles.headerBtn, styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
            disabled={!canProceed}
            onPress={() => router.push('/events/create/step-2' as any)}
          >
            <Text style={styles.nextText}>Suivant</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <CoverImageUploader />
          <CreateEventForm onOpenLocation={() => setLocationModalVisible(true)} onValidate={setFormValid} />
        </ScrollView>
      </KeyboardAvoidingView>

      <LocationPickerModal visible={locationModalVisible} onClose={() => setLocationModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  headerBtn: {
    padding: spacing.sm,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h5,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  nextBtn: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  nextBtnDisabled: {
    backgroundColor: colors.neutral[300],
  },
  nextText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
});
