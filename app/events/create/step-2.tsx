import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/theme';
import { CategorySelector } from '@/components/events/CategorySelector';
import { TagsSelector } from '@/components/events/TagsSelector';
import { VisibilitySelector } from '@/components/events/VisibilitySelector';
import { OptionalInfoSection } from '@/components/events/OptionalInfoSection';
import { EventPreviewMiniMap } from '@/components/events/EventPreviewMiniMap';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';

export default function CreateEventStep2() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const coverImage = useCreateEventStore((s) => s.coverImage);
  const title = useCreateEventStore((s) => s.title);
  const startDate = useCreateEventStore((s) => s.startDate);
  const endDate = useCreateEventStore((s) => s.endDate);
  const location = useCreateEventStore((s) => s.location);
  const description = useCreateEventStore((s) => s.description);
  const category = useCreateEventStore((s) => s.category);
  const subcategory = useCreateEventStore((s) => s.subcategory);
  const tags = useCreateEventStore((s) => s.tags);
  const visibility = useCreateEventStore((s) => s.visibility);
  const price = useCreateEventStore((s) => s.price);
  const duration = useCreateEventStore((s) => s.duration);
  const contact = useCreateEventStore((s) => s.contact);
  const externalLink = useCreateEventStore((s) => s.externalLink);
  const videoLink = useCreateEventStore((s) => s.videoLink);
  const gallery = useCreateEventStore((s) => s.gallery);
  const setCategory = useCreateEventStore((s) => s.setCategory);
  const setSubcategory = useCreateEventStore((s) => s.setSubcategory);
  const setTags = useCreateEventStore((s) => s.setTags);
  const setVisibility = useCreateEventStore((s) => s.setVisibility);
  const setPrice = useCreateEventStore((s) => s.setPrice);
  const setDuration = useCreateEventStore((s) => s.setDuration);
  const setContact = useCreateEventStore((s) => s.setContact);
  const setExternalLink = useCreateEventStore((s) => s.setExternalLink);

  const dateLabel = useMemo(() => {
    if (!startDate) return '';
    const d = new Date(startDate);
    return d.toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [startDate]);

  const canPublish = useMemo(() => !!category && !!title && !!startDate && !!location, [
    category,
    title,
    startDate,
    location,
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.neutral[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails de l'événement</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CategorySelector
          selected={category}
          subcategory={subcategory}
          onSelect={setCategory}
          onSelectSubcategory={setSubcategory}
        />
        <TagsSelector selected={tags} onChange={setTags} />
        <VisibilitySelector value={visibility} onChange={setVisibility} />
        <OptionalInfoSection
          price={price}
          duration={duration}
          contact={contact}
          externalLink={externalLink}
          onChange={(data) => {
            if (data.price !== undefined) setPrice(data.price);
            if (data.duration !== undefined) setDuration(data.duration);
            if (data.contact !== undefined) setContact(data.contact);
            if (data.externalLink !== undefined) setExternalLink(data.externalLink);
          }}
        />
        <EventPreviewMiniMap
          coverUrl={coverImage?.publicUrl}
          title={title}
          dateLabel={dateLabel}
          category={category}
          city={location?.city}
          location={location}
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.publishBtn, !canPublish && styles.publishDisabled]}
          disabled={!canPublish}
          onPress={() =>
            router.push({
              pathname: '/events/create/preview',
              params: edit ? { edit } : {},
            } as any)
          }
        >
          <Text style={styles.publishText}>Publier l'événement</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  headerBtn: {
    padding: spacing.sm,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h5,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  footer: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
  },
  publishBtn: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  publishDisabled: {
    backgroundColor: colors.neutral[300],
  },
  publishText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
});
