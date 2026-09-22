import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EventWithCreator } from '@/types/database';
import type { SortOption, SortOrder } from '@/types/filters';
import type { EventCardStats } from '@/services/event-card-stats.service';
import { colors, spacing, typography } from '@/constants/theme';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { MapDiscoveryEventCard } from './MapDiscoveryEventCard';

type Props = {
  spotlight: EventWithCreator[];
  stats: Record<string, EventCardStats>;
  pendingIds: ReadonlySet<string>;
  isHearted?: (id: string) => boolean;
  total: number;
  sortBy: SortOption;
  sortOrder?: SortOrder;
  hasLocation: boolean;
  onSort?: (sort: SortOption, order?: SortOrder) => void;
  onOpen: (event: EventWithCreator) => void;
  onToggleHeart: (event: EventWithCreator) => void;
  onShare: (event: EventWithCreator) => void;
  onShowAll: () => void;
  onResultsLayout: (y: number) => void;
  distanceFor: (event: EventWithCreator) => string | null;
};

export function MapDiscoveryHeader({
  spotlight, stats, pendingIds, isHearted, total, sortBy, sortOrder, hasLocation, onSort,
  onOpen, onToggleHeart, onShare, onShowAll, onResultsLayout, distanceFor,
}: Props) {
  const sorts: { label: string; key: SortOption; order?: SortOrder; disabled?: boolean }[] = [
    { label: 'Tous', key: 'triage' },
    { label: 'Nouveautés', key: 'created', order: 'desc' },
    { label: 'Les + proches', key: 'distance', disabled: !hasLocation },
  ];
  return (
    <View>
      {spotlight.length > 0 ? <>
        <View style={styles.sectionHeading}>
          <View style={styles.headingLabel}><BrandIcon name="sparkles" size={23} /><Text accessibilityRole="header" style={styles.title}>Les moments à découvrir</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Voir tous les événements" onPress={onShowAll} style={styles.seeAll}><Text style={styles.link}>Voir tout</Text></Pressable>
        </View>
        <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel} accessibilityLabel="Les moments à découvrir">
          {spotlight.map((event) => <MapDiscoveryEventCard key={event.id} event={event} variant="spotlight" stats={stats[event.id]} liked={Boolean(isHearted?.(event.id))} pending={pendingIds.has(event.id)} onOpen={onOpen} onToggleHeart={onToggleHeart} onShare={onShare} distance={distanceFor(event)} />)}
        </ScrollView>
      </> : null}
      <View style={styles.results} onLayout={(event) => onResultsLayout(event.nativeEvent.layout.y)}>
        <View style={styles.resultsHeading}><Text accessibilityRole="header" style={styles.title}>Tous les événements</Text><Text style={styles.count}>{total} résultat{total > 1 ? 's' : ''}</Text></View>
        {onSort ? <View style={styles.sorts}>
          {sorts.map((sort) => {
            const selected = sortBy === sort.key && (!sort.order || (sortOrder ?? 'desc') === sort.order);
            return <Pressable key={sort.key} accessibilityRole="button" accessibilityLabel={sort.disabled ? 'Les plus proches : localisation nécessaire' : sort.label} accessibilityState={{ selected, disabled: sort.disabled }} disabled={sort.disabled} onPress={() => onSort(sort.key, sort.order)} style={[styles.sort, selected && styles.sortActive, sort.disabled && styles.disabled]}><Text style={styles.sortLabel}>{sort.label}</Text></Pressable>;
          })}
        </View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, gap: 8 },
  headingLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  title: { ...typography.body, fontWeight: '700', color: colors.brand.text, flexShrink: 1 },
  seeAll: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  link: { ...typography.caption, color: colors.brand.text, fontWeight: '700', textDecorationLine: 'underline' },
  carousel: { paddingHorizontal: spacing.md, gap: 12, paddingBottom: 12 },
  results: { paddingHorizontal: spacing.md, paddingTop: 18, paddingBottom: 6 },
  resultsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  count: { ...typography.caption, fontSize: 10, color: colors.brand.textSecondary },
  sorts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  sort: { minHeight: 48, flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 8, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: 24 },
  sortActive: { backgroundColor: colors.brand.surfaceMuted, borderColor: colors.primary[300] },
  sortLabel: { ...typography.caption, fontSize: 11, fontWeight: '700', color: colors.brand.text },
  disabled: { opacity: 0.5 },
});
