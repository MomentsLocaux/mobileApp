import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, ChevronRight, Copy, Pencil, X } from 'lucide-react-native';
import { FloatingPressable } from '@/components/ui/FloatingPressable';
import { features } from '@/config/features';
import { Motion } from '@/constants/motion';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { CategorySelector } from '@/components/events/CategorySelector';
import { EventCorrectionService } from '@/services/event-correction.service';
import { invalidateMySuggestionHistory } from '@/services/suggestion-history.service';
import type { EventWithCreator } from '@/types/database';
import {
  pickCorrectionDiff,
  type EventCorrectionFieldKey,
  type EventCorrectionProposedFields,
} from '@/types/event-correction';
import { haptics } from '@/utils/haptics';

type Step = 'kind' | 'field_correction' | 'duplicate';
type DateField = 'starts_at' | 'ends_at';

type Props = {
  visible: boolean;
  event: EventWithCreator;
  onClose: () => void;
};

type FieldDraft = {
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  address: string;
  city: string;
  postal_code: string;
  venue_name: string;
  is_free: boolean;
  price: string;
  cover_url: string;
  external_url: string;
  category: string;
  subcategory: string;
};

const FIELD_LABELS: Partial<Record<EventCorrectionFieldKey, string>> = {
  title: 'Titre',
  description: 'Description',
  starts_at: 'Début',
  ends_at: 'Fin',
  address: 'Adresse',
  city: 'Ville',
  postal_code: 'Code postal',
  venue_name: 'Nom du lieu',
  is_free: 'Gratuité',
  price: 'Prix',
  cover_url: 'Couverture',
  external_url: 'Lien',
  category: 'Catégorie',
  subcategory: 'Sous-catégorie',
};

const emptyDraft = (): FieldDraft => ({
  title: '',
  description: '',
  starts_at: '',
  ends_at: '',
  address: '',
  city: '',
  postal_code: '',
  venue_name: '',
  is_free: true,
  price: '',
  cover_url: '',
  external_url: '',
  category: '',
  subcategory: '',
});

const draftFromEvent = (event: EventWithCreator): FieldDraft => ({
  title: event.title || '',
  description: event.description || '',
  starts_at: event.starts_at || '',
  ends_at: event.ends_at || '',
  address: event.address || '',
  city: event.city || '',
  postal_code: event.postal_code || '',
  venue_name: event.venue_name || '',
  is_free: Boolean(event.is_free),
  price: event.price == null ? '' : String(event.price),
  cover_url: event.cover_url || '',
  external_url: event.external_url || '',
  category: event.category || '',
  subcategory: event.subcategory || '',
});

const baselineFields = (event: EventWithCreator): EventCorrectionProposedFields => ({
  title: event.title || null,
  description: event.description || null,
  starts_at: event.starts_at || null,
  ends_at: event.ends_at || null,
  address: event.address || null,
  city: event.city || null,
  postal_code: event.postal_code || null,
  venue_name: event.venue_name || null,
  is_free: Boolean(event.is_free),
  price: event.price,
  cover_url: event.cover_url || null,
  external_url: event.external_url || null,
  category: event.category || null,
  subcategory: event.subcategory || null,
});

const draftToProposed = (draft: FieldDraft): EventCorrectionProposedFields => {
  const priceTrimmed = draft.price.trim();
  const price =
    draft.is_free || !priceTrimmed
      ? null
      : Number.isFinite(Number(priceTrimmed))
        ? Number(priceTrimmed)
        : null;

  return pickCorrectionDiff({
    title: draft.title.trim() || null,
    description: draft.description.trim() || null,
    starts_at: draft.starts_at.trim() || null,
    ends_at: draft.ends_at.trim() || null,
    address: draft.address.trim() || null,
    city: draft.city.trim() || null,
    postal_code: draft.postal_code.trim() || null,
    venue_name: draft.venue_name.trim() || null,
    is_free: draft.is_free,
    price: draft.is_free ? null : price,
    cover_url: draft.cover_url.trim() || null,
    external_url: draft.external_url.trim() || null,
    category: draft.category.trim() || null,
    subcategory: draft.subcategory.trim() || null,
  });
};

