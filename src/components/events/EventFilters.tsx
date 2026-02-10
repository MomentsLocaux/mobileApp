import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { X, Filter, ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import type { EventFilters, TimeFilter, PopularityFilter } from '../../types/filters';
import type { EventCategory } from '../../types/database';

interface EventFiltersProps {
  filters: EventFilters;
  onFiltersChange: (filters: Partial<EventFilters>) => void;
  onReset: () => void;
  activeFiltersCount: number;
}

export function EventFilters({
  filters,
  onFiltersChange,
  onReset,
  activeFiltersCount,
}: EventFiltersProps) {
  const [isVisible, setIsVisible] = useState(false);
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

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setIsVisible(!isVisible)}
      >
        <View style={styles.toggleLeft}>
          <Filter size={18} color={colors.neutral[700]} />
          <Text style={styles.toggleText}>
            {isVisible ? 'Masquer les filtres' : 'Afficher les filtres'}
          </Text>
          {activeFiltersCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </View>
        {isVisible ? (
          <ChevronUp size={18} color={colors.neutral[700]} />
        ) : (
          <ChevronDown size={18} color={colors.neutral[700]} />
        )}
      </TouchableOpacity>

      {isVisible && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Catégories</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.chip,
                    filters.category === cat.id && styles.chipActive,
                  ]}
                  onPress={() => toggleCategory(cat.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.category === cat.id && styles.chipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {filters.category && (
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Sous-catégories</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsScroll}
              >
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
              </ScrollView>
            </View>
          )}

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Temps</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, filters.time === 'today' && styles.chipActive]}
                onPress={() => toggleTime('today')}
              >
                <Text style={[styles.chipText, filters.time === 'today' && styles.chipTextActive]}>
                  Aujourd'hui
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, filters.time === 'tomorrow' && styles.chipActive]}
                onPress={() => toggleTime('tomorrow')}
              >
                <Text style={[styles.chipText, filters.time === 'tomorrow' && styles.chipTextActive]}>
                  Demain
                </Text>
              </TouchableOpacity>
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

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Popularité</Text>
            <View style={styles.chipRow}>
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

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Options</Text>
            <View style={styles.chipRow}>
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
            <Text style={[styles.filterLabel, { marginTop: spacing.sm }]}>Tags</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
            >
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
            </ScrollView>
          </View>

          {activeFiltersCount > 0 && (
            <TouchableOpacity style={styles.resetButton} onPress={onReset}>
              <X size={16} color={colors.error[600]} />
              <Text style={styles.resetText}>Réinitialiser</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toggleText: {
    ...typography.body,
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
  filtersScroll: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  filtersContent: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  filterSection: {
    marginBottom: spacing.md,
  },
  filterLabel: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipRow: {
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
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
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
  input: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
    color: colors.neutral[900],
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  resetText: {
    ...typography.bodySmall,
    color: colors.error[600],
    fontWeight: '600',
  },
});
