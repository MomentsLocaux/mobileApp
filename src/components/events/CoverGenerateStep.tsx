import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { CoverImageUploader } from '@/components/events/CoverImageUploader';
import { StagedProgressCard } from '@/components/events/StagedProgressCard';
import { useCreateEventStore, type CoverImage } from '@/hooks/useCreateEventStore';
import { useAuth } from '@/hooks';
import { generateEventCover } from '@/services/event-cover-generate.service';
import { getCategoryLabel } from '@/constants/categories';
import {
  COVER_TONES,
  COVER_TONE_LABELS,
  defaultCoverToneForCategorySlug,
  type CoverTone,
} from '@/constants/cover-tone';
import {
  EVENT_COVER_GENERATE_MAX_TRIES,
  canGenerateEventCover,
  remainingCoverGenerations,
} from '@/constants/cover-generate-quota';
import { coverGenerateSteps, type CoverGenerateStepId } from '@/utils/cover-generate-progress';
import { useTaxonomyStore } from '@/store/taxonomyStore';

function confirmGenerate(hasPhoto: boolean, remaining: number): Promise<boolean> {
  const tries = remaining === 1 ? 'C’est ta dernière génération pour cet événement.' : `Tu as ${remaining} essais pour cet événement.`;
  const body = hasPhoto
    ? `La couverture s’appuie sur ta photo et sur la fiche (titre, lieu, catégorie, description). Relis-les avant de lancer. ${tries} La photo est envoyée temporairement à OpenAI, sans servir à entraîner un modèle.`
    : `La couverture s’appuie sur le titre, le lieu, la catégorie et la description. Relis-les avant de lancer. ${tries}`;
  return new Promise((resolve) => {
    Alert.alert('Vérifier les infos ?', body, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Générer', onPress: () => resolve(true) },
    ]);
  });
}

