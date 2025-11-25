import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { X, Filter, ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { CATEGORIES } from '../../constants/categories';
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
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Temps</Text>
            <View style={styles.chipRow}>
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
                  Inclure passés
                </Text>
              </TouchableOpacity>
            </View>
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