const buildFieldDiff = (
  event: EventWithCreator,
  draft: FieldDraft,
): EventCorrectionProposedFields => {
  const baseline = baselineFields(event);
  const next = draftToProposed(draft);
  const diff: EventCorrectionProposedFields = {};

  (Object.keys(next) as (keyof EventCorrectionProposedFields)[]).forEach((key) => {
    const before = baseline[key] ?? null;
    const after = next[key] ?? null;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diff[key] = after;
    }
  });

  return diff;
};

const parseDate = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const formatDateTime = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Choisir une date';
  return d.toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const correctionErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Impossible d’envoyer la proposition.';
  if (message.includes('QUOTA')) return 'Tu as atteint la limite du jour (5 propositions).';
  if (message.includes('EVENT_CORRECTION_CATEGORY')) {
    return 'Cette catégorie n’est pas reconnue. Choisis-en une dans la liste.';
  }
  if (message.includes('EVENT_CORRECTION_SUBCATEGORY')) {
    return 'Cette sous-catégorie ne correspond pas à la catégorie choisie.';
  }
  return message;
};

export function EventCorrectionSheet({ visible, event, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  const [step, setStep] = useState<Step>('kind');
  const [draft, setDraft] = useState<FieldDraft>(emptyDraft);
  const [comment, setComment] = useState('');
  const [sourceHint, setSourceHint] = useState('');
  const [duplicateHint, setDuplicateHint] = useState('');
  const [duplicateOfEventId, setDuplicateOfEventId] = useState('');
  const [showAdvancedDuplicate, setShowAdvancedDuplicate] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [iosPicker, setIosPicker] = useState<DateField | null>(null);

  useEffect(() => {
    if (!visible) {
      progress.value = 0;
      return;
    }
    setStep('kind');
    setDraft(draftFromEvent(event));
    setComment('');
    setSourceHint('');
    setDuplicateHint('');
    setDuplicateOfEventId('');
    setShowAdvancedDuplicate(false);
    setShowLinks(Boolean(event.cover_url || event.external_url));
    setSubmitting(false);
    setIosPicker(null);
    progress.value = reduceMotion ? 1 : withSpring(1, Motion.spring.sheet);
  }, [visible, event, progress, reduceMotion]);

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

  const fieldDiff = useMemo(() => buildFieldDiff(event, draft), [event, draft]);
  const changedKeys = Object.keys(fieldDiff) as EventCorrectionFieldKey[];
  const changedCount = changedKeys.length;
  const isChanged = (key: EventCorrectionFieldKey) => changedKeys.includes(key);

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
        ? 'Modifie uniquement ce qui est faux ou manquant.'
        : 'Indique l’autre fiche si tu la connais ; un modérateur vérifiera.';

  const updateDraft = <K extends keyof FieldDraft>(key: K, value: FieldDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const setDateField = (field: DateField, date: Date) => {
    updateDraft(field, date.toISOString());
  };

  const openDatePicker = (field: DateField) => {
    haptics.selection();
    const current = parseDate(draft[field]);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode: 'date',
        value: current,
        onChange: (eventResult, selectedDate) => {
          if (eventResult.type !== 'set' || !selectedDate) return;
          DateTimePickerAndroid.open({
            mode: 'time',
            value: selectedDate,
            is24Hour: true,
            onChange: (timeResult, selectedTime) => {
              if (timeResult.type !== 'set' || !selectedTime) return;
              const merged = new Date(selectedDate);
              merged.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
              setDateField(field, merged);
            },
          });
        },
      });
      return;
    }
    setIosPicker(field);
  };

  const submitFieldCorrection = async () => {
    if (changedCount === 0) {
      Alert.alert('Rien à envoyer', 'Modifie au moins un champ avant de proposer.');
      return;
    }
    if (comment.trim().length < 3) {
      Alert.alert('Commentaire requis', 'Explique brièvement pourquoi / ta source (min. 3 caractères).');
      return;
    }

    setSubmitting(true);
    try {
      await EventCorrectionService.create({
        eventId: event.id,
        kind: 'field_correction',
        proposedFields: fieldDiff,
        comment: comment.trim(),
        sourceHint: sourceHint.trim() || null,
      });
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

  const submitDuplicate = async () => {
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
        comment: comment.trim(),
        duplicateOfEventId: otherId || null,
        duplicateHint: duplicateHint.trim() || null,
        sourceHint: sourceHint.trim() || null,
      });
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
    <Modal visible={visible} animationType="none" transparent onRequestClose={closeAnimated}>
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

          {step === 'kind' ? (
            <View style={styles.options}>
              <OptionRow
                icon={Pencil}
                title="Corriger des infos"
                subtitle="Horaire, lieu, catégorie, tarif, titre…"
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
                  <SectionTitle>Infos</SectionTitle>
                  <Field
                    label="Titre"
                    value={draft.title}
                    onChangeText={(v) => updateDraft('title', v)}
                    changed={isChanged('title')}
                  />
                  <Field
                    label="Description"
                    value={draft.description}
                    onChangeText={(v) => updateDraft('description', v)}
                    multiline
                    changed={isChanged('description')}
                  />

                  <View
                    style={[
                      styles.taxonomyWrap,
                      (isChanged('category') || isChanged('subcategory')) && styles.changedCard,
                    ]}
                  >
                    {isChanged('category') || isChanged('subcategory') ? (
                      <Text style={styles.fieldLabel}>Taxonomie · modifié</Text>
                    ) : null}
                    <CategorySelector
                      selected={draft.category || undefined}
                      subcategory={draft.subcategory || undefined}
                      onSelect={(value) => {
                        setDraft((prev) =>
                          prev.category === value
                            ? prev
                            : { ...prev, category: value, subcategory: '' },
                        );
                      }}
                      onSelectSubcategory={(value) => updateDraft('subcategory', value || '')}
                    />
                  </View>

                  <SectionTitle>Horaires</SectionTitle>
                  <DateFieldRow
                    label="Début"
                    value={draft.starts_at}
                    changed={isChanged('starts_at')}
                    onPress={() => openDatePicker('starts_at')}
                  />
                  <DateFieldRow
                    label="Fin"
                    value={draft.ends_at}
                    changed={isChanged('ends_at')}
                    onPress={() => openDatePicker('ends_at')}
                  />

                  <SectionTitle>Lieu</SectionTitle>
                  <Field
                    label="Adresse"
                    value={draft.address}
                    onChangeText={(v) => updateDraft('address', v)}
                    changed={isChanged('address')}
                  />
                  <View style={styles.row2}>
                    <View style={styles.row2Item}>
                      <Field
                        label="Ville"
                        value={draft.city}
                        onChangeText={(v) => updateDraft('city', v)}
                        changed={isChanged('city')}
                      />
                    </View>
                    <View style={styles.row2ItemNarrow}>
                      <Field
                        label="CP"
                        value={draft.postal_code}
                        onChangeText={(v) => updateDraft('postal_code', v)}
                        autoCapitalize="none"
                        changed={isChanged('postal_code')}
                      />
                    </View>
                  </View>
                  <Field
                    label="Nom du lieu"
                    value={draft.venue_name}
                    onChangeText={(v) => updateDraft('venue_name', v)}
                    changed={isChanged('venue_name')}
                  />

                  <SectionTitle>Tarif</SectionTitle>
                  <View style={[styles.switchRow, isChanged('is_free') && styles.changedCard]}>
                    <Text style={styles.fieldLabel}>
                      Gratuit{isChanged('is_free') ? ' · modifié' : ''}
                    </Text>
                    <Switch
                      value={draft.is_free}
                      onValueChange={(v) => updateDraft('is_free', v)}
                      trackColor={{ false: colors.neutral[300], true: 'rgba(124, 181, 24, 0.55)' }}
                      thumbColor={draft.is_free ? colors.brand.secondary : colors.neutral[100]}
                    />
                  </View>
                  {!draft.is_free ? (
                    <Field
                      label="Prix (€)"
                      value={draft.price}
                      onChangeText={(v) => updateDraft('price', v)}
                      keyboardType="decimal-pad"
                      changed={isChanged('price')}
                    />
                  ) : null}

                  <TouchableOpacity
                    onPress={() => setShowLinks((v) => !v)}
                    style={styles.advancedToggle}
                    accessibilityRole="button"
                  >
                    <Text style={styles.advancedToggleText}>
                      {showLinks ? 'Masquer les liens' : 'Liens (couverture / site)'}
                    </Text>
                  </TouchableOpacity>
                  {showLinks ? (
                    <>
                      <Field
                        label="URL couverture"
                        value={draft.cover_url}
                        onChangeText={(v) => updateDraft('cover_url', v)}
                        autoCapitalize="none"
                        changed={isChanged('cover_url')}
                      />
                      <Field
                        label="Lien externe"
                        value={draft.external_url}
                        onChangeText={(v) => updateDraft('external_url', v)}
                        autoCapitalize="none"
                        changed={isChanged('external_url')}
                      />
                    </>
                  ) : null}

                  {changedCount > 0 ? (
                    <View style={styles.diffBox}>
                      <Text style={styles.diffTitle}>
                        {changedCount} modification{changedCount > 1 ? 's' : ''} proposée
                        {changedCount > 1 ? 's' : ''}
                      </Text>
                      <View style={styles.chipRow}>
                        {changedKeys.map((key) => (
                          <View key={key} style={styles.chip}>
                            <Text style={styles.chipText}>{FIELD_LABELS[key] || key}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.diffHint}>Aucun champ modifié pour l’instant.</Text>
                  )}
                </>
              ) : (
                <>
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
                </>
              )}

              <SectionTitle>Justification</SectionTitle>
              <Field
                label="Commentaire (obligatoire)"
                value={comment}
                onChangeText={setComment}
                multiline
                placeholder="Pourquoi cette proposition ? Quelle source ?"
              />
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
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={step === 'field_correction' ? submitFieldCorrection : submitDuplicate}
                disabled={submitting}
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

          {Platform.OS === 'ios' && iosPicker ? (
            <View style={styles.iosPickerWrap}>
              <View style={styles.iosPickerHeader}>
                <Text style={styles.iosPickerTitle}>
                  {iosPicker === 'starts_at' ? 'Date de début' : 'Date de fin'}
                </Text>
                <TouchableOpacity onPress={() => setIosPicker(null)}>
                  <Text style={styles.iosPickerDone}>OK</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={parseDate(draft[iosPicker])}
                mode="datetime"
                display="spinner"
                locale="fr-FR"
                onChange={(_event, date) => {
                  if (date) setDateField(iosPicker, date);
                }}
              />
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function DateFieldRow({
  label,
  value,
  changed,
  onPress,
}: {
  label: string;
  value: string;
  changed?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {changed ? ' · modifié' : ''}
      </Text>
      <TouchableOpacity
        style={[styles.datePicker, changed && styles.changedCard]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDateTime(value)}`}
      >
        <Calendar size={16} color={colors.brand.secondary} />
        <Text style={styles.dateText}>{formatDateTime(value)}</Text>
        <ChevronRight size={18} color={colors.brand.textSecondary} />
      </TouchableOpacity>
    </View>
  );
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
  datePicker: {
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
  dateText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    flex: 1,
    fontWeight: '600',
  },
  row2: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  row2Item: {
    flex: 1,
  },
  row2ItemNarrow: {
    width: 96,
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
  iosPickerWrap: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 51, 41, 0.1)',
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  iosPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  iosPickerTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.brand.text,
  },
  iosPickerDone: {
    ...typography.bodySmall,
    fontWeight: '800',
    color: colors.brand.secondary,
  },
});