function CoverCandidateRow({
  candidates,
  selectedPath,
  onSelect,
}: {
  candidates: CoverImage[];
  selectedPath?: string;
  onSelect: (img: CoverImage) => void;
}) {
  return (
    <View style={styles.candidates}>
      <Text style={styles.toneLabel}>Tes propositions</Text>
      <Text style={styles.toneHelp}>
        {candidates.length >= EVENT_COVER_GENERATE_MAX_TRIES
          ? 'Choisis celle que tu préfères, ou remplace par une photo.'
          : 'Génère une 2e image, puis choisis.'}
      </Text>
      <View style={styles.candidateRow}>
        {candidates.map((candidate, index) => {
          const selected = candidate.storagePath === selectedPath || candidate.publicUrl === selectedPath;
          return (
            <TouchableOpacity
              key={candidate.storagePath || candidate.publicUrl}
              style={[styles.candidateCard, selected && styles.candidateCardSelected]}
              onPress={() => onSelect(candidate)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Proposition ${index + 1}${selected ? ', sélectionnée' : ''}`}
            >
              <Image source={{ uri: candidate.publicUrl }} style={styles.candidateImage} />
              <Text style={[styles.candidateLabel, selected && styles.candidateLabelSelected]}>
                {selected ? `Choisie · ${index + 1}` : `Proposition ${index + 1}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export const CoverGenerateStep = () => {
  const { user } = useAuth();
  const coverImage = useCreateEventStore((s) => s.coverImage);
  const userReferenceCover = useCreateEventStore((s) => s.userReferenceCover);
  const coverOrigin = useCreateEventStore((s) => s.coverOrigin);
  const coverDraftId = useCreateEventStore((s) => s.coverDraftId);
  const aiCoverCandidates = useCreateEventStore((s) => s.aiCoverCandidates);
  const addAiCoverCandidate = useCreateEventStore((s) => s.addAiCoverCandidate);
  const selectAiCoverCandidate = useCreateEventStore((s) => s.selectAiCoverCandidate);
  const title = useCreateEventStore((s) => s.title);
  const description = useCreateEventStore((s) => s.description);
  const category = useCreateEventStore((s) => s.category);
  const subcategory = useCreateEventStore((s) => s.subcategory);
  const tags = useCreateEventStore((s) => s.tags);
  const location = useCreateEventStore((s) => s.location);
  const categoriesMap = useTaxonomyStore((s) => s.categoriesMap);
  const subcategoriesMap = useTaxonomyStore((s) => s.subcategoriesMap);
  const tagsMap = useTaxonomyStore((s) => s.tagsMap);

  const categorySlug = category ? categoriesMap[category]?.slug ?? category : undefined;
  const [tone, setTone] = useState<CoverTone>(() => defaultCoverToneForCategorySlug(categorySlug));
  const [toneTouched, setToneTouched] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState<CoverGenerateStepId>('fiche');
  const [progressComplete, setProgressComplete] = useState(false);
  const progressLockedRef = useRef(false);

  const generatedCount = aiCoverCandidates.length;
  const remaining = remainingCoverGenerations(generatedCount);
  const canGenerate = canGenerateEventCover(generatedCount);

  useEffect(() => {
    if (!toneTouched) {
      setTone(defaultCoverToneForCategorySlug(categorySlug));
    }
  }, [categorySlug, toneTouched]);

  const statusText = useMemo(() => {
    if (generatedCount >= EVENT_COVER_GENERATE_MAX_TRIES) {
      return 'Tu as tes 2 propositions. Choisis-en une, ou remplace par une photo.';
    }
    if (generatedCount === 1) {
      return 'Tu peux générer une 2e proposition, puis choisir.';
    }
    if (coverOrigin === 'user' || coverImage) {
      return 'Tu as déjà une photo. Tu peux la garder, la remplacer, ou en générer une (2 essais).';
    }
    return 'Ajoute une photo, ou génère-en une à partir de ta fiche (2 essais max).';
  }, [coverImage, coverOrigin, generatedCount]);

  const generateLabel =
    generatedCount === 0 ? 'Générer une couverture' : 'Générer une 2e proposition';
  const hasReference = Boolean(userReferenceCover?.storagePath || userReferenceCover?.publicUrl);
  const progressSteps = useMemo(() => coverGenerateSteps(hasReference), [hasReference]);

  useEffect(() => {
    if (!generating) return undefined;
    progressLockedRef.current = false;
    setProgressComplete(false);
    setProgressStep('fiche');
    const advance = (next: CoverGenerateStepId) => {
      if (!progressLockedRef.current) setProgressStep(next);
    };
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (hasReference) {
      timers.push(setTimeout(() => advance('photo'), 900));
      timers.push(setTimeout(() => advance('image'), 2200));
    } else {
      timers.push(setTimeout(() => advance('image'), 900));
    }
    return () => timers.forEach(clearTimeout);
  }, [generating, hasReference]);

  const onGenerate = async () => {
    if (!user?.id) {
      Alert.alert('Connexion requise', 'Tu dois être connecté pour générer une couverture.');
      return;
    }
    if (!canGenerate) {
      Alert.alert(
        'Limite atteinte',
        'Tu as déjà 2 propositions pour cet événement. Choisis-en une, ou ajoute une photo.',
      );
      return;
    }
    if (!title.trim()) {
      Alert.alert('Titre requis', 'Ajoute un titre avant de générer une couverture.');
      return;
    }
    const confirmed = await confirmGenerate(hasReference, remaining);
    if (!confirmed) return;

    setGenerating(true);
    try {
      const tagLabels = tags.map((tag) => tagsMap[tag]?.label).filter((label): label is string => Boolean(label));
      const result = await generateEventCover({
        title: title.trim(),
        description,
        categoryLabel: category ? getCategoryLabel(category) : null,
        subcategoryLabel: subcategory ? subcategoriesMap[subcategory]?.label || subcategory : null,
        city: location?.city || location?.addressLabel || null,
        tags: tagLabels,
        tone,
        referencePath: userReferenceCover?.storagePath || userReferenceCover?.publicUrl || null,
        draftId: coverDraftId,
      });
      if (!result.ok) {
        Alert.alert(
          result.code === 'quota_exceeded' ? 'Limite atteinte' : 'Génération impossible',
          result.message,
        );
        return;
      }
      setProgressStep('save');
      progressLockedRef.current = true;
      addAiCoverCandidate({ storagePath: result.storage_path, publicUrl: result.cover_url });
      setProgressComplete(true);
      await new Promise((resolve) => setTimeout(resolve, 700));
    } catch (e) {
      console.warn('generate cover', e);
      Alert.alert('Génération impossible', 'Réessaie, ou ajoute une photo.');
    } finally {
      setGenerating(false);
      setProgressComplete(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <CoverImageUploader />
      <Text style={styles.status}>{statusText}</Text>

      {aiCoverCandidates.length > 0 && !generating ? (
        <CoverCandidateRow
          candidates={aiCoverCandidates}
          selectedPath={coverImage?.storagePath || coverImage?.publicUrl}
          onSelect={selectAiCoverCandidate}
        />
      ) : null}

      {generating ? (
        <StagedProgressCard
          steps={progressSteps}
          stepId={progressStep}
          complete={progressComplete}
          spinnerLabel="Génération en cours"
          readyCaption="C’est prêt"
          accessibilityPrefix="Génération de la couverture"
          easeTauMs={12000}
        />
      ) : canGenerate ? (
        <>
          <Text style={styles.toneLabel}>Ton de l’image</Text>
          <Text style={styles.toneHelp}>On part de ta catégorie. Tu peux l’ajuster.</Text>
          <View style={styles.chips}>
            {COVER_TONES.map((value) => {
              const selected = value === tone;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => {
                    setToneTouched(true);
                    setTone(value);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={COVER_TONE_LABELS[value]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {COVER_TONE_LABELS[value]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.generateBtn}
            onPress={() => void onGenerate()}
            accessibilityRole="button"
            accessibilityLabel={generateLabel}
          >
            <Sparkles size={16} color={colors.brand.onAccent} />
            <Text style={styles.generateText}>{generateLabel}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.quotaHint}>Limite : {EVENT_COVER_GENERATE_MAX_TRIES} essais par événement.</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  status: {
    ...typography.body,
    color: colors.brand.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  candidates: {
    marginBottom: spacing.lg,
  },
  candidateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  candidateCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.brand.surface,
    borderWidth: 2,
    borderColor: 'rgba(26, 51, 41, 0.12)',
  },
  candidateCardSelected: {
    borderColor: colors.brand.secondary,
  },
  candidateImage: {
    width: '100%',
    height: 110,
    backgroundColor: colors.brand.surfaceMuted,
  },
  candidateLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  candidateLabelSelected: {
    color: colors.brand.secondary,
  },
  toneLabel: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  toneHelp: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
  },
  chipSelected: {
    backgroundColor: colors.brand.secondary,
    borderColor: colors.brand.secondary,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: colors.brand.onAccent,
  },
  generateBtn: {
    alignSelf: 'center',
    backgroundColor: colors.brand.secondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  generateText: {
    ...typography.bodySmall,
    color: colors.brand.onAccent,
    fontWeight: '700',
  },
  quotaHint: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
});
