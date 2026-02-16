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
            <ChevronLeft size={20} color={colors.brand.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Détails de l'événement</Text>
            <Text style={styles.headerSubtitle}>Étape 2 sur 3</Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: '66%' }]} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <Text style={styles.sectionTitle}>Catégorie & Visibilité</Text>
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
            <View style={styles.togglesContainer}>
              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.toggleLabel}>Places limitées</Text>
                  <Text style={styles.toggleSubLabel}>Définir un nombre maximum de participants</Text>
                </View>
                {/* Switch component placeholder - using View for now as standard Switch isn't imported */}
                <View style={[styles.switchTrack, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <View style={[styles.switchThumb, { transform: [{ translateX: 2 }] }]} />
                </View>
              </View>
              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.toggleLabel}>Inscription requise</Text>
                  <Text style={styles.toggleSubLabel}>Valider chaque demande manuellement</Text>
                </View>
                <View style={[styles.switchTrack, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <View style={[styles.switchThumb, { transform: [{ translateX: 2 }] }]} />
                </View>
              </View>
            </View>
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
          <TouchableOpacity style={styles.prevBtn} onPress={() => router.back()}>
            <Text style={styles.prevText}>Précédent</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextBtn, !canPublish && styles.nextBtnDisabled]}
            disabled={!canPublish}
            onPress={() =>
              router.push({
                pathname: '/events/create/preview',
                params: edit ? { edit } : {},
              } as any)
            }
          >
            <Text style={styles.nextText}>Continuer</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.brand.primary,
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
    color: colors.brand.text,
    fontWeight: '700',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#1e293b',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.brand.secondary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.brand.primary,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    gap: spacing.md,
  },
  prevBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  prevText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  nextBtn: {
    flex: 1,
    backgroundColor: colors.brand.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  nextBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  nextText: {
    ...typography.body,
    color: '#0f1719',
    fontWeight: '700',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.h6,
    color: colors.brand.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  togglesContainer: {
    gap: spacing.md,
    backgroundColor: colors.brand.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
  },
  toggleSubLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    maxWidth: 200,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
    elevation: 2,
  },
});
