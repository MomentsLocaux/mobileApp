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
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLikesStore } from '@/store/likesStore';
import { useProposalsStore } from '@/store/proposalsStore';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import type { EventWithCreator } from '@/types/database';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { getEventImageUrls, getHumanizedDate } from '@/utils/event-card-display';
import {
  ensureEventHearted,
  removeEventHeart,
  syncHeartStores,
  toggleEventHeart,
} from '@/utils/event-heart';
import { haptics } from '@/utils/haptics';
import { fetchProposalPool } from './proposal-pool';
import { ProposalSwipeDeck } from './ProposalSwipeDeck';
import { ProposalWizard } from './ProposalWizard';
import { ProposalHistory } from './ProposalHistory';
import { ProposalSessionEntry } from './ProposalSessionEntry';
import { getSessionCreatedHeartEvents } from './proposal-session-history';
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
  const favoriteEvents = useFavoritesStore((state) => state.favorites);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  const phase = useProposalsStore((state) => state.phase);
  const hasHydrated = useProposalsStore((state) => state.hasHydrated);
  const wizardStep = useProposalsStore((state) => state.wizardStep);
  const preferences = useProposalsStore((state) => state.preferences);
  const pool = useProposalsStore((state) => state.pool);
  const currentIndex = useProposalsStore((state) => state.currentIndex);
  const likedEvents = useProposalsStore((state) => state.likedEvents);
  const sessions = useProposalsStore((state) => state.sessions);
  const activeSessionId = useProposalsStore((state) => state.activeSessionId);
  const selectedSessionId = useProposalsStore((state) => state.selectedSessionId);
  const setWizardStep = useProposalsStore((state) => state.setWizardStep);
  const toggleCategory = useProposalsStore((state) => state.toggleCategory);
  const setCategories = useProposalsStore((state) => state.setCategories);
  const setRadius = useProposalsStore((state) => state.setRadius);
  const setAnchor = useProposalsStore((state) => state.setAnchor);
  const setDateWindow = useProposalsStore((state) => state.setDateWindow);
  const beginLoading = useProposalsStore((state) => state.beginLoading);
  const setPool = useProposalsStore((state) => state.setPool);
  const applyDecision = useProposalsStore((state) => state.applyDecision);
  const reviseDecision = useProposalsStore((state) => state.reviseDecision);
  const pauseSession = useProposalsStore((state) => state.pauseSession);
  const resumeSession = useProposalsStore((state) => state.resumeSession);
  const startNewSession = useProposalsStore((state) => state.startNewSession);
  const showEntry = useProposalsStore((state) => state.showEntry);
  const showHistory = useProposalsStore((state) => state.showHistory);
  const selectHistorySession = useProposalsStore((state) => state.selectHistorySession);
  const editPreferences = useProposalsStore((state) => state.editPreferences);
  const deleteSessions = useProposalsStore((state) => state.deleteSessions);

  const [wantsCurrentLocation, setWantsCurrentLocation] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processingDecision, setProcessingDecision] = useState(false);
  const [historyBusyEventId, setHistoryBusyEventId] = useState<string | null>(null);
  const [historyDeleteBusy, setHistoryDeleteBusy] = useState(false);
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
    favoriteEvents.forEach((event) => exclusions.add(event.id));
    current.sessions.forEach((proposalSession) => {
      proposalSession.decisions.forEach((item) => exclusions.add(item.event.id));
    });
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
  }, [beginLoading, categoryValues, favoriteEvents, likedEventIds, setPool, setWizardStep]);

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
      const before = {
        isLiked: useLikesStore.getState().isLiked(event.id) || Boolean(event.is_liked),
        isFavorite: useFavoritesStore.getState().isFavorite(event.id) || Boolean(event.is_favorited),
      };
      const after = await ensureEventHearted(userId, event, before);
      syncHeartStores(event, before, after, { toggleLike, toggleFavorite });
      applyDecision(event, 'like', {
        heartCreatedBySession: !before.isLiked && !before.isFavorite,
      });
    } catch (error) {
      console.warn('[Proposals] heart failed', error);
      setCardRevision((value) => value + 1);
      Alert.alert(
        'Coup de cœur non enregistré',
        'Le like et le favori n’ont pas pu être enregistrés. La carte reste dans le deck.',
      );
    } finally {
      setProcessingDecision(false);
    }
  }, [applyDecision, processingDecision, profile?.id, session?.user?.id, toggleFavorite, toggleLike, user?.id]);

  const currentEvent = pool[currentIndex];
  const nextEvent = pool[currentIndex + 1];

  const handleReviseDecision = useCallback(async (
    sessionId: string,
    eventId: string,
    nextDecision: ProposalDecision,
  ) => {
    const proposalSession = useProposalsStore.getState().sessions.find((item) => item.id === sessionId);
    const existing = proposalSession?.decisions.find((item) => item.event.id === eventId);
    if (!existing || existing.decision === nextDecision || historyBusyEventId) return;

    const userId = profile?.id || user?.id || session?.user?.id;
    if (!userId) {
      Alert.alert('Connexion requise', 'Reconnecte-toi pour modifier ce choix.');
      return;
    }

    setHistoryBusyEventId(eventId);
    try {
      const event = existing.event;
      const before = {
        isLiked: useLikesStore.getState().isLiked(event.id),
        isFavorite: useFavoritesStore.getState().isFavorite(event.id),
      };
      let after = before;
      if (nextDecision === 'like') {
        after = await ensureEventHearted(userId, event, before);
      } else if (before.isLiked || before.isFavorite) {
        after = await toggleEventHeart(userId, event, before);
      }
      syncHeartStores(event, before, after, { toggleLike, toggleFavorite });
      reviseDecision(sessionId, eventId, nextDecision, {
        heartCreatedBySession:
          nextDecision === 'like' && !before.isLiked && !before.isFavorite,
      });
      haptics.selection();
    } catch (error) {
      console.warn('[Proposals] history revision failed', error);
      Alert.alert('Choix non modifié', 'La synchronisation du cœur a échoué. Réessaie dans un instant.');
    } finally {
      setHistoryBusyEventId(null);
    }
  }, [historyBusyEventId, profile?.id, reviseDecision, session?.user?.id, toggleFavorite, toggleLike, user?.id]);

  const deleteProposalHistory = useCallback(async (
    sessionIds: string[],
    removeCreatedHearts: boolean,
  ) => {
    if (historyDeleteBusy) return;
    const targetIds = new Set(sessionIds);
    const targetSessions = useProposalsStore.getState().sessions.filter((item) =>
      targetIds.has(item.id),
    );
    if (targetSessions.length === 0) return;

    const userId = profile?.id || user?.id || session?.user?.id;
    if (removeCreatedHearts && !userId) {
      Alert.alert(
        'Connexion requise',
        'Reconnecte-toi pour retirer les coups de cœur liés à ces sessions.',
      );
      return;
    }

    setHistoryDeleteBusy(true);
    try {
      if (removeCreatedHearts && userId) {
        const events = getSessionCreatedHeartEvents(targetSessions);
        for (const event of events) {
          const before = {
            isLiked: useLikesStore.getState().isLiked(event.id),
            isFavorite: useFavoritesStore.getState().isFavorite(event.id),
          };
          const after = await removeEventHeart(userId, event.id);
          syncHeartStores(event, before, after, { toggleLike, toggleFavorite });
        }
      }
      deleteSessions(sessionIds);
      haptics.selection();
    } catch (error) {
      console.warn('[Proposals] history deletion failed', error);
      Alert.alert(
        'Suppression incomplète',
        'Certains coups de cœur n’ont pas pu être retirés. L’historique a été conservé pour te permettre de réessayer.',
      );
    } finally {
      setHistoryDeleteBusy(false);
    }
  }, [deleteSessions, historyDeleteBusy, profile?.id, session?.user?.id, toggleFavorite, toggleLike, user?.id]);

  const confirmHistoryDeletion = useCallback((sessionIds: string[]) => {
    const count = sessionIds.length;
    Alert.alert(
      count > 1 ? 'Supprimer tout l’historique ?' : 'Supprimer cette session ?',
      'Tu peux conserver tes coups de cœur, ou retirer aussi ceux créés pendant ces sessions. Tes autres favoris resteront intacts.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Garder les favoris',
          onPress: () => void deleteProposalHistory(sessionIds, false),
        },
        {
          text: 'Retirer les favoris',
          style: 'destructive',
          onPress: () => void deleteProposalHistory(sessionIds, true),
        },
      ],
    );
  }, [deleteProposalHistory]);

  if (!hasHydrated) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <AppBackground />
        <ProposalLoadingState title="Nous retrouvons tes propositions" subtitle="Ta progression est en cours de restauration." />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <AppBackground />
      {phase === 'entry' ? (
        <ProposalSessionEntry
          sessions={sessions}
          activeSessionId={activeSessionId}
          onResume={resumeSession}
          onStartNew={startNewSession}
          onHistory={() => showHistory()}
        />
      ) : null}

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
          onSelectAllCategories={setCategories}
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
          onPause={pauseSession}
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
          onHistory={() => showHistory()}
          onOpenDetails={(eventId) => router.push(`/events/${eventId}` as any)}
        />
      ) : null}

      {phase === 'history' ? (
        <ProposalHistory
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          busyEventId={historyBusyEventId}
          deleteBusy={historyDeleteBusy}
          onBack={showEntry}
          onSelectSession={selectHistorySession}
          onResume={resumeSession}
          onDeleteSession={(sessionId) => confirmHistoryDeletion([sessionId])}
          onDeleteAll={() => confirmHistoryDeletion(sessions.map((item) => item.id))}
          onRevise={(sessionId, eventId, decision) => void handleReviseDecision(sessionId, eventId, decision)}
          onOpenDetails={(eventId) => router.push(`/events/${eventId}` as any)}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}

function ProposalLoadingState({
  title = 'On prépare tes propositions',
  subtitle = 'Nous recherchons les meilleurs événements autour de toi.',
}: {
  title?: string;
  subtitle?: string;
}) {
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
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateSubtitle}>{subtitle}</Text>
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
  onHistory,
  onOpenDetails,
}: {
  likedEvents: EventWithCreator[];
  onMore: () => void;
  onEdit: () => void;
  onFavorites: () => void;
  onHistory: () => void;
  onOpenDetails: (eventId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { profile, user, session } = useAuth();
  const isLiked = useLikesStore((state) => state.isLiked);
  const toggleLike = useLikesStore((state) => state.toggleLike);
  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const [heartBusyId, setHeartBusyId] = useState<string | null>(null);

  const handleHeart = async (event: EventWithCreator) => {
    const userId = profile?.id || user?.id || session?.user?.id;
    if (!userId || heartBusyId) return;
    setHeartBusyId(event.id);
    try {
      const before = {
        isLiked: useLikesStore.getState().isLiked(event.id),
        isFavorite: useFavoritesStore.getState().isFavorite(event.id),
      };
      const after = await toggleEventHeart(userId, event, before);
      syncHeartStores(event, before, after, { toggleLike, toggleFavorite });
      haptics.selection();
    } catch (error) {
      console.warn('[Proposals] heart failed', error);
      Alert.alert('Coup de cœur non enregistré', 'Réessaie dans un instant.');
    } finally {
      setHeartBusyId(null);
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
            ? 'Tes coups de cœur ont été ajoutés à tes favoris.'
            : 'On peut élargir la recherche ou repartir avec de nouvelles envies.'}
        </Text>

        <View style={styles.summaryList}>
          {likedEvents.map((event) => {
            const image = getEventImageUrls(event)[0];
            const date = getHumanizedDate(event);
            const hearted = isFavorite(event.id) || isLiked(event.id);
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
                  style={[styles.favoriteButton, hearted && styles.favoriteButtonActive]}
                  onPress={(pressEvent) => {
                    pressEvent.stopPropagation();
                    void handleHeart(event);
                  }}
                  disabled={heartBusyId === event.id}
                  accessibilityRole="button"
                  accessibilityLabel={hearted ? 'Retirer des coups de cœur' : 'Ajouter aux coups de cœur'}
                >
                  {heartBusyId === event.id ? (
                    <ActivityIndicator size="small" color={colors.brand.secondary} />
                  ) : (
                    <Heart size={20} color={hearted ? colors.brand.primary : colors.brand.secondary} fill={hearted ? colors.brand.secondary : 'transparent'} />
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
        <TouchableOpacity style={styles.textAction} onPress={onHistory}>
          <CalendarDays size={17} color={colors.brand.secondary} />
          <Text style={styles.textActionText}>Voir mon historique</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brand.page },
  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  loaderHalo: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl, backgroundColor: colors.brand.surfaceMuted, borderWidth: 1, borderColor: 'rgba(124, 181, 24, 0.35)' },
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
