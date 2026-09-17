import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { getCategoryColor } from '@/constants/categories';
import { pickCategoryMetaSlug } from '@/constants/category-visuals';
import type { EventWithCreator } from '@/types/database';
import { EventCoverImage } from '@/components/events/EventCoverImage';
import { EventCoverPlaceholder } from '@/components/events/EventCoverPlaceholder';
import { getEventImageUrls } from '@/utils/event-card-display';
import { getEventCardSchedule } from '@/utils/event-card-meta';
import { useTaxonomyStore } from '@/store/taxonomyStore';

const THUMB_WIDTH = 132;
const COVER_HEIGHT = 88;
const CATEGORY_RING_WIDTH = 2;

type Props = {
  title: string;
  events: EventWithCreator[];
  onPressEvent: (event: EventWithCreator) => void;
  loading?: boolean;
  padded?: boolean;
  /** Home « Derniers ajoutés » hides the date to stay compact and curiosity-driven. */
  showDate?: boolean;
  /** Outline the cover with the event category color (Home « Derniers ajoutés »). */
  showCategoryBorder?: boolean;
};

export function EventMiniatureCarousel({
  title,
  events,
  onPressEvent,
  loading = false,
  padded = false,
  showDate = true,
  showCategoryBorder = false,
}: Props) {
  const showSpinner = loading && events.length === 0;
  if (!showSpinner && events.length === 0) return null;

  return (
    <View style={[styles.section, !showDate && styles.sectionCompact]}>
      <Text style={[styles.title, padded && styles.titlePadded]}>{title}</Text>
      {showSpinner ? (
        <ActivityIndicator color={colors.brand.secondary} style={styles.spinner} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.row, padded && styles.rowPadded]}
        >
          {events.map((event) => (
            <MiniatureCard
              key={event.id}
              event={event}
              showDate={showDate}
              showCategoryBorder={showCategoryBorder}
              onPress={() => onPressEvent(event)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function MiniatureCard({
  event,
  showDate,
  showCategoryBorder,
  onPress,
}: {
  event: EventWithCreator;
  showDate: boolean;
  showCategoryBorder: boolean;
  onPress: () => void;
}) {
  const categoriesMap = useTaxonomyStore((s) => s.categoriesMap);
  const coverUri = useMemo(() => getEventImageUrls(event)[0] ?? null, [event]);
  const schedule = useMemo(
    () => (showDate ? getEventCardSchedule(event, 'compact') : null),
    [event, showDate],
  );
  const categoryKey = pickCategoryMetaSlug(event.category_meta) || event.category || '';
  const ringColor = showCategoryBorder
    ? getCategoryColor(categoriesMap[categoryKey]?.slug || categoryKey)
    : null;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, !showDate && styles.cardCompact]}
      accessibilityRole="button"
      accessibilityLabel={event.title}
    >
      <View
        style={[
          styles.cover,
          ringColor ? { borderColor: ringColor, borderWidth: CATEGORY_RING_WIDTH } : null,
        ]}
      >
        {coverUri ? (
          <EventCoverImage
            uri={coverUri}
            variant="list"
            recyclingKey={event.id}
            style={styles.coverImage}
          />
        ) : (
          <EventCoverPlaceholder category={event.category} height={COVER_HEIGHT} style={styles.coverImage} />
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={showDate ? 2 : 1}>
        {event.title}
      </Text>
      {schedule ? (
        <Text style={styles.cardMeta} numberOfLines={1}>
          {schedule.start}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionCompact: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
  },
  titlePadded: {
    paddingHorizontal: spacing.md,
  },
  spinner: {
    marginVertical: spacing.md,
  },
  row: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  rowPadded: {
    paddingHorizontal: spacing.md,
  },
  card: {
    width: THUMB_WIDTH,
    gap: 6,
  },
  cardCompact: {
    gap: 4,
  },
  cover: {
    width: THUMB_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.brand.surfaceMuted,
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  cardTitle: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
    lineHeight: 18,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
});
