import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { X, Filter, ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import type { MapFilters, TimeFilter, PopularityFilter, SortOption } from '../../types/filters';
import type { EventCategory } from '../../types/database';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { useTaxonomyStore } from '@/store/taxonomyStore';

interface FilterTrayProps {
  filters: MapFilters;
  onFiltersChange: (filters: Partial<MapFilters>) => void;
  onReset: () => void;
  activeFiltersCount: number;
  hasUserLocation: boolean;
}

export function FilterTray({
  filters,
  onFiltersChange,
  onReset,
  activeFiltersCount,
  hasUserLocation,
}: FilterTrayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  useTaxonomy();
  const categories = useTaxonomyStore((s) => s.categories);
  const subcategories = useTaxonomyStore((s) => s.subcategories);
  const tags = useTaxonomyStore((s) => s.tags);

  const toggleCategory = (category: EventCategory) => {
    onFiltersChange({ category: filters.category === category ? undefined : category });
    if (filters.category === category) {
      onFiltersChange({ subcategories: undefined });
    }
  };

  const toggleSubcategory = (subcategory: string) => {
    const next = filters.subcategories?.includes(subcategory)
      ? (filters.subcategories || []).filter((s) => s !== subcategory)
      : ([...(filters.subcategories || []), subcategory] as string[]);
    onFiltersChange({ subcategories: next });
  };

  const toggleTime = (time: TimeFilter) => {
    onFiltersChange({ time: filters.time === time ? undefined : time });
  };

  const togglePopularity = (popularity: PopularityFilter) => {
    onFiltersChange({
      popularity: filters.popularity === popularity ? undefined : popularity
    });
  };

  const toggleVisibility = (visibility: 'public' | 'prive') => {
    onFiltersChange({
      visibility: filters.visibility === visibility ? undefined : visibility
    });
  };

  const toggleFreeOnly = () => {
    onFiltersChange({
      freeOnly: !filters.freeOnly,
      paidOnly: false,
    });
  };

  const togglePaidOnly = () => {
    onFiltersChange({
      paidOnly: !filters.paidOnly,
      freeOnly: false,
    });
  };

  const toggleIncludePast = () => {
    const next = !filters.includePast;
    onFiltersChange({
      includePast: next,
      ...(next
        ? {
            time: undefined,
            startDate: undefined,
            endDate: undefined,
          }
        : {}),
    });
  };

  const changeSortBy = (sortBy: SortOption) => {
    if (sortBy === 'distance' && !hasUserLocation) {
      return;
    }
    onFiltersChange({ sortBy });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.headerLeft}>
          <Filter size={20} color={colors.neutral[700]} />
          <Text style={styles.headerText}>Filtres</Text>
          {activeFiltersCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </View>
        {isExpanded ? (
          <ChevronUp size={20} color={colors.neutral[700]} />
        ) : (
          <ChevronDown size={20} color={colors.neutral[700]} />
        )}
      </TouchableOpacity>

      {isExpanded && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Catégorie</Text>
            <View style={styles.chipContainer}>
              {categories.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.chip,
                    filters.category === item.id && styles.chipActive,
                  ]}
                  onPress={() => toggleCategory(item.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.category === item.id && styles.chipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {filters.category && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Sous-catégorie</Text>
              <View style={styles.chipContainer}>
                {subcategories
                  .filter((sub) => sub.category_id === filters.category)
                  .map((sub) => (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        styles.chip,
                        filters.subcategories?.includes(sub.id) && styles.chipActive,
                      ]}
                      onPress={() => toggleSubcategory(sub.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          filters.subcategories?.includes(sub.id) && styles.chipTextActive,
                        ]}
                      >
                        {sub.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          )}

          <View style={styles.row}>
            <View style={styles.sectionCardHalf}>
            <Text style={styles.sectionTitle}>Temps</Text>
            <View style={styles.chipContainer}>
              <TouchableOpacity
                style={[styles.chip, filters.time === 'weekend' && styles.chipActive]}
                onPress={() => toggleTime('weekend')}
              >
                <Text style={[styles.chipText, filters.time === 'weekend' && styles.chipTextActive]}>
                  Ce Weekend
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, filters.time === 'live' && styles.chipActive]}
                onPress={() => toggleTime('live')}
              >
                <Text style={[styles.chipText, filters.time === 'live' && styles.chipTextActive]}>
                  En cours
                </Text>
              </TouchableOpacity>
            </View>
          </View>

            <View style={styles.sectionCardHalf}>
              <Text style={styles.sectionTitle}>Popularité</Text>
            <View style={styles.chipContainer}>
                <TouchableOpacity
                  style={[styles.chip, filters.popularity === 'trending' && styles.chipActive]}
                  onPress={() => togglePopularity('trending')}
                >
                  <Text style={[styles.chipText, filters.popularity === 'trending' && styles.chipTextActive]}>
                    Tendance (10+)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, filters.popularity === 'popular' && styles.chipActive]}
                  onPress={() => togglePopularity('popular')}
                >
                  <Text style={[styles.chipText, filters.popularity === 'popular' && styles.chipTextActive]}>
                    Populaire (30+)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, filters.popularity === 'top' && styles.chipActive]}
                  onPress={() => togglePopularity('top')}
                >
                  <Text style={[styles.chipText, filters.popularity === 'top' && styles.chipTextActive]}>
                    Top (50+)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.sectionCardHalf}>
              <Text style={styles.sectionTitle}>Prix</Text>
              <View style={styles.chipContainer}>
                <TouchableOpacity
                  style={[styles.chip, filters.freeOnly && styles.chipActive]}
                  onPress={toggleFreeOnly}
                >
                  <Text style={[styles.chipText, filters.freeOnly && styles.chipTextActive]}>
                    Gratuit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, filters.paidOnly && styles.chipActive]}
                  onPress={togglePaidOnly}
                >
                  <Text style={[styles.chipText, filters.paidOnly && styles.chipTextActive]}>
                    Payant
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sectionCardHalf}>
              <Text style={styles.sectionTitle}>Visibilité</Text>
              <View style={styles.chipContainer}>
                <TouchableOpacity
                  style={[styles.chip, filters.visibility === 'public' && styles.chipActive]}
                  onPress={() => toggleVisibility('public')}
                >
                  <Text style={[styles.chipText, filters.visibility === 'public' && styles.chipTextActive]}>
                    Public
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, filters.visibility === 'prive' && styles.chipActive]}
                  onPress={() => toggleVisibility('prive')}
                >
                  <Text style={[styles.chipText, filters.visibility === 'prive' && styles.chipTextActive]}>
                    Privé
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.sectionCardHalf}>
              <Text style={styles.sectionTitle}>Options</Text>
              <View style={styles.chipContainer}>
                <TouchableOpacity
                  style={[styles.chip, filters.includePast && styles.chipActive]}
                  onPress={toggleIncludePast}
                >
                  <Text style={[styles.chipText, filters.includePast && styles.chipTextActive]}>
                    N&apos;importe quand
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { minWidth: 120 }]}
                  placeholder="Rayon km"
                  keyboardType="numeric"
                  value={filters.radiusKm ? String(filters.radiusKm) : ''}
                  onChangeText={(text) =>
                    onFiltersChange({ radiusKm: text ? Number(text) : undefined })
                  }
                />
              </View>
              <Text style={[styles.sectionTitle, { marginTop: spacing.sm }]}>Tags</Text>
              <View style={styles.chipContainer}>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag.slug}
                    style={[
                      styles.chip,
                      filters.tags?.includes(tag.slug) && styles.chipActive,
                    ]}
                    onPress={() => {
                      const exists = filters.tags?.includes(tag.slug);
                      const next = exists
                        ? (filters.tags || []).filter((t) => t !== tag.slug)
                        : ([...(filters.tags || []), tag.slug] as string[]);
                      onFiltersChange({ tags: next });
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        filters.tags?.includes(tag.slug) && styles.chipTextActive,
                      ]}
                    >
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.sectionCardHalf}>
              <Text style={styles.sectionTitle}>Tri</Text>
              <View style={styles.chipContainer}>
                <TouchableOpacity
                  style={[styles.chip, filters.sortBy === 'date' && styles.chipActive]}
                  onPress={() => changeSortBy('date')}
                >
                  <Text style={[styles.chipText, filters.sortBy === 'date' && styles.chipTextActive]}>
                    Date
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    filters.sortBy === 'distance' && styles.chipActive,
                    !hasUserLocation && styles.chipDisabled,
                  ]}
                  onPress={() => changeSortBy('distance')}
                  disabled={!hasUserLocation}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.sortBy === 'distance' && styles.chipTextActive,
                      !hasUserLocation && styles.chipTextDisabled,
                    ]}
                  >
                    Distance
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, filters.sortBy === 'popularity' && styles.chipActive]}
                  onPress={() => changeSortBy('popularity')}
                >
                  <Text style={[styles.chipText, filters.sortBy === 'popularity' && styles.chipTextActive]}>
                    Popularité
                  </Text>
                </TouchableOpacity>
              </View>
              {!hasUserLocation && (
                <Text style={styles.warningText}>
                  Activez la localisation pour trier par distance
                </Text>
              )}
            </View>
          </View>

          {activeFiltersCount > 0 && (
            <TouchableOpacity style={styles.resetButton} onPress={onReset}>
              <X size={16} color={colors.error[600]} />
              <Text style={styles.resetText}>Réinitialiser les filtres</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      },
      default: {
        shadowColor: colors.neutral[900],
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerText: {
    ...typography.bodyLarge,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: {
    ...typography.caption,
    color: colors.neutral[0],
    fontWeight: '700',
    fontSize: 11,
  },
  content: {
    maxHeight: 520,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
  },
  sectionCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[100],
    marginBottom: spacing.md,
  },
  sectionCardHalf: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  chipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.primary[700],
    fontWeight: '600',
  },
  chipTextDisabled: {
    color: colors.neutral[400],
  },
  warningText: {
    ...typography.caption,
    color: colors.warning[600],
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  resetText: {
    ...typography.body,
    color: colors.error[600],
    fontWeight: '600',
  },
});
