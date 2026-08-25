import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Camera, ImageIcon, Sparkles } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { RequireEventSuggestAccess } from '@/components/identity/RequireEventSuggestAccess';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { useImagePicker } from '@/hooks/useImagePicker';
import { uploadAndExtractEventFromPoster } from '@/services/event-poster-extract.service';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import {
  applyPosterDraftToCreateStore,
  mapPosterExtractionToStoreDraft,
} from '@/utils/poster-extract-mapper';
import {
  isEventSubmissionSource,
  type EventSubmissionSource,
} from '@/types/event-submission';

function SuggestFromPosterContent() {
  const router = useRouter();
  const { source: sourceParam } = useLocalSearchParams<{ source?: string }>();
  const resolvedSource: EventSubmissionSource = isEventSubmissionSource(sourceParam)
    ? sourceParam
    : 'community_suggest';
  const { user } = useAuth();
  const { pickImage, takePhoto } = useImagePicker();
  const loadTaxonomy = useTaxonomyStore((s) => s.load);

  const resetStore = useCreateEventStore((s) => s.reset);
  const setSubmissionSource = useCreateEventStore((s) => s.setSubmissionSource);
  const setTitle = useCreateEventStore((s) => s.setTitle);
  const setDescription = useCreateEventStore((s) => s.setDescription);
  const setStartDate = useCreateEventStore((s) => s.setStartDate);
  const setEndDate = useCreateEventStore((s) => s.setEndDate);
  const setLocation = useCreateEventStore((s) => s.setLocation);
  const setCategory = useCreateEventStore((s) => s.setCategory);
  const setSubcategory = useCreateEventStore((s) => s.setSubcategory);
  const setTags = useCreateEventStore((s) => s.setTags);
  const setPrice = useCreateEventStore((s) => s.setPrice);
  const setContact = useCreateEventStore((s) => s.setContact);
  const setExternalLink = useCreateEventStore((s) => s.setExternalLink);
  const setCoverImage = useCreateEventStore((s) => s.setCoverImage);

  const [analyzing, setAnalyzing] = useState(false);

  const runAnalysis = useCallback(
    async (uri: string, mimeType?: string) => {
      if (!user?.id) return;

      setAnalyzing(true);
      try {
        await loadTaxonomy();
        const taxonomy = useTaxonomyStore.getState();

        const pipeline = await uploadAndExtractEventFromPoster(user.id, uri, mimeType);
        if (!pipeline.ok) {
          const { result } = pipeline;
          if (result.code === 'quota_exceeded') {
            Alert.alert('Limite atteinte', result.message, [
              {
                text: 'Saisie manuelle',
                onPress: () => {
                  resetStore();
                  setSubmissionSource(resolvedSource);
                  router.replace('/events/create');
                },
              },
              { text: 'OK', style: 'cancel' },
            ]);
            return;
          }

          Alert.alert('Analyse impossible', result.message, [
            { text: 'Réessayer', style: 'cancel' },
            {
              text: 'Saisie manuelle',
              onPress: () => {
                resetStore();
                setSubmissionSource(resolvedSource);
                if (pipeline.upload) {
                  setCoverImage({
                    storagePath: pipeline.upload.storagePath,
                    publicUrl: pipeline.upload.publicUrl,
                  });
                }
                router.replace('/events/create');
              },
            },
          ]);
          return;
        }

        const { upload, extraction } = pipeline;
        const { draft, summary } = await mapPosterExtractionToStoreDraft(extraction.fields, {
          categories: taxonomy.categories,
          subcategories: taxonomy.subcategories,
          tags: taxonomy.tags,
        });

        resetStore();
        setSubmissionSource(resolvedSource);
        applyPosterDraftToCreateStore(
          draft,
          {
            setTitle,
            setDescription,
            setStartDate,
            setEndDate,
            setLocation,
            setCategory,
            setSubcategory,
            setTags,
            setPrice,
            setContact,
            setExternalLink,
            setCoverImage,
          },
          upload,
        );

        if (summary.uncertainFields.length) {
          Toast.show({
            type: 'info',
            text1: 'Vérifie les champs préremplis',
            text2: 'Certaines infos ont été détectées avec une confiance moyenne.',
          });
        }

        if (extraction.warnings?.length) {
          Toast.show({
            type: 'info',
            text1: extraction.warnings[0],
          });
        }

        router.replace('/events/create');
      } catch (err) {
        console.warn('[suggest-from-poster]', err);
        Alert.alert(
          'Erreur',
          'Analyse indisponible. Tu peux saisir l’événement manuellement.',
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Saisie manuelle',
              onPress: () => {
                resetStore();
                setSubmissionSource(resolvedSource);
                router.replace('/events/create');
              },
            },
          ],
        );
      } finally {
        setAnalyzing(false);
      }
    },
    [
      user?.id,
      loadTaxonomy,
      resetStore,
      setTitle,
      setDescription,
      setStartDate,
      setEndDate,
      setLocation,
      setCategory,
      setSubcategory,
      setTags,
      setPrice,
      setContact,
      setExternalLink,
      setCoverImage,
      setSubmissionSource,
      resolvedSource,
      router,
    ],
  );

  const onPickGallery = async () => {
    const asset = await pickImage({ allowsEditing: false });
    if (asset?.uri) await runAnalysis(asset.uri, asset.mimeType);
  };

  const onTakePhoto = async () => {
    const asset = await takePhoto({ allowsEditing: false });
    if (asset?.uri) await runAnalysis(asset.uri, asset.mimeType);
  };

  const onManual = () => {
    resetStore();
    setSubmissionSource(resolvedSource);
    router.replace('/events/create');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Sparkles size={32} color={colors.brand.secondary} />
          <Text style={styles.title}>
            {resolvedSource === 'organizer_create' ? 'Scanner une affiche' : 'Proposer depuis une affiche'}
          </Text>
          <Text style={styles.subtitle}>
            Photographie ou importe une affiche, un flyer ou une capture d’écran. L’IA préremplit le
            formulaire — tu vérifies avant de publier.
          </Text>
        </View>

        {analyzing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.brand.secondary} />
            <Text style={styles.loadingText}>Analyse en cours…</Text>
          </View>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={onTakePhoto} accessibilityRole="button">
              <Camera size={20} color={colors.neutral[0]} />
              <Text style={styles.primaryBtnText}>Prendre une photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={onPickGallery} accessibilityRole="button">
              <ImageIcon size={20} color={colors.brand.secondary} />
              <Text style={styles.secondaryBtnText}>Choisir dans la galerie</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={onManual} accessibilityRole="button">
              <Text style={styles.linkBtnText}>Saisir manuellement sans IA</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function SuggestFromPosterScreen() {
  return (
    <RequireEventSuggestAccess>
      <SuggestFromPosterContent />
    </RequireEventSuggestAccess>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.brand.page,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  title: {
    ...typography.h2,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[600],
  },
  loadingBox: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.neutral[600],
  },
  actions: {
    gap: spacing.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  primaryBtnText: {
    ...typography.h6,
    color: colors.neutral[0],
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brand.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  secondaryBtnText: {
    ...typography.h6,
    color: colors.brand.secondary,
  },
  linkBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  linkBtnText: {
    ...typography.body,
    color: colors.neutral[600],
    textDecorationLine: 'underline',
  },
});
