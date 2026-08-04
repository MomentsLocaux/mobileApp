import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  CalendarDays,
  Heart,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
} from 'lucide-react-native';
import { AppBackground } from '@/components/ui';
import { useAuth, useLocation } from '@/hooks';
import { SocialService } from '@/services/social.service';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLikesStore } from '@/store/likesStore';
import { useProposalsStore } from '@/store/proposalsStore';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import type { EventWithCreator } from '@/types/database';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { getEventImageUrls, getHumanizedDate } from '@/utils/event-card-display';
import { haptics } from '@/utils/haptics';
import { fetchProposalPool } from './proposal-pool';
import { ProposalSwipeDeck } from './ProposalSwipeDeck';
import { ProposalWizard } from './ProposalWizard';
import type { ProposalDecision, ProposalPreferences } from './proposal.types';

const MIN_LOADING_TRANSITION_MS = 550;

export default function ProposalsScreen() {
  const router = useRouter();
  const { profile, user, session } = useAuth();
  const {
    currentLocation,
    isLoading: locationLoading,
    requestPermission,
  } = useLocation();
  const categories = useTaxonomyStore((state) => state.categories);
  const loadTaxonomy = useTaxonomyStore((state) => state.load);
  const likedEventIds = useLikesStore((state) => state.likedEventIds);
  const toggleLike = useLikesStore((state) => state.toggleLike);

  const phase = useProposalsStore((state) => state.phase);
  const wizardStep = useProposalsStore((state) => state.wizardStep);
  const preferences = useProposalsStore((state) => state.preferences);
  const pool = useProposalsStore((state) => state.pool);
  const currentIndex = useProposalsStore((state) => state.currentIndex);
  const likedEvents = useProposalsStore((state) => state.likedEvents);
  const setWizardStep = useProposalsStore((state) => state.setWizardStep);
  const toggleCategory = useProposalsStore((state) => state.toggleCategory);
  const setRadius = useProposalsStore((state) => state.setRadius);
  const setAnchor = useProposalsStore((state) => state.setAnchor);
  const setDateWindow = useProposalsStore((state) => state.setDateWindow);
  const beginLoading = useProposalsStore((state) => state.beginLoading);
  const setPool = useProposalsStore((state) => state.setPool);
  const applyDecision = useProposalsStore((state) => state.applyDecision);
  const editPreferences = useProposalsStore((state) => state.editPreferences);

  const [wantsCurrentLocation, setWantsCurrentLocation] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processingDecision, setProcessingDecision] = useState(false);
  const [cardRevision, setCardRevision] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    void loadTaxonomy();
  }, [loadTaxonomy]);

  useEffect(() => {
    if (!currentLocation) return;
    if (!preferences.anchor || wantsCurrentLocation) {
      setAnchor({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        label: 'Ma position',
      });
      setWantsCurrentLocation(false);
    }
  }, [currentLocation, preferences.anchor, setAnchor, wantsCurrentLocation]);

  const categoryValues = useCallback((source: ProposalPreferences) => {
    const values = new Set<string>();
    source.categoryIds.forEach((id) => {
      values.add(id);
      const category = categories.find((item) => item.id === id);
      if (category?.slug) values.add(category.slug);
    });
    return Array.from(values);
  }, [categories]);

  const generatePool = useCallback(async (options?: { resetSession?: boolean }) => {
    const current = useProposalsStore.getState();
    if (!current.preferences.anchor) {
      setWizardStep(1);
      Alert.alert('Choisis un point de départ', 'Utilise ta position ou recherche une ville avant de continuer.');
      return;
    }

    const requestId = ++requestIdRef.current;
    const startedAt = Date.now();
    setLoadError(null);
    beginLoading(options);

    const exclusions = new Set(likedEventIds);
    if (!options?.resetSession) current.seenIds.forEach((id) => exclusions.add(id));

    try {
      const events = await fetchProposalPool({
        preferences: current.preferences,
        categoryValues: categoryValues(current.preferences),
        excludedIds: exclusions,
      });
      const remainingTransition = Math.max(0, MIN_LOADING_TRANSITION_MS - (Date.now() - startedAt));
      if (remainingTransition > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTransition));
      }
      if (requestId === requestIdRef.current) setPool(events);
    } catch (error) {
      console.warn('[Proposals] pool load failed', error);
      if (requestId === requestIdRef.current) {
        setLoadError('La recherche a rencontré un problème réseau. Tes critères sont conservés.');
        setPool([]);
      }
    }
  }, [beginLoading, categoryValues, likedEventIds, setPool, setWizardStep]);

  const handleCurrentLocation = useCallback(() => {
    haptics.selection();
    if (currentLocation) {
      setAnchor({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        label: 'Ma position',
      });
      return;
    }
    setWantsCurrentLocation(true);
    void requestPermission();
  }, [currentLocation, requestPermission, setAnchor]);

  const handleDecision = useCallback(async (decision: ProposalDecision) => {
    const state = useProposalsStore.getState();
    const event = state.pool[state.currentIndex];
    if (!event || processingDecision) return;

    if (decision === 'pass') {
      applyDecision(event, 'pass');
      return;
    }

    const userId = profile?.id || user?.id || session?.user?.id;
    if (!userId) {
      setCardRevision((value) => value + 1);
      Alert.alert('Connexion requise', 'Reconnecte-toi pour enregistrer ce coup de cœur.');
      return;
    }

    setProcessingDecision(true);
    try {
      let remoteLiked = await SocialService.like(userId, event.id);
      // If local state was stale and the first toggle removed a server-side like,
      // restore the intended final state: the swipe action always means “liked”.
      if (!remoteLiked) remoteLiked = await SocialService.like(userId, event.id);
      if (!remoteLiked) throw new Error('Like was not persisted');
      if (!useLikesStore.getState().isLiked(event.id)) toggleLike(event.id);
      applyDecision(event, 'like');
    } catch (error) {
      console.warn('[Proposals] like failed', error);
      setCardRevision((value) => value + 1);
      Alert.alert('Like non enregistré', 'La carte reste dans le deck. Réessaie dans un instant.');
    } finally {
      setProcessingDecision(false);
    }
  }, [applyDecision, processingDecision, profile?.id, session?.user?.id, toggleLike, user?.id]);

  const currentEvent = pool[currentIndex];
  const nextEvent = pool[currentIndex + 1];

  return (
    <GestureHandlerRootView style={styles.root}>
      <AppBackground />
      {phase === 'wizard' ? (
        <ProposalWizard
          step={wizardStep}
          preferences={preferences}
          categories={categories}
          locationLoading={locationLoading && wantsCurrentLocation}
          locationAvailable={Boolean(currentLocation)}
          onUseCurrentLocation={handleCurrentLocation}
          onStepChange={setWizardStep}
          onToggleCategory={toggleCategory}
          onRadiusChange={setRadius}
          onAnchorChange={setAnchor}
          onDateWindowChange={setDateWindow}
          onGenerate={() => void generatePool({ resetSession: true })}
        />
      ) : null}

      {phase === 'loading' ? <ProposalLoadingState /> : null}

      {phase === 'deck' && currentEvent && preferences.anchor ? (
        <ProposalSwipeDeck
          key={`${currentEvent.id}:${cardRevision}`}
          event={currentEvent}
          nextEvent={nextEvent}
          currentIndex={currentIndex}
          total={pool.length}
          anchor={preferences.anchor}
          categories={categories}
          disabled={processingDecision}
          onDecision={(decision) => void handleDecision(decision)}
          onOpenDetails={(eventId) => router.push(`/events/${eventId}` as any)}
        />
      ) : null}

      {phase === 'empty' ? (
        <ProposalEmptyState
          error={loadError}
          radiusKm={preferences.radiusKm}
          onRetry={() => void generatePool({ resetSession: false })}
          onRelax={() => {
            setRadius(50);
            editPreferences();
            setWizardStep(1);
          }}
        />
      ) : null}

      {phase === 'summary' ? (
        <ProposalSummary
          likedEvents={likedEvents}
          onMore={() => void generatePool({ resetSession: false })}
          onEdit={editPreferences}
          onFavorites={() => router.push('/(tabs)/favorites' as any)}
          onOpenDetails={(eventId) => router.push(`/events/${eventId}` as any)}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}

function ProposalLoadingState() {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1, false);
  }, [rotation]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 360}deg` }],
  }));

  return (
    <View style={styles.centeredState} accessibilityRole="progressbar">
      <View style={styles.loaderHalo}>
        <Animated.View style={animatedStyle}>
          <WandSparkles size={52} color={colors.brand.secondary} />
        </Animated.View>
      </View>
      <Text style={styles.stateEyebrow}>ROULEMENT DE TAMBOUR…</Text>
      <Text style={styles.stateTitle}>On prépare tes propositions</Text>
      <Text style={styles.stateSubtitle}>Nous recherchons les meilleurs événements autour de toi.</Text>
      <View style={styles.loadingDots}>
        <View style={styles.loadingDot} />
        <View style={[styles.loadingDot, styles.loadingDotMuted]} />
        <View style={[styles.loadingDot, styles.loadingDotFaint]} />
      </View>
    </View>
  );
}

function ProposalEmptyState({
  error,
  radiusKm,
  onRetry,
  onRelax,
}: {
  error: string | null;
  radiusKm: number;
  onRetry: () => void;
  onRelax: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.centeredState, { paddingTop: insets.top }]}> 
      <View style={styles.emptyIcon}>
        {error ? <RefreshCw size={42} color={colors.brand.secondary} /> : <MapPin size={42} color={colors.brand.secondary} />}
      </View>
      <Text style={styles.stateTitle}>{error ? 'La recherche a été interrompue' : 'Pas encore de match ici'}</Text>
      <Text style={styles.stateSubtitle}>
        {error || `Aucun événement ne correspond à tous tes critères dans un rayon de ${radiusKm} km.`}
      </Text>
      <TouchableOpacity style={styles.primaryAction} onPress={error ? onRetry : onRelax}>
        <Text style={styles.primaryActionText}>{error ? 'Réessayer' : 'Assouplir mes critères'}</Text>
      </TouchableOpacity>
      {error ? (
        <TouchableOpacity style={styles.secondaryAction} onPress={onRelax}>
          <SlidersHorizontal size={18} color={colors.brand.text} />
          <Text style={styles.secondaryActionText}>Modifier mes critères</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.secondaryAction} onPress={onRetry}>
          <RefreshCw size={18} color={colors.brand.text} />
          <Text style={styles.secondaryActionText}>Relancer la recherche</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ProposalSummary({
  likedEvents,
  onMore,
  onEdit,
  onFavorites,
  onOpenDetails,
}: {
  likedEvents: EventWithCreator[];
  onMore: () => void;
  onEdit: () => void;
  onFavorites: () => void;
  onOpenDetails: (eventId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { profile, user, session } = useAuth();
  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);

  const handleFavorite = async (event: EventWithCreator) => {
    const userId = profile?.id || user?.id || session?.user?.id;
    if (!userId || favoriteBusyId) return;
    setFavoriteBusyId(event.id);
    try {
      const remoteFavorite = await SocialService.toggleFavorite(userId, event.id);
      const localFavorite = useFavoritesStore.getState().isFavorite(event.id);
      if (remoteFavorite !== localFavorite) toggleFavorite(event);
      haptics.selection();
    } catch (error) {
      console.warn('[Proposals] favorite failed', error);
      Alert.alert('Favori non enregistré', 'Réessaie dans un instant.');
    } finally {
      setFavoriteBusyId(null);
    }
  };

  return (
    <View style={styles.summaryRoot}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.summaryContent, { paddingTop: insets.top + spacing.lg }]}
      >
        <View style={styles.summaryIcon}><Sparkles size={28} color={colors.brand.primary} /></View>
        <Text style={styles.stateEyebrow}>DECK TERMINÉ</Text>
        <Text style={styles.summaryTitle}>
          {likedEvents.length > 0
            ? `${likedEvents.length} coup${likedEvents.length > 1 ? 's' : ''} de cœur`
            : 'Pas de coup de cœur cette fois'}
        </Text>
        <Text style={styles.summarySubtitle}>
          {likedEvents.length > 0
            ? 'Tes likes sont enregistrés. Ajoute séparément les moments que tu veux garder dans tes favoris.'
            : 'On peut élargir la recherche ou repartir avec de nouvelles envies.'}
        </Text>

        <View style={styles.summaryList}>
          {likedEvents.map((event) => {
            const image = getEventImageUrls(event)[0];
            const date = getHumanizedDate(event);
            const favorite = isFavorite(event.id);
            return (
              <TouchableOpacity
                key={event.id}
                style={styles.summaryCard}
                onPress={() => onOpenDetails(event.id)}
                activeOpacity={0.82}
              >
                {image ? (
                  <Image source={{ uri: image }} style={styles.summaryImage} />
                ) : (
                  <View style={[styles.summaryImage, styles.summaryImageFallback]}>
                    <CalendarDays size={24} color={colors.brand.secondary} />
                  </View>
                )}
                <View style={styles.summaryCardCopy}>
                  <Text style={styles.summaryCardTitle} numberOfLines={2}>{event.title}</Text>
                  <Text style={styles.summaryCardDate} numberOfLines={1}>{date.startLine}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.favoriteButton, favorite && styles.favoriteButtonActive]}
                  onPress={(pressEvent) => {
                    pressEvent.stopPropagation();
                    void handleFavorite(event);
                  }}
                  disabled={favoriteBusyId === event.id}
                  accessibilityRole="button"
                  accessibilityLabel={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  {favoriteBusyId === event.id ? (
                    <ActivityIndicator size="small" color={colors.brand.secondary} />
                  ) : (
                    <Heart size={20} color={favorite ? colors.brand.primary : colors.brand.secondary} fill={favorite ? colors.brand.secondary : 'transparent'} />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.primaryAction} onPress={onMore}>
          <RefreshCw size={18} color={colors.brand.primary} />
          <Text style={styles.primaryActionText}>Encore 20</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={onEdit}>
          <SlidersHorizontal size={18} color={colors.brand.text} />
          <Text style={styles.secondaryActionText}>Modifier mes envies</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.textAction} onPress={onFavorites}>
          <Heart size={17} color={colors.brand.secondary} />
          <Text style={styles.textActionText}>Voir mes favoris</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brand.primary },
  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  loaderHalo: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl, backgroundColor: '#122c33', borderWidth: 1, borderColor: '#1f5360' },
  stateEyebrow: { ...typography.label, fontSize: 11, letterSpacing: 1.4, color: colors.brand.secondary, textAlign: 'center' },
  stateTitle: { ...typography.h3, color: colors.brand.text, textAlign: 'center', marginTop: spacing.sm },
  stateSubtitle: { ...typography.body, color: colors.brand.textSecondary, textAlign: 'center', marginTop: spacing.sm, maxWidth: 440 },
  loadingDots: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  loadingDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand.secondary },
  loadingDotMuted: { opacity: 0.55 },
  loadingDotFaint: { opacity: 0.25 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg, backgroundColor: colors.brand.surface },
  primaryAction: { minHeight: 54, width: '100%', maxWidth: 440, marginTop: spacing.xl, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: borderRadius.full, backgroundColor: colors.brand.secondary },
  primaryActionText: { ...typography.bodyBold, color: colors.brand.primary },
  secondaryAction: { minHeight: 52, width: '100%', maxWidth: 440, marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: borderRadius.full, borderWidth: 1, borderColor: '#475569' },
  secondaryActionText: { ...typography.label, color: colors.brand.text },
  summaryRoot: { flex: 1 },
  summaryContent: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 120 },
  summaryIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, backgroundColor: colors.brand.secondary },
  summaryTitle: { ...typography.h2, color: colors.brand.text, textAlign: 'center', marginTop: spacing.sm },
  summarySubtitle: { ...typography.body, color: colors.brand.textSecondary, textAlign: 'center', marginTop: spacing.sm, maxWidth: 500 },
  summaryList: { width: '100%', maxWidth: 520, marginTop: spacing.xl, gap: spacing.sm },
  summaryCard: { minHeight: 84, flexDirection: 'row', alignItems: 'center', padding: spacing.sm, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#334155', backgroundColor: colors.brand.surface },
  summaryImage: { width: 68, height: 68, borderRadius: borderRadius.md, backgroundColor: '#243136' },
  summaryImageFallback: { alignItems: 'center', justifyContent: 'center' },
  summaryCardCopy: { flex: 1, marginHorizontal: spacing.md },
  summaryCardTitle: { ...typography.h6, color: colors.brand.text },
  summaryCardDate: { ...typography.bodySmall, color: colors.brand.textSecondary, marginTop: 3 },
  favoriteButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#365867' },
  favoriteButtonActive: { backgroundColor: colors.brand.secondary, borderColor: colors.brand.secondary },
  textAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, padding: spacing.sm },
  textActionText: { ...typography.label, color: colors.brand.secondary },
});
