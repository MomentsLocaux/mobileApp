import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Search, Plus, X } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { useTaxonomyStore } from '@/store/taxonomyStore';

type Props = {
  selected: string[];
  onChange: (tags: string[]) => void;
};

const normalizeTag = (value: string) =>
  value
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '_')
    .toLowerCase();

const toDisplay = (value: string) => value.replace(/_/g, ' ');

export const TagsSelector = ({ selected, onChange }: Props) => {
  useTaxonomy();
  const tags = useTaxonomyStore((s) => s.tags);
  const [query, setQuery] = useState('');

  const available = useMemo(
    () => tags.map((tag) => normalizeTag(tag.slug || tag.label)).filter(Boolean),
    [tags],
  );

  const filtered = useMemo(() => {
    const q = normalizeTag(query);
    if (!q) return available.slice(0, 12);
    return available.filter((tag) => tag.includes(q)).slice(0, 12);
  }, [available, query]);

  const canAddCustom = useMemo(() => {
    const q = normalizeTag(query);
    return !!q && !available.includes(q) && !selected.includes(q);
  }, [query, available, selected]);

  const toggle = (tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    if (selected.includes(normalized)) {
      onChange(selected.filter((t) => t !== normalized));
    } else {
      onChange([...selected, normalized]);
    }
  };

  const addCustom = () => {
    const normalized = normalizeTag(query);
    if (!normalized) return;
    if (!selected.includes(normalized)) {
      onChange([...selected, normalized]);
    }
    setQuery('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tags</Text>

      <View style={styles.searchRow}>
        <Search size={16} color={colors.brand.textSecondary} />
        <TextInput
          style={styles.input}
          placeholder="Rechercher ou ajouter un tag"
          placeholderTextColor={colors.brand.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => {
            if (canAddCustom) addCustom();
          }}
        />
        {canAddCustom ? (
          <TouchableOpacity style={styles.addCustomBtn} onPress={addCustom}>
            <Plus size={14} color="#0f1719" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>
        {filtered.map((tag) => {
          const active = selected.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.suggestionChip, active && styles.suggestionChipActive]}
              onPress={() => toggle(tag)}
            >
              <Text style={[styles.suggestionText, active && styles.suggestionTextActive]}>{toDisplay(tag)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selected.length > 0 ? (
        <View style={styles.selectedWrap}>
          {selected.map((tag) => (
            <View key={tag} style={styles.selectedChip}>
              <Text style={styles.selectedText}>#{toDisplay(tag)}</Text>
              <TouchableOpacity onPress={() => toggle(tag)}>
                <X size={12} color={colors.brand.secondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: colors.brand.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    color: colors.brand.text,
    ...typography.bodySmall,
  },
  addCustomBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsRow: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  suggestionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: colors.brand.surface,
  },
  suggestionChipActive: {
    borderColor: colors.brand.secondary,
    backgroundColor: 'rgba(43,191,227,0.12)',
  },
  suggestionText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  suggestionTextActive: {
    color: colors.brand.secondary,
  },
  selectedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(43,191,227,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(43,191,227,0.4)',
  },
  selectedText: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
