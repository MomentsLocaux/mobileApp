import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarDays, Check, CheckCheck, LocateFixed, MapPin, Search, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import type { Category } from '@/store/taxonomyStore';
import { MapboxService, type GeocodeResult } from '@/services/mapbox.service';
import { haptics } from '@/utils/haptics';
import type {
  ProposalAnchor,
  ProposalDateWindow,
  ProposalPreferences,
  ProposalRadiusKm,
} from './proposal.types';
import { getProposalCategoryHint } from './proposal-category-hints';
import { getProposalCategoryLabel } from './proposal-category-display';

type Props = {
  step: 0 | 1 | 2;
  preferences: ProposalPreferences;
  categories: Category[];
  locationLoading: boolean;
  locationAvailable: boolean;
  onUseCurrentLocation: () => void;
  onStepChange: (step: 0 | 1 | 2) => void;
  onToggleCategory: (categoryId: string) => void;
  onSelectAllCategories: (categoryIds: string[]) => void;
  onRadiusChange: (radius: ProposalRadiusKm) => void;
  onAnchorChange: (anchor: ProposalAnchor) => void;
  onDateWindowChange: (window: ProposalDateWindow) => void;
  onGenerate: () => void;
};

const RADII: ProposalRadiusKm[] = [5, 10, 25, 50];
const DATE_OPTIONS: { value: ProposalDateWindow; label: string; detail: string }[] = [
  { value: 'today', label: "Aujourd'hui", detail: 'Pour une sortie maintenant' },
  { value: 'weekend', label: 'Ce week-end', detail: 'Samedi et dimanche' },
  { value: '7_days', label: '7 prochains jours', detail: 'Un peu de spontanéité' },
  { value: '30_days', label: '30 prochains jours', detail: 'Pour voir plus large' },
];

const STEP_COPY = [
  { eyebrow: '1 sur 3', title: "Qu'est-ce qui te fait envie ?", subtitle: 'Choisis une ou plusieurs catégories, ou garde tout ouvert.' },
  { eyebrow: '2 sur 3', title: 'Jusqu’où veux-tu aller ?', subtitle: 'Pars de ta position ou choisis une ville, puis règle le rayon.' },
  { eyebrow: '3 sur 3', title: 'Quand es-tu disponible ?', subtitle: 'On ne te proposera que des moments dans cette période.' },
] as const;

