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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { CoverImageUploader } from '@/components/events/CoverImageUploader';
import { AdditionalImagesUploader } from '@/components/events/AdditionalImagesUploader';
import { CreateEventForm } from '@/components/events/CreateEventForm';
import { LocationPickerModal } from '@/components/events/LocationPickerModal';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { EventsService } from '@/services/events.service';
import { useAuth } from '@/hooks';
import { GuestGateModal } from '@/components/auth/GuestGateModal';

export default function CreateEventStep1() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { session } = useAuth();
  const coverImage = useCreateEventStore((s) => s.coverImage);
  const title = useCreateEventStore((s) => s.title);
  const startDate = useCreateEventStore((s) => s.startDate);
  const location = useCreateEventStore((s) => s.location);
  const setCoverImage = useCreateEventStore((s) => s.setCoverImage);
  const setTitle = useCreateEventStore((s) => s.setTitle);
  const setStartDate = useCreateEventStore((s) => s.setStartDate);
  const setEndDate = useCreateEventStore((s) => s.setEndDate);
  const setLocation = useCreateEventStore((s) => s.setLocation);
  const setDescription = useCreateEventStore((s) => s.setDescription);
  const setCategory = useCreateEventStore((s) => s.setCategory);
  const setSubcategory = useCreateEventStore((s) => s.setSubcategory);
  const setTags = useCreateEventStore((s) => s.setTags);
  const setVisibility = useCreateEventStore((s) => s.setVisibility);
  const setPrice = useCreateEventStore((s) => s.setPrice);
  const setDuration = useCreateEventStore((s) => s.setDuration);
  const setContact = useCreateEventStore((s) => s.setContact);
  const setExternalLink = useCreateEventStore((s) => s.setExternalLink);
  const setVideoLink = useCreateEventStore((s) => s.setVideoLink);
  const setGallery = useCreateEventStore((s) => s.setGallery);
  const resetStore = useCreateEventStore((s) => s.reset);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const resetOnCreateRef = React.useRef(false);
  const isGuest = !session;

  const extractStoragePath = (url: string | null | undefined) => {
    if (!url) return '';
    const marker = '/storage/v1/object/public/event-media/';
    const idx = url.indexOf(marker);
    return idx !== -1 ? url.slice(idx + marker.length) : '';
  };

  React.useEffect(() => {
    // Fresh creation: vider le store si on arrive sans paramètre d'édition
    if (!edit && !resetOnCreateRef.current) {
      resetStore();
      resetOnCreateRef.current = true;
    }

    const prefill = async () => {
      if (!edit) return;
      setPrefilling(true);
      try {
        const evt = await EventsService.getById(edit);
        if (!evt) return;
        resetStore();
        setTitle(evt.title || '');
        setDescription(evt.description || '');
        setStartDate(evt.starts_at || undefined);
        setEndDate(evt.ends_at || undefined);
        setCategory(evt.category || undefined);
        setSubcategory(evt.subcategory || undefined);
        setTags(evt.tags || []);
        setVisibility(evt.visibility === 'prive' ? 'unlisted' : 'public');
        setPrice(evt.price ? String(evt.price) : undefined);
        setDuration(evt.duration || undefined);
        setContact(evt.contact_email || evt.contact_phone || undefined);
        setExternalLink(evt.external_url || undefined);
        setVideoLink(undefined);
        setCoverImage(evt.cover_url ? { publicUrl: evt.cover_url, storagePath: '' } : undefined);
        setGallery(
          (evt.media || [])
            .filter((m) => !!m.url && m.url !== evt.cover_url)
            .slice(0, 3)
            .map((m) => ({
              id: (m as any).id,
              publicUrl: m.url as string,
              storagePath: extractStoragePath(m.url as string),
              status: 'existing',
            }))
        );
        if (evt.latitude && evt.longitude) {
          setLocation({
            latitude: evt.latitude,
            longitude: evt.longitude,
            addressLabel: evt.address || '',
            city: evt.city || '',
            postalCode: evt.postal_code || '',
            country: '',
          });
        }
      } finally {
        setPrefilling(false);
      }
    };
    prefill();
  }, [edit, resetStore, setCategory, setContact, setCoverImage, setDescription, setDuration, setEndDate, setExternalLink, setGallery, setLocation, setPrice, setStartDate, setSubcategory, setTags, setTitle, setVideoLink, setVisibility]);

  const canProceed = useMemo(() => {
    return !!coverImage && formValid && !!title.trim() && !!startDate && !!location;
  }, [coverImage, formValid, title, startDate, location]);

  if (isGuest) {
    return (
      <SafeAreaView style={styles.safe}>
        <GuestGateModal
          visible
          title="Créer un événement"
          onClose={() => router.replace('/(tabs)/map')}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </SafeAreaView>
    );
  }

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
            onPress={() => {
              const dest = edit ? `/events/create/step-2?edit=${edit}` : '/events/create/step-2';
              router.push(dest as any);
            }}
          >
            <Text style={styles.nextText}>Suivant</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <CoverImageUploader />
          <AdditionalImagesUploader />
          <CreateEventForm onOpenLocation={() => setLocationModalVisible(true)} onValidate={setFormValid} />
          {prefilling && <Text style={styles.loadingText}>Pré-remplissage en cours…</Text>}
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
  loadingText: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
