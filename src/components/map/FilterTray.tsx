import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { X, Filter, ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { CATEGORIES } from '../../constants/categories';
import type { MapFilters, TimeFilter, PopularityFilter, SortOption } from '../../types/filters';
import type { EventCategory } from '../../types/database';

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

  const toggleCategory = (category: EventCategory) => {
    onFiltersChange({ category: filters.category === category ? undefined : category });
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
    onFiltersChange({ includePast: !filters.includePast });
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Catégorie</Text>
            <View style={styles.chipContainer}>
              {Object.entries(CATEGORIES).map(([key, value]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.chip,
                    filters.category === key && styles.chipActive,
                  ]}
                  onPress={() => toggleCategory(key as EventCategory)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.category === key && styles.chipTextActive,
                    ]}
                  >
                    {value.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Temps</Text>
            <View style={styles.chipContainer}>
              <TouchableOpacity
                style={[styles.chip, filters.time === 'weekend' && styles.chipActive]}
                onPress={() => toggleTime('weekend')}
              >
                <Text style={[styles.chipText, filters.time === 'weekend' && styles.chipTextActive]}>
                  Weekend
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

          <View style={styles.section}>
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

          <View style={styles.section}>
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

          <View style={styles.section}>
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Options</Text>
            <View style={styles.chipContainer}>
              <TouchableOpacity
                style={[styles.chip, filters.includePast && styles.chipActive]}
                onPress={toggleIncludePast}
              >
                <Text style={[styles.chipText, filters.includePast && styles.chipTextActive]}>
                  Inclure passés
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
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
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
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
    maxHeight: 500,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  section: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
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