export function ProposalWizard({
  step,
  preferences,
  categories,
  locationLoading,
  locationAvailable,
  onUseCurrentLocation,
  onStepChange,
  onToggleCategory,
  onSelectAllCategories,
  onRadiusChange,
  onAnchorChange,
  onDateWindowChange,
  onGenerate,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const copy = STEP_COPY[step];

  useEffect(() => {
    let cancelled = false;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const next = await MapboxService.search(trimmed, { types: 'place,locality,address' });
        if (!cancelled) setResults(next.slice(0, 5));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const canContinue = step !== 1 || Boolean(preferences.anchor);
  const actionLabel = step === 2 ? 'Générer mes propositions' : 'Continuer';
  const selectedCategoryCount = preferences.categoryIds.length;
  const allCategoriesSelected =
    categories.length > 0 && categories.every((category) => preferences.categoryIds.includes(category.id));
  const categorySubtitle = useMemo(
    () => selectedCategoryCount === 0
      ? 'Toutes les catégories seront explorées'
      : `${selectedCategoryCount} catégorie${selectedCategoryCount > 1 ? 's' : ''} sélectionnée${selectedCategoryCount > 1 ? 's' : ''}`,
    [selectedCategoryCount],
  );

  const handlePrimary = () => {
    if (!canContinue) return;
    haptics.selection();
    if (step === 2) onGenerate();
    else onStepChange((step + 1) as 1 | 2);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}> 
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Sparkles size={20} color={colors.brand.primary} strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.brandTitle}>Propositions</Text>
            <Text style={styles.brandSubtitle}>Cherchons ensemble</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          {[0, 1, 2].map((value) => (
            <View
              key={value}
              style={[styles.progressSegment, value <= step && styles.progressSegmentActive]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>

        {step === 0 ? (
          <View style={styles.section}>
            <View style={styles.categoryHeaderRow}>
              <Text style={styles.selectionHint}>{categorySubtitle}</Text>
              <TouchableOpacity
                style={[styles.selectAllButton, allCategoriesSelected && styles.selectAllButtonActive]}
                onPress={() => {
                  haptics.selection();
                  onSelectAllCategories(
                    allCategoriesSelected ? [] : categories.map((category) => category.id),
                  );
                }}
                disabled={categories.length === 0}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: allCategoriesSelected, disabled: categories.length === 0 }}
                accessibilityLabel={allCategoriesSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
              >
                <CheckCheck size={16} color={allCategoriesSelected ? colors.brand.primary : colors.brand.secondary} />
                <Text style={[styles.selectAllText, allCategoriesSelected && styles.selectAllTextActive]}>
                  {allCategoriesSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.chipGrid}>
              {categories.map((category) => {
                const active = preferences.categoryIds.includes(category.id);
                const categoryLabel = getProposalCategoryLabel(category);
                return (
                  <TouchableOpacity
                    key={category.id}
                    activeOpacity={0.8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={`Catégorie ${categoryLabel}`}
                    onPress={() => {
                      haptics.selection();
                      onToggleCategory(category.id);
                    }}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                  >
                    <View style={styles.categoryCopy}>
                      <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                        {categoryLabel}
                      </Text>
                      <Text style={[styles.categoryHint, active && styles.categoryHintActive]}>
                        {getProposalCategoryHint(category.slug)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.categoryCheck,
                        active && styles.categoryCheckActive,
                        !active && category.color ? { borderColor: category.color } : null,
                      ]}
                    >
                      {active ? <Check size={15} color={colors.brand.primary} strokeWidth={3} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {categories.length === 0 ? (
              <View style={styles.infoCard}>
                <ActivityIndicator color={colors.brand.secondary} />
                <Text style={styles.infoText}>Chargement des catégories…</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.locationButton, preferences.anchor?.label === 'Ma position' && styles.locationButtonActive]}
              onPress={onUseCurrentLocation}
              disabled={locationLoading}
              accessibilityRole="button"
              accessibilityLabel="Utiliser ma position actuelle"
            >
              {locationLoading ? (
                <ActivityIndicator color={colors.brand.secondary} />
              ) : (
                <LocateFixed size={21} color={colors.brand.secondary} />
              )}
              <View style={styles.locationButtonCopy}>
                <Text style={styles.locationButtonTitle}>Autour de moi</Text>
                <Text style={styles.locationButtonSubtitle}>
                  {locationAvailable ? 'Position disponible' : 'Autoriser la géolocalisation'}
                </Text>
              </View>
              {preferences.anchor?.label === 'Ma position' ? (
                <Check size={18} color={colors.brand.secondary} strokeWidth={3} />
              ) : null}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>ou choisir un lieu</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.searchBox}>
              <Search size={18} color={colors.brand.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Ville, adresse ou lieu"
                placeholderTextColor={colors.brand.textSecondary}
                style={styles.searchInput}
                autoCorrect={false}
              />
              {searching ? <ActivityIndicator size="small" color={colors.brand.secondary} /> : null}
            </View>
            {results.map((result) => (
              <TouchableOpacity
                key={`${result.latitude}:${result.longitude}:${result.label}`}
                style={styles.searchResult}
                onPress={() => {
                  haptics.selection();
                  onAnchorChange({
                    latitude: result.latitude,
                    longitude: result.longitude,
                    label: result.city || result.label,
                  });
                  setQuery('');
                  setResults([]);
                }}
              >
                <MapPin size={17} color={colors.brand.secondary} />
                <Text style={styles.searchResultText} numberOfLines={2}>{result.label}</Text>
              </TouchableOpacity>
            ))}

            {preferences.anchor ? (
              <View style={styles.anchorCard}>
                <MapPin size={18} color={colors.brand.secondary} />
                <View style={styles.anchorCopy}>
                  <Text style={styles.anchorLabel}>Point de départ</Text>
                  <Text style={styles.anchorValue} numberOfLines={1}>{preferences.anchor.label}</Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Rayon de recherche</Text>
            <View style={styles.radiusRow}>
              {RADII.map((radius) => {
                const active = preferences.radiusKm === radius;
                return (
                  <TouchableOpacity
                    key={radius}
                    style={[styles.radiusChip, active && styles.radiusChipActive]}
                    onPress={() => {
                      haptics.selection();
                      onRadiusChange(radius);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.radiusText, active && styles.radiusTextActive]}>{radius} km</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.section}>
            {DATE_OPTIONS.map((option) => {
              const active = preferences.dateWindow === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.dateOption, active && styles.dateOptionActive]}
                  onPress={() => {
                    haptics.selection();
                    onDateWindowChange(option.value);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.dateIcon, active && styles.dateIconActive]}>
                    <CalendarDays size={20} color={active ? colors.brand.primary : colors.brand.secondary} />
                  </View>
                  <View style={styles.dateCopy}>
                    <Text style={[styles.dateLabel, active && styles.dateLabelActive]}>{option.label}</Text>
                    <Text style={styles.dateDetail}>{option.detail}</Text>
                  </View>
                  {active ? <Check size={19} color={colors.brand.secondary} strokeWidth={3} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}> 
        {step > 0 ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => onStepChange((step - 1) as 0 | 1)}
            accessibilityRole="button"
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.primaryButton, step === 0 && styles.primaryButtonFull, !canContinue && styles.primaryButtonDisabled]}
          onPress={handlePrimary}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
        >
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
          {step === 2 ? <Sparkles size={18} color={colors.brand.primary} /> : null}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand.secondary },
  brandTitle: { ...typography.h6, color: colors.brand.text },
  brandSubtitle: { ...typography.bodySmall, color: colors.brand.textSecondary },
  progressTrack: { flexDirection: 'row', gap: 6, marginTop: spacing.lg },
  progressSegment: { height: 4, flex: 1, borderRadius: 2, backgroundColor: colors.brand.surface },
  progressSegmentActive: { backgroundColor: colors.brand.secondary },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 140 },
  eyebrow: { ...typography.label, color: colors.brand.secondary, marginTop: spacing.sm, marginBottom: spacing.sm },
  title: { ...typography.h2, color: colors.brand.text, maxWidth: 420 },
  subtitle: { ...typography.body, color: colors.brand.textSecondary, marginTop: spacing.sm, maxWidth: 500 },
  section: { marginTop: spacing.xl },
  categoryHeaderRow: { gap: spacing.sm, marginBottom: spacing.md },
  selectionHint: { ...typography.bodySmall, color: colors.brand.textSecondary },
  selectAllButton: { minHeight: 42, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.full, borderWidth: 1, borderColor: 'rgba(43, 191, 227, 0.45)', backgroundColor: 'rgba(43, 191, 227, 0.08)' },
  selectAllButtonActive: { backgroundColor: colors.brand.secondary, borderColor: colors.brand.secondary },
  selectAllText: { ...typography.label, color: colors.brand.secondary },
  selectAllTextActive: { color: colors.brand.primary },
  chipGrid: { gap: spacing.sm },
  categoryChip: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#334155', backgroundColor: colors.brand.surface },
  categoryChipActive: { backgroundColor: colors.brand.secondary, borderColor: colors.brand.secondary },
  categoryCopy: { flex: 1 },
  categoryLabel: { ...typography.h6, color: colors.brand.text },
  categoryLabelActive: { color: colors.brand.primary },
  categoryHint: { ...typography.bodySmall, color: colors.brand.textSecondary, marginTop: 3, lineHeight: 18 },
  categoryHintActive: { color: '#17323a' },
  categoryCheck: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#475569' },
  categoryCheckActive: { borderColor: colors.brand.primary, backgroundColor: 'rgba(15, 23, 25, 0.08)' },
  infoCard: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.brand.surface },
  infoText: { ...typography.bodySmall, color: colors.brand.textSecondary },
  locationButton: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#334155', backgroundColor: colors.brand.surface },
  locationButtonActive: { borderColor: colors.brand.secondary, backgroundColor: '#122c33' },
  locationButtonCopy: { flex: 1, marginLeft: spacing.md },
  locationButtonTitle: { ...typography.h6, color: colors.brand.text },
  locationButtonSubtitle: { ...typography.bodySmall, color: colors.brand.textSecondary },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.lg },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#334155' },
  dividerText: { ...typography.bodySmall, color: colors.brand.textSecondary },
  searchBox: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#334155', backgroundColor: colors.brand.surface },
  searchInput: { flex: 1, marginLeft: spacing.sm, ...typography.body, color: colors.brand.text },
  searchResult: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#334155' },
  searchResultText: { flex: 1, ...typography.bodySmall, color: colors.brand.text },
  anchorCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginTop: spacing.md, borderRadius: borderRadius.md, backgroundColor: '#122c33' },
  anchorCopy: { flex: 1, marginLeft: spacing.sm },
  anchorLabel: { ...typography.label, fontSize: 11, color: colors.brand.secondary },
  anchorValue: { ...typography.body, color: colors.brand.text },
  sectionLabel: { ...typography.h6, color: colors.brand.text, marginTop: spacing.xl, marginBottom: spacing.md },
  radiusRow: { flexDirection: 'row', gap: spacing.sm },
  radiusChip: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#334155', backgroundColor: colors.brand.surface },
  radiusChipActive: { backgroundColor: colors.brand.secondary, borderColor: colors.brand.secondary },
  radiusText: { ...typography.label, color: colors.brand.text },
  radiusTextActive: { color: colors.brand.primary },
  dateOption: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#334155', backgroundColor: colors.brand.surface },
  dateOptionActive: { borderColor: colors.brand.secondary, backgroundColor: '#122c33' },
  dateIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#243136' },
  dateIconActive: { backgroundColor: colors.brand.secondary },
  dateCopy: { flex: 1, marginLeft: spacing.md },
  dateLabel: { ...typography.h6, color: colors.brand.text },
  dateLabelActive: { color: colors.brand.secondary },
  dateDetail: { ...typography.bodySmall, color: colors.brand.textSecondary, marginTop: 2 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#334155', backgroundColor: colors.brand.primary },
  backButton: { minHeight: 54, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.full, borderWidth: 1, borderColor: '#475569' },
  backButtonText: { ...typography.label, color: colors.brand.text },
  primaryButton: { flex: 1, minHeight: 54, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.full, backgroundColor: colors.brand.secondary },
  primaryButtonFull: { flex: 1 },
  primaryButtonDisabled: { opacity: 0.4 },
  primaryButtonText: { ...typography.bodyBold, color: colors.brand.primary },
});
