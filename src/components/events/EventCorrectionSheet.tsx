import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronRight, Copy, MapPin, Pencil, X } from 'lucide-react-native';
import { CategorySelector } from '@/components/events/CategorySelector';
import { EventScheduleEditor } from '@/components/events/EventScheduleEditor';
import { LocationPickerModal } from '@/components/events/LocationPickerModal';
import { FloatingPressable } from '@/components/ui/FloatingPressable';
import { features } from '@/config/features';
import { Motion } from '@/constants/motion';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { EventLocation } from '@/hooks/useCreateEventStore';
import { EventCorrectionService } from '@/services/event-correction.service';
import { EventsService } from '@/services/events.service';
import { invalidateMySuggestionHistory } from '@/services/suggestion-history.service';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import type { EventWithCreator } from '@/types/database';
import { EVENT_CORRECTION_DAILY_QUOTA } from '@/types/event-correction';
import {
  distinctiveTitleQuery,
  DUPLICATE_CANDIDATE_FETCH_LIMIT,
  DUPLICATE_CANDIDATE_RADIUS_KM,
  hasDuplicateSearchOrigin,
  rankDuplicateCandidates,
  type RankedDuplicateCandidate,
} from '@/utils/duplicate-candidates';
import { getEventCardSchedule } from '@/utils/event-card-meta';
import {
  baselineCorrectionFields,
  buildDuplicateCorrectionComment,
  buildFieldCorrectionComment,
  changedCorrectionGroupIds,
  changedCorrectionGroupLabels,
  diffCorrectionFields,
  eventLocationFromEvent,
  formatCorrectionQuotaLabel,
  proposedCorrectionFields,
} from '@/utils/event-correction';
import { scheduleDraftFromEvent, validateEventSchedule, type EventScheduleDraft } from '@/utils/event-schedule';
import { haptics } from '@/utils/haptics';
import { getBoundsFromRadiusKm } from '@/utils/search-helpers';

type DuplicateLoadStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unavailable';

type Step = 'kind' | 'field_correction' | 'duplicate';

type Props = {
  visible: boolean;
  event: EventWithCreator;
  onClose: () => void;
};

const correctionErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Impossible d’envoyer la proposition.';
  if (message.includes('QUOTA')) {
    return `Tu as atteint la limite du jour (${EVENT_CORRECTION_DAILY_QUOTA} propositions).`;
  }
  if (message.includes('EVENT_CORRECTION_CATEGORY')) {
    return 'Cette catégorie n’est pas reconnue. Choisis-en une dans la liste.';
  }
  if (message.includes('EVENT_CORRECTION_SUBCATEGORY')) {
    return 'Cette sous-catégorie ne correspond pas à la catégorie choisie.';
  }
  if (message.includes('EVENT_CORRECTION_FIELD_NOT_ALLOWED')) {
    return 'Ce type de correction n’est pas encore disponible. Réessaie après la prochaine mise à jour.';
  }
  return message;
};

