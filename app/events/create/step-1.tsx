import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { AppBackground, colors, radius, shadows, spacing, typography } from '@/components/ui/v2';
import { CoverImageUploader } from '@/components/events/CoverImageUploader';
import { AdditionalImagesUploader } from '@/components/events/AdditionalImagesUploader';
import { CreateEventForm } from '@/components/events/CreateEventForm';
import { LocationPickerModal } from '@/components/events/LocationPickerModal';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { EventsService } from '@/services/events.service';
import { useAuth } from '@/hooks';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { useAutoScrollOnFocus } from '@/hooks/useAutoScrollOnFocus';

export default function CreateEventStep1() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { session, user } = useAuth();
  const coverImage = useCreateEventStore((s) => s.coverImage);
  const title = useCreateEventStore((s) => s.title);
  const startDate = useCreateEventStore((s) => s.startDate);
  const endDate = useCreateEventStore((s) => s.endDate);
  const location = useCreateEventStore((s) => s.location);
  const description = useCreateEventStore((s) => s.description);
  const category = useCreateEventStore((s) => s.category);
  const subcategory = useCreateEventStore((s) => s.subcategory);
  const tags = useCreateEventStore((s) => s.tags);
  const visibility = useCreateEventStore((s) => s.visibility);
  const price = useCreateEventStore((s) => s.price);
  const contact = useCreateEventStore((s) => s.contact);
  const externalLink = useCreateEventStore((s) => s.externalLink);
  const videoLink = useCreateEventStore((s) => s.videoLink);
  const gallery = useCreateEventStore((s) => s.gallery);
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
  const [savingDraft, setSavingDraft] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const resetOnCreateRef = React.useRef(false);
  const isGuest = !session;
  const insets = useSafeAreaInsets();
  const { scrollViewRef, registerFieldRef, handleInputFocus, handleScroll } = useAutoScrollOnFocus();

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
        setExistingStatus(evt.status ?? null);
        setTitle(evt.title || '');
        setDescription(evt.description || '');
        setStartDate(evt.starts_at || undefined);
        setEndDate(evt.ends_at || undefined);
        setCategory(evt.category || undefined);
        setSubcategory(evt.subcategory || undefined);
        setTags(evt.tags || []);
        setVisibility(evt.visibility === 'prive' ? 'unlisted' : 'public');
        setPrice(evt.price ? String(evt.price) : undefined);
        setDuration(undefined);
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

  const canSaveDraft = !!title.trim() && !!location;

  const handleSaveDraft = useCallback(async () => {
    if (!user || savingDraft) return;
    if (!canSaveDraft) {
      Alert.alert('Brouillon incomplet', "Ajoute au minimum un titre et un lieu pour enregistrer un brouillon.");
      return;
    }

    if (edit && existingStatus && existingStatus !== 'draft') {
      Alert.alert('Impossible', "Cet événement est déjà publié, impossible de l'enregistrer en brouillon.");
      return;
    }

    setSavingDraft(true);
    try {
      const contact_email = contact && contact.includes('@') ? contact : null;
      const contact_phone = contact && !contact.includes('@') ? contact : null;
      let priceValue: number | null = null;
      if (price) {
        const normalized = Number(price.replace(',', '.').replace(/[^0-9.-]/g, ''));
        if (!Number.isNaN(normalized)) {
          priceValue = normalized;
        }
      }

      const payload = {
        title: title.trim(),
        description: description || '',
        category: category || null,
        subcategory: subcategory || null,
        tags,
        starts_at: startDate || new Date().toISOString(),
        ends_at: endDate || null,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.addressLabel || '',
        city: location.city || null,
        postal_code: location.postalCode || null,
        visibility: visibility === 'public' ? 'public' : 'prive',
        is_free: !price || price.toLowerCase().includes('gratuit'),
        price: priceValue,
        cover_url: coverImage?.publicUrl || null,
        max_participants: null,
        registration_required: null,
        external_url: externalLink || videoLink || null,
        contact_email,
        contact_phone,
        status: 'draft',
        creator_id: user.id,
      };

      const activeImages = gallery
        .filter((g) => g.status !== 'removed' && g.publicUrl && g.publicUrl.trim().length > 0)
        .slice(0, 3);
      const activeMedias = activeImages.map((g, index) => ({
        id: g.id,
        url: g.publicUrl,
        order: index,
      }));

      if (edit) {
        await EventsService.update(edit, payload as any);
        if ((EventsService as any).setMedia && activeMedias.length > 0) {
          await EventsService.setMedia(edit, activeMedias as any);
        }
      } else {
        const created = await EventsService.create(payload as any);
        if ((EventsService as any).setMedia && activeMedias.length > 0) {
          await EventsService.setMedia(created.id, activeMedias as any);
        }
      }

      resetStore();
      router.back();
    } catch (e) {
      console.warn('save draft', e);
      Alert.alert('Erreur', "Impossible d'enregistrer le brouillon pour le moment.");
    } finally {
      setSavingDraft(false);
    }
  }, [
    user,
    savingDraft,
    canSaveDraft,
    edit,
    existingStatus,
    title,
    description,
    category,
    subcategory,
    tags,
    startDate,
    endDate,
    location,
    visibility,
    price,
    coverImage,
    externalLink,
    videoLink,
    contact,
    gallery,
    resetStore,
    router,
  ]);

  const handleCancelCreation = useCallback(() => {
    resetStore();
    router.back();
  }, [resetStore, router]);

  const handleAttemptExit = useCallback(() => {
    if (savingDraft) return;
    Alert.alert("Quitter la création", "Souhaitez-vous sauvegarder un brouillon avant de quitter ?", [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Annuler la création', style: 'destructive', onPress: handleCancelCreation },
      { text: 'Sauvegarder le brouillon', onPress: handleSaveDraft },
    ]);
  }, [handleCancelCreation, handleSaveDraft, savingDraft]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleAttemptExit();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [handleAttemptExit])
  );

  if (isGuest) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppBackground opacity={0.2} />
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
      <AppBackground opacity={0.2} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleAttemptExit} accessibilityRole="button">
            <ChevronLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouvel évènement</Text>
          <TouchableOpacity
            style={[styles.headerBtn, styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
            disabled={!canProceed}
            accessibilityRole="button"
            onPress={() => {
              const dest = edit ? `/events/create/step-2?edit=${edit}` : '/events/create/step-2';
              router.push(dest as any);
            }}
          >
            <Text style={styles.nextText}>Suivant</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <CoverImageUploader />
          <AdditionalImagesUploader />
          <CreateEventForm
            onOpenLocation={() => setLocationModalVisible(true)}
            onValidate={setFormValid}
            onInputFocus={handleInputFocus}
            onInputRef={registerFieldRef}
          />
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
    backgroundColor: colors.background,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: 'transparent',
  },
  headerBtn: {
    minHeight: 44,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  headerTitle: {
    ...typography.subsection,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  nextBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 0,
    ...shadows.primaryGlow,
  },
  nextBtnDisabled: {
    opacity: 0.45,
  },
  nextText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '700',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
