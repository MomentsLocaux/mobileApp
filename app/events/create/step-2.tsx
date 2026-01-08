import React, { useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/theme';
import { CategorySelector } from '@/components/events/CategorySelector';
import { TagsSelector } from '@/components/events/TagsSelector';
import { VisibilitySelector } from '@/components/events/VisibilitySelector';
import { OptionalInfoSection } from '@/components/events/OptionalInfoSection';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { useAuth } from '@/hooks';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { useAutoScrollOnFocus } from '@/hooks/useAutoScrollOnFocus';

export default function CreateEventStep2() {
  const router = useRouter();
  const { session } = useAuth();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const title = useCreateEventStore((s) => s.title);
  const startDate = useCreateEventStore((s) => s.startDate);
  const location = useCreateEventStore((s) => s.location);
  const category = useCreateEventStore((s) => s.category);
  const subcategory = useCreateEventStore((s) => s.subcategory);
  const tags = useCreateEventStore((s) => s.tags);
  const visibility = useCreateEventStore((s) => s.visibility);
  const price = useCreateEventStore((s) => s.price);
  const duration = useCreateEventStore((s) => s.duration);
  const contact = useCreateEventStore((s) => s.contact);
  const externalLink = useCreateEventStore((s) => s.externalLink);
  const setCategory = useCreateEventStore((s) => s.setCategory);
  const setSubcategory = useCreateEventStore((s) => s.setSubcategory);
  const setTags = useCreateEventStore((s) => s.setTags);
  const setVisibility = useCreateEventStore((s) => s.setVisibility);
  const setPrice = useCreateEventStore((s) => s.setPrice);
  const setDuration = useCreateEventStore((s) => s.setDuration);
  const setContact = useCreateEventStore((s) => s.setContact);
  const setExternalLink = useCreateEventStore((s) => s.setExternalLink);
  const insets = useSafeAreaInsets();
  const { scrollViewRef, registerFieldRef, handleInputFocus, handleScroll } = useAutoScrollOnFocus();

  const sectionPositions = useRef({
    subcategory: 0,
    tags: 0,
    visibility: 0,
    optional: 0,
  });

  const registerSection = useCallback((key: keyof typeof sectionPositions.current) => {
    return (event: LayoutChangeEvent) => {
      sectionPositions.current[key] = event.nativeEvent.layout.y;
    };
  }, []);

  const scrollToSection = useCallback(
    (key: keyof typeof sectionPositions.current) => {
      const y = sectionPositions.current[key];
      if (!scrollViewRef.current) return;
      scrollViewRef.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
    },
    [scrollViewRef]
  );

  const canPublish = useMemo(() => !!category && !!title && !!startDate && !!location, [
    category,
    title,
    startDate,
    location,
  ]);
  const isGuest = !session;

  if (isGuest) {
    return (
      <SafeAreaView style={styles.safe}>
        <GuestGateModal
          visible
          title="Créer un événement"
          onClose={() => router.replace('/(tabs)/map')}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <ChevronLeft size={20} color={colors.neutral[800]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Détails de l'événement</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <CategorySelector
            selected={category}
            subcategory={subcategory}
            onSelect={(value) => {
              setCategory(value);
              requestAnimationFrame(() => scrollToSection('subcategory'));
            }}
            onSelectSubcategory={(value) => {
              setSubcategory(value);
              requestAnimationFrame(() => scrollToSection('tags'));
            }}
            onSubcategoryLayout={registerSection('subcategory')}
          />
          <View onLayout={registerSection('tags')}>
            <TagsSelector
              selected={tags}
              onChange={(next) => {
                setTags(next);
                if (next.length > 0) {
                  requestAnimationFrame(() => scrollToSection('visibility'));
                }
              }}
            />
          </View>
          <View onLayout={registerSection('visibility')}>
            <VisibilitySelector value={visibility} onChange={setVisibility} />
          </View>
          <View onLayout={registerSection('optional')}>
            <OptionalInfoSection
              price={price}
              duration={duration}
              contact={contact}
              externalLink={externalLink}
              onOpen={() => requestAnimationFrame(() => scrollToSection('optional'))}
              onInputFocus={handleInputFocus}
              onInputRef={registerFieldRef}
              onChange={(data) => {
                if (data.price !== undefined) setPrice(data.price);
                if (data.duration !== undefined) setDuration(data.duration);
                if (data.contact !== undefined) setContact(data.contact);
                if (data.externalLink !== undefined) setExternalLink(data.externalLink);
              }}
            />
          </View>
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
      </KeyboardAvoidingView>
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
    minWidth: 64,
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