export function EventCorrectionSheet({ visible, event, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const categoriesMap = useTaxonomyStore((s) => s.categoriesMap);
  const subcategoriesMap = useTaxonomyStore((s) => s.subcategoriesMap);

  const [step, setStep] = useState<Step>('kind');
  const [schedule, setSchedule] = useState<EventScheduleDraft>(() => scheduleDraftFromEvent(event));
  const [location, setLocation] = useState<EventLocation | undefined>(() => eventLocationFromEvent(event));
  const [venueName, setVenueName] = useState(event.venue_name || '');
  const [isFree, setIsFree] = useState(Boolean(event.is_free));
  const [price, setPrice] = useState(event.price == null ? '' : String(event.price));
  const [category, setCategory] = useState(event.category || '');
  const [subcategory, setSubcategory] = useState(event.subcategory || '');
  const [comment, setComment] = useState('');
  const [sourceHint, setSourceHint] = useState('');
  const [duplicateHint, setDuplicateHint] = useState('');
  const [duplicateOfEventId, setDuplicateOfEventId] = useState('');
  const [showAdvancedDuplicate, setShowAdvancedDuplicate] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<RankedDuplicateCandidate[]>([]);
  const [duplicateLoadStatus, setDuplicateLoadStatus] = useState<DuplicateLoadStatus>('idle');
  const [locationOpen, setLocationOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quotaUsed, setQuotaUsed] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) {
      progress.value = 0;
      setStep('kind');
      setDuplicateCandidates([]);
      setDuplicateLoadStatus('idle');
      return;
    }
    setStep('kind');
    setSchedule(scheduleDraftFromEvent(event));
    setLocation(eventLocationFromEvent(event));
    setVenueName(event.venue_name || '');
    setIsFree(Boolean(event.is_free));
    setPrice(event.price == null ? '' : String(event.price));
    setCategory(event.category || '');
    setSubcategory(event.subcategory || '');
    setComment('');
    setSourceHint('');
    setDuplicateHint('');
    setDuplicateOfEventId('');
    setShowAdvancedDuplicate(false);
    setDuplicateCandidates([]);
    setDuplicateLoadStatus('idle');
    setLocationOpen(false);
    setSubmitting(false);
    setQuotaUsed(null);
    progress.value = reduceMotion ? 1 : withSpring(1, Motion.spring.sheet);
  }, [visible, event, progress, reduceMotion]);

  useEffect(() => {
    if (!visible || step !== 'duplicate') return;

    if (!hasDuplicateSearchOrigin(event)) {
      setDuplicateCandidates([]);
      setDuplicateLoadStatus('unavailable');
      return;
    }

    let cancelled = false;
    setDuplicateLoadStatus('loading');
    setDuplicateCandidates([]);

    const lat = Number(event.latitude);
    const lng = Number(event.longitude);
    const nameQuery = distinctiveTitleQuery(event.title);

    EventsService.listEvents({
      bbox: getBoundsFromRadiusKm(lat, lng, DUPLICATE_CANDIDATE_RADIUS_KM),
      ...(nameQuery ? { nameQuery } : {}),
      timeScope: 'all',
      limit: DUPLICATE_CANDIDATE_FETCH_LIMIT,
    })
      .then((events) => {
        if (cancelled) return;
        const ranked = rankDuplicateCandidates(
          { id: event.id, title: event.title, latitude: lat, longitude: lng },
          events,
        );
        setDuplicateCandidates(ranked);
        setDuplicateLoadStatus(ranked.length > 0 ? 'ready' : 'empty');
      })
      .catch(() => {
        if (cancelled) return;
        setDuplicateCandidates([]);
        setDuplicateLoadStatus('error');
      });

    return () => {
      cancelled = true;
    };
    // Ranking inputs only — parent often passes a new `event` object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- event identity is unstable
  }, [visible, step, event.id, event.title, event.latitude, event.longitude]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    EventCorrectionService.countMineToday()
      .then((quota) => {
        if (!cancelled) setQuotaUsed(quota.used);
      })
      .catch(() => {
        if (!cancelled) setQuotaUsed(null);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 40 }],
    opacity: 0.94 + progress.value * 0.06,
  }));

  const closeAnimated = () => {
    if (reduceMotion) {
      onClose();
      return;
    }
    progress.value = withTiming(0, {
      duration: Motion.duration.fast,
      easing: Motion.easing.exit,
    });
    setTimeout(onClose, Motion.duration.fast);
  };

  const baseline = useMemo(() => baselineCorrectionFields(event, scheduleDraftFromEvent(event)), [event]);
  const proposed = useMemo(
    () =>
      proposedCorrectionFields({
        schedule,
        location,
        venueName,
        isFree,
        price,
        category,
        subcategory,
      }),
    [category, isFree, location, price, schedule, subcategory, venueName],
  );
  const fieldDiff = useMemo(() => diffCorrectionFields(baseline, proposed), [baseline, proposed]);
  const changedCount = Object.keys(fieldDiff).length;
  const groupIds = useMemo(() => changedCorrectionGroupIds(fieldDiff), [fieldDiff]);
  const changedGroups = useMemo(() => changedCorrectionGroupLabels(fieldDiff), [fieldDiff]);
  const generatedComment = useMemo(
    () =>
      buildFieldCorrectionComment({
        diff: fieldDiff,
        baseline,
        labels: {
          category: (id) => (id ? categoriesMap[id]?.label || id : 'non renseignée'),
          subcategory: (id) => (id ? subcategoriesMap[id]?.label || id : 'aucune'),
        },
      }),
    [baseline, categoriesMap, fieldDiff, subcategoriesMap],
  );

  const scheduleValidation = useMemo(
    () =>
      validateEventSchedule({
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        mode: schedule.scheduleMode,
        fixedSlots: schedule.scheduleFixedSlots,
        openDays: schedule.scheduleOpenDays,
        variableSchedules: schedule.scheduleVariableDays,
      }),
    [schedule],
  );

  const quotaReached = quotaUsed != null && quotaUsed >= EVENT_CORRECTION_DAILY_QUOTA;
  const quotaLabel = quotaUsed == null ? null : formatCorrectionQuotaLabel(quotaUsed);

  const title =
    step === 'kind'
      ? 'Proposer une correction'
      : step === 'field_correction'
        ? 'Corriger des infos'
        : 'Signaler un doublon';

  const subtitle =
    step === 'kind'
      ? 'Améliore le catalogue sans modifier directement la fiche.'
      : step === 'field_correction'
        ? 'Tu peux corriger les dates, le lieu, la catégorie ou le tarif. La justification est générée automatiquement.'
        : 'Choisis une fiche proche si tu la vois, ou décris le doublon. Un modérateur vérifiera.';

  const groupChanged = (id: 'schedule' | 'place' | 'category' | 'price') => groupIds.includes(id);

  const submitFieldCorrection = async () => {
    if (quotaReached) {
      Alert.alert(
        'Limite atteinte',
        `Tu as atteint la limite du jour (${EVENT_CORRECTION_DAILY_QUOTA} propositions).`,
      );
      return;
    }
    if (changedCount === 0) {
      Alert.alert('Rien à envoyer', 'Modifie au moins un champ avant de proposer.');
      return;
    }
    if (!scheduleValidation.valid) {
      Alert.alert('Horaires incomplets', scheduleValidation.message);
      return;
    }
    if (generatedComment.length < 3) {
      Alert.alert('Correction incomplète', 'Les modifications n’ont pas pu être résumées. Réessaie.');
      return;
    }

    setSubmitting(true);
    try {
      await EventCorrectionService.create({
        eventId: event.id,
        kind: 'field_correction',
        proposedFields: fieldDiff,
        comment: generatedComment,
        sourceHint: sourceHint.trim() || null,
      });
      setQuotaUsed((current) => (current == null ? current : current + 1));
      invalidateMySuggestionHistory();
      haptics.success();
      closeAnimated();
      const lumoHint = features.gamification
        ? '\n\nTu pourras gagner des Lumo si ta correction est validée.'
        : '';
      Alert.alert('Merci', `Ta proposition sera vérifiée.${lumoHint}`);
    } catch (error) {
      Alert.alert('Erreur', correctionErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const selectDuplicateCandidate = (candidate: RankedDuplicateCandidate) => {
    haptics.selection();
    if (duplicateOfEventId === candidate.id) {
      setDuplicateOfEventId('');
      return;
    }
    setDuplicateOfEventId(candidate.id);
    const title = candidate.title?.trim();
    if (title) setDuplicateHint(title);
  };

  const submitDuplicate = async () => {
    if (quotaReached) {
      Alert.alert(
        'Limite atteinte',
        `Tu as atteint la limite du jour (${EVENT_CORRECTION_DAILY_QUOTA} propositions).`,
      );
      return;
    }
    if (comment.trim().length < 3) {
      Alert.alert('Commentaire requis', 'Explique pourquoi c’est un doublon (min. 3 caractères).');
      return;
    }

    const otherId = duplicateOfEventId.trim();
    if (otherId && otherId === event.id) {
      Alert.alert('Doublon invalide', 'Choisis une autre fiche que celle-ci.');
      return;
    }

    setSubmitting(true);
    try {
      await EventCorrectionService.create({
        eventId: event.id,
        kind: 'duplicate',
        comment: buildDuplicateCorrectionComment({
          comment,
          sourceEventId: event.id,
          duplicateEventId: otherId || null,
        }),
        duplicateOfEventId: otherId || null,
        duplicateHint: duplicateHint.trim() || null,
        sourceHint: sourceHint.trim() || null,
      });
      setQuotaUsed((current) => (current == null ? current : current + 1));
      invalidateMySuggestionHistory();
      haptics.success();
      closeAnimated();
      const lumoHint = features.gamification
        ? '\n\nTu pourras gagner des Lumo si ta contribution est validée.'
        : '';
      Alert.alert('Merci', `Ta proposition sera vérifiée.${lumoHint}`);
    } catch (error) {
      Alert.alert('Erreur', correctionErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={closeAnimated}
      presentationStyle="overFullScreen"
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.backdropWrap, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAnimated} accessibilityLabel="Fermer">
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.androidDim]} />
            )}
            <View style={styles.backdropTint} />
          </Pressable>
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm },
          ]}
        >
          <View style={styles.handleRow}>
            <View style={styles.handle} />
            <FloatingPressable
              onPress={closeAnimated}
              accessibilityLabel="Fermer"
              style={styles.closeBtn}
            >
              <X size={18} color={colors.brand.textSecondary} />
            </FloatingPressable>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {quotaLabel ? (
            <Text
              style={[styles.quotaLabel, quotaReached && styles.quotaLabelReached]}
              accessibilityLabel={quotaLabel}
            >
              {quotaLabel}
              {quotaReached ? ' — limite atteinte' : ''}
            </Text>
          ) : null}

          {step === 'kind' ? (
            <View style={styles.options}>
              <OptionRow
                icon={Pencil}
                title="Corriger des infos"
                subtitle="Date et horaires, lieu, catégorie, tarif"
                onPress={() => {
                  haptics.selection();
                  setStep('field_correction');
                }}
              />
              <OptionRow
                icon={Copy}
                title="Événement en doublon"
                subtitle="Cette fiche existe déjà ailleurs"
                onPress={() => {
                  haptics.selection();
                  setStep('duplicate');
                }}
              />
            </View>
          ) : (
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {step === 'field_correction' ? (
                <>
                  <SectionTitle>Date et horaires</SectionTitle>
                  <EventScheduleEditor
                    value={schedule}
                    onChange={setSchedule}
                    changed={groupChanged('schedule')}
                  />

                  <SectionTitle>Lieu</SectionTitle>
                  <TouchableOpacity
                    style={[styles.placePill, groupChanged('place') && styles.changedCard]}
                    onPress={() => {
                      haptics.selection();
                      setLocationOpen(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Choisir un lieu"
                  >
                    <MapPin size={16} color={colors.brand.secondary} />
                    <Text style={styles.placePillText}>
                      {location?.addressLabel || 'Rechercher une adresse'}
                    </Text>
                    <ChevronRight size={18} color={colors.brand.textSecondary} />
                  </TouchableOpacity>
                  {location?.city || location?.postalCode ? (
                    <Text style={styles.geocodeHint}>
                      {[location.postalCode, location.city].filter(Boolean).join(' · ')}
                    </Text>
                  ) : (
                    <Text style={styles.geocodeHint}>
                      La recherche et le pin sur la carte remplissent ville et code postal.
                    </Text>
                  )}
                  <Field
                    label="Nom du lieu"
                    value={venueName}
                    onChangeText={setVenueName}
                    changed={'venue_name' in fieldDiff}
                    placeholder="Salle, parc, café…"
                  />

                  <SectionTitle>Catégorie</SectionTitle>
                  <View
                    style={[
                      styles.taxonomyWrap,
                      groupChanged('category') && styles.changedCard,
                    ]}
                  >
                    <CategorySelector
                      selected={category || undefined}
                      subcategory={subcategory || undefined}
                      onSelect={(value) => {
                        setCategory(value);
                        setSubcategory('');
                      }}
                      onSelectSubcategory={(value) => setSubcategory(value || '')}
                    />
                  </View>

                  <SectionTitle>Tarif</SectionTitle>
                  <View style={[styles.switchRow, groupChanged('price') && styles.changedCard]}>
                    <Text style={styles.fieldLabel}>
                      Gratuit{groupChanged('price') ? ' · modifié' : ''}
                    </Text>
                    <Switch
                      value={isFree}
                      onValueChange={setIsFree}
                      trackColor={{ false: colors.neutral[300], true: 'rgba(124, 181, 24, 0.55)' }}
                      thumbColor={isFree ? colors.brand.secondary : colors.neutral[100]}
                    />
                  </View>
                  {!isFree ? (
                    <Field
                      label="Prix (€)"
                      value={price}
                      onChangeText={(v) => setPrice(v.replace(',', '.').replace(/[^0-9.]/g, ''))}
                      keyboardType="decimal-pad"
                      changed={'price' in fieldDiff}
                    />
                  ) : null}

                  {changedCount > 0 ? (
                    <View style={styles.diffBox}>
                      <Text style={styles.diffTitle}>
                        {changedGroups.length} modification{changedGroups.length > 1 ? 's' : ''} proposée
                        {changedGroups.length > 1 ? 's' : ''}
                      </Text>
                      <View style={styles.chipRow}>
                        {changedGroups.map((label) => (
                          <View key={label} style={styles.chip}>
                            <Text style={styles.chipText}>{label}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.generatedComment}>{generatedComment}</Text>
                    </View>
                  ) : (
                    <Text style={styles.diffHint}>Aucun champ modifié pour l’instant.</Text>
                  )}
                </>
              ) : (
                <>
                  <SectionTitle>Fiches proches</SectionTitle>
                  {duplicateLoadStatus === 'loading' || duplicateLoadStatus === 'idle' ? (
                    <View style={styles.duplicateStatus}>
                      <ActivityIndicator color={colors.brand.secondary} />
                      <Text style={styles.duplicateStatusText}>Recherche d’événements proches…</Text>
                    </View>
                  ) : null}
                  {duplicateLoadStatus === 'unavailable' ? (
                    <Text style={styles.duplicateStatusText}>
                      Cette fiche n’a pas de lieu exploitable. Décris le doublon dans le commentaire.
                    </Text>
                  ) : null}
                  {duplicateLoadStatus === 'error' ? (
                    <Text style={styles.duplicateStatusText}>
                      Impossible de charger les fiches proches. Tu peux quand même décrire le doublon.
                    </Text>
                  ) : null}
                  {duplicateLoadStatus === 'empty' ? (
                    <Text style={styles.duplicateStatusText}>
                      Aucun événement proche au titre similaire. Décris-le dans le commentaire, ou saisis
                      l’identifiant si tu l’as.
                    </Text>
                  ) : null}
                  {duplicateLoadStatus === 'ready'
                    ? duplicateCandidates.map((candidate) => (
                        <DuplicateCandidateRow
                          key={candidate.id}
                          candidate={candidate}
                          selected={duplicateOfEventId === candidate.id}
                          onPress={() => selectDuplicateCandidate(candidate)}
                        />
                      ))
                    : null}

                  <Field
                    label="Référence (titre, lieu, lien…)"
                    value={duplicateHint}
                    onChangeText={setDuplicateHint}
                    placeholder="Ex. même concert déjà publié sous un autre nom"
                    multiline
                  />
                  <TouchableOpacity
                    onPress={() => setShowAdvancedDuplicate((v) => !v)}
                    style={styles.advancedToggle}
                    accessibilityRole="button"
                  >
                    <Text style={styles.advancedToggleText}>
                      {showAdvancedDuplicate
                        ? 'Masquer l’identifiant technique'
                        : 'J’ai l’identifiant de l’autre fiche'}
                    </Text>
                  </TouchableOpacity>
                  {showAdvancedDuplicate ? (
                    <Field
                      label="Identifiant (UUID, optionnel)"
                      value={duplicateOfEventId}
                      onChangeText={setDuplicateOfEventId}
                      autoCapitalize="none"
                      placeholder="UUID de l’autre événement"
                    />
                  ) : null}
                  <SectionTitle>Justification</SectionTitle>
                  <Field
                    label="Commentaire (obligatoire)"
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    placeholder="Pourquoi cette fiche est un doublon ?"
                  />
                </>
              )}

              <Field
                label="Source (optionnel)"
                value={sourceHint}
                onChangeText={setSourceHint}
                placeholder="Lien OT, affiche, site…"
              />

              {features.gamification ? (
                <Text style={styles.lumoHint}>
                  Tu pourras gagner des Lumo si ta contribution est validée.
                </Text>
              ) : null}

              <TouchableOpacity
                style={[styles.submitBtn, (submitting || quotaReached) && styles.submitBtnDisabled]}
                onPress={step === 'field_correction' ? submitFieldCorrection : submitDuplicate}
                disabled={submitting || quotaReached}
                accessibilityRole="button"
                accessibilityLabel="Envoyer la proposition"
              >
                {submitting ? (
                  <ActivityIndicator color={colors.brand.onAccent} />
                ) : (
                  <Text style={styles.submitLabel}>Envoyer</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setStep('kind')}
                style={styles.backLink}
                accessibilityRole="button"
              >
                <Text style={styles.backLinkText}>← Changer de type</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>
        <LocationPickerModal
          embedded
          visible={locationOpen}
          onClose={() => setLocationOpen(false)}
          location={location || null}
          categoryId={category || null}
          onConfirmLocation={(next) => {
            setLocation(next);
            setLocationOpen(false);
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function OptionRow({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: typeof Pencil;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.option}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.optionIcon}>
        <Icon size={20} color={colors.brand.secondary} />
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={18} color={colors.brand.textSecondary} />
    </TouchableOpacity>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  placeholder,
  autoCapitalize,
  keyboardType,
  changed,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'decimal-pad';
  changed?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {changed ? ' · modifié' : ''}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, changed && styles.changedCard]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.brand.textSecondary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        autoCapitalize={autoCapitalize || 'sentences'}
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );
}

function DuplicateCandidateRow({
  candidate,
  selected,
  onPress,
}: {
  candidate: RankedDuplicateCandidate;
  selected: boolean;
  onPress: () => void;
}) {
  const cover =
    typeof candidate.cover_url === 'string' && candidate.cover_url.trim()
      ? candidate.cover_url.trim()
      : null;
  const schedule = getEventCardSchedule(candidate, 'compact');
  const city = candidate.city?.trim() || schedule.city;
  const meta = [city, schedule.start].filter(Boolean).join(' · ');
  const title = candidate.title?.trim() || 'Événement sans titre';

  return (
    <TouchableOpacity
      style={[styles.candidateRow, selected && styles.candidateRowSelected]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={styles.candidateCover} />
      ) : (
        <View style={[styles.candidateCover, styles.candidateCoverFallback]}>
          <Copy size={16} color={colors.brand.secondary} />
        </View>
      )}
      <View style={styles.candidateText}>
        <Text style={styles.candidateTitle} numberOfLines={2}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.candidateMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {selected ? <Check size={18} color={colors.brand.secondary} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  androidDim: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 25, 0.35)',
  },
  sheet: {
    backgroundColor: colors.brand.page,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.08)',
    maxHeight: '92%',
  },
  handleRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 51, 41, 0.2)',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: -4,
    padding: spacing.sm,
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.sm,
  },
  quotaLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  quotaLabelReached: {
    color: colors.warning[700],
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
    backgroundColor: colors.brand.surface,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 181, 24, 0.12)',
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.brand.text,
  },
  optionSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  formScroll: {
    maxHeight: 520,
  },
  formContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.brand.textSecondary,
    marginTop: spacing.xs,
  },
  field: {
    gap: 6,
  },
  taxonomyWrap: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
    backgroundColor: colors.brand.surface,
  },
  fieldLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.brand.textSecondary,
  },
  input: {
    ...typography.bodySmall,
    color: colors.brand.text,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  inputMultiline: {
    minHeight: 88,
    paddingTop: spacing.sm,
  },
  placePill: {
    minHeight: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
    backgroundColor: colors.brand.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  placePillText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    flex: 1,
    fontWeight: '600',
  },
  geocodeHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: -2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
  },
  changedCard: {
    borderColor: 'rgba(124, 181, 24, 0.55)',
    backgroundColor: 'rgba(124, 181, 24, 0.08)',
  },
  diffHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  diffBox: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(124, 181, 24, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24, 0.28)',
  },
  diffTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.brand.text,
  },
  generatedComment: {
    ...typography.caption,
    color: colors.brand.text,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
  },
  chipText: {
    ...typography.caption,
    color: colors.brand.text,
    fontWeight: '600',
  },
  advancedToggle: {
    paddingVertical: spacing.xs,
  },
  advancedToggleText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  duplicateStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  duplicateStatusText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    flex: 1,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
    backgroundColor: colors.brand.surface,
  },
  candidateRowSelected: {
    borderColor: 'rgba(124, 181, 24, 0.7)',
    backgroundColor: 'rgba(124, 181, 24, 0.08)',
  },
  candidateCover: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(124, 181, 24, 0.12)',
  },
  candidateCoverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateText: {
    flex: 1,
    gap: 2,
  },
  candidateTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.brand.text,
  },
  candidateMeta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  lumoHint: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.brand.secondary,
    borderRadius: borderRadius.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitLabel: {
    ...typography.body,
    fontWeight: '700',
    color: colors.brand.onAccent,
  },
  backLink: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  backLinkText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
});
