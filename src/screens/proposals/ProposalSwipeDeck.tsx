import React, { useEffect, useMemo } from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Heart, MapPin, PauseCircle, ThumbsDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Category } from '@/store/taxonomyStore';
import type { EventWithCreator } from '@/types/database';
import { getCategoryColor, getCategoryTextColor } from '@/constants/categories';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';
import {
  getEventDescriptionPreview,
  getEventImageUrls,
  getEventLocationLabel,
  getHumanizedDate,
} from '@/utils/event-card-display';
import { distanceBetweenKm } from './proposal-filtering';
import { getProposalCategoryLabel } from './proposal-category-display';
import type { ProposalAnchor, ProposalDecision } from './proposal.types';

type Props = {
  event: EventWithCreator;
  nextEvent?: EventWithCreator;
  currentIndex: number;
  total: number;
  anchor: ProposalAnchor;
  categories: Category[];
  disabled?: boolean;
  onDecision: (decision: ProposalDecision) => void;
  onPause: () => void;
  onOpenDetails: (eventId: string) => void;
};

const SWIPE_THRESHOLD = 105;

export function ProposalSwipeDeck({
  event,
  nextEvent,
  currentIndex,
  total,
  anchor,
  categories,
  disabled = false,
  onDecision,
  onPause,
  onOpenDetails,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const decisionLocked = useSharedValue(0);
  const categoryMap = useMemo(
    () => new Map(categories.flatMap((category) => [[category.id, category], [category.slug, category]])),
    [categories],
  );
  const cardWidth = Math.min(width - spacing.lg * 2, 480);
  const cardHeight = Math.min(Math.max(height * 0.56, 430), 590);

  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
    decisionLocked.value = 0;
    const nextImage = nextEvent ? getEventImageUrls(nextEvent)[0] : null;
    if (nextImage) void Image.prefetch(nextImage).catch(() => undefined);
  }, [decisionLocked, event.id, nextEvent, translateX, translateY]);

  const finishDecision = (decision: ProposalDecision) => {
    onDecision(decision);
  };

  const animateDecision = (decision: ProposalDecision) => {
    if (disabled || decisionLocked.value === 1) return;
    decisionLocked.value = 1;
    if (decision === 'like') haptics.success();
    else haptics.light();
    const target = decision === 'like' ? width * 1.4 : -width * 1.4;
    translateX.value = withTiming(target, { duration: 230 }, (finished) => {
      if (finished) runOnJS(finishDecision)(decision);
    });
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-12, 12])
    .onUpdate((gesture) => {
      translateX.value = gesture.translationX;
      translateY.value = gesture.translationY * 0.18;
    })
    .onEnd((gesture) => {
      if (decisionLocked.value === 1) return;
      if (gesture.translationX > SWIPE_THRESHOLD || gesture.velocityX > 900) {
        decisionLocked.value = 1;
        translateX.value = withTiming(width * 1.4, { duration: 220 }, (finished) => {
          if (finished) runOnJS(finishDecision)('like');
        });
        runOnJS(haptics.success)();
        return;
      }
      if (gesture.translationX < -SWIPE_THRESHOLD || gesture.velocityX < -900) {
        decisionLocked.value = 1;
        translateX.value = withTiming(-width * 1.4, { duration: 220 }, (finished) => {
          if (finished) runOnJS(finishDecision)('pass');
        });
        runOnJS(haptics.light)();
        return;
      }
      translateX.value = withSpring(0, { damping: 16, stiffness: 180 });
      translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-width, 0, width], [-12, 0, 12], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, -20], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}> 
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>TES PROPOSITIONS</Text>
          <Text style={styles.headerTitle}>À toi de jouer</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.pauseButton}
            onPress={onPause}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Arrêter et reprendre plus tard"
          >
            <PauseCircle size={17} color={colors.brand.secondary} />
            <Text style={styles.pauseText}>Arrêter</Text>
          </TouchableOpacity>
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>{Math.min(currentIndex + 1, total)} / {total}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.deck, { height: cardHeight + 20 }]}> 
        {nextEvent ? (
          <View style={[styles.card, styles.nextCard, { width: cardWidth, height: cardHeight }]}>
            <ProposalCardContent event={nextEvent} anchor={anchor} categoryMap={categoryMap} />
          </View>
        ) : null}

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.card, { width: cardWidth, height: cardHeight }, cardStyle]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => onOpenDetails(event.id)}
              accessibilityRole="button"
              accessibilityLabel={`Voir le détail de ${event.title}`}
            >
              <ProposalCardContent event={event} anchor={anchor} categoryMap={categoryMap} />
            </Pressable>
            <Animated.View pointerEvents="none" style={[styles.decisionStamp, styles.likeStamp, likeStyle]}>
              <Heart size={22} color="#052d21" fill="#052d21" />
              <Text style={styles.likeStampText}>J’AIME</Text>
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.decisionStamp, styles.passStamp, passStyle]}>
              <ThumbsDown size={22} color="#451a1a" />
              <Text style={styles.passStampText}>JE PASSE</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>

      <Text style={styles.instruction}>Glisse à droite pour aimer · à gauche pour passer</Text>
      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}> 
        <TouchableOpacity
          style={[styles.actionButton, styles.passButton]}
          onPress={() => animateDecision('pass')}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Je passe cet événement"
          accessibilityHint="Même action qu’un glissement vers la gauche"
        >
          <ThumbsDown size={28} color="#fb7185" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={() => animateDecision('like')}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="J’aime cet événement"
          accessibilityHint="Même action qu’un glissement vers la droite"
        >
          <Heart size={30} color="#34d399" fill="#34d399" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ProposalCardContent({
  event,
  anchor,
  categoryMap,
}: {
  event: EventWithCreator;
  anchor: ProposalAnchor;
  categoryMap: Map<string, Category>;
}) {
  const image = getEventImageUrls(event)[0];
  const date = getHumanizedDate(event);
  const category = categoryMap.get(event.category || '');
  const categoryColor = category ? getCategoryColor(category.slug) : undefined;
  const categoryTextColor = category ? getCategoryTextColor(category.slug) : undefined;
  const description = getEventDescriptionPreview(event.description, 105);
  const distance = distanceBetweenKm(anchor, {
    latitude: event.latitude,
    longitude: event.longitude,
  });
  const location = getEventLocationLabel(event);

  const content = (
    <>
      {!image ? (
        <View style={styles.imageFallback}>
          <Text style={styles.imageFallbackEmoji}>{category?.icon || '✨'}</Text>
        </View>
      ) : null}
      <LinearGradient
        colors={['transparent', 'rgba(7, 13, 15, 0.25)', 'rgba(7, 13, 15, 0.98)']}
        locations={[0.28, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cardContent}>
        <View style={styles.badgeRow}>
          {category ? (
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
              <Text style={[styles.categoryBadgeText, { color: categoryTextColor }]}>
                {getProposalCategoryLabel(category)}
              </Text>
            </View>
          ) : null}
          <View style={styles.distanceBadge}>
            <MapPin size={13} color={colors.brand.textSecondary} />
            <Text style={styles.distanceBadgeText}>{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</Text>
          </View>
        </View>
        {date.headline ? <Text style={styles.dateHeadline}>{date.headline}</Text> : null}
        <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.dateLine} numberOfLines={1}>{date.startLine}</Text>
        <Text style={styles.locationLine} numberOfLines={1}>{location}</Text>
        {description ? <Text style={styles.description} numberOfLines={2}>{description}</Text> : null}
        <Text style={styles.detailsHint}>Toucher la carte pour voir le détail</Text>
      </View>
    </>
  );

  if (image) {
    return (
      <ImageBackground source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover">
        {content}
      </ImageBackground>
    );
  }
  return <View style={StyleSheet.absoluteFill}>{content}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  header: { width: '100%', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { ...typography.label, fontSize: 11, letterSpacing: 1.3, color: colors.brand.secondary },
  headerTitle: { ...typography.h4, color: colors.brand.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pauseButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.neutral[200] },
  pauseText: { ...typography.label, fontSize: 11, color: colors.brand.secondary },
  counterPill: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.brand.surface },
  counterText: { ...typography.label, color: colors.brand.text },
  deck: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  card: { position: 'absolute', overflow: 'hidden', borderRadius: 30, backgroundColor: '#243136', borderWidth: 1, borderColor: '#3b4a4f', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  nextCard: { transform: [{ scale: 0.955 }, { translateY: 12 }], opacity: 0.7 },
  imageFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17333b' },
  imageFallbackEmoji: { fontSize: 80, opacity: 0.75 },
  cardContent: { flex: 1, justifyContent: 'flex-end', padding: spacing.lg },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  categoryBadge: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: borderRadius.full, backgroundColor: colors.brand.secondary },
  categoryBadgeText: { ...typography.label, color: colors.brand.primary },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: borderRadius.full, backgroundColor: 'rgba(244,251,246,0.94)' },
  distanceBadgeText: { ...typography.label, color: colors.brand.text },
  dateHeadline: { ...typography.label, color: '#67e8f9', marginBottom: spacing.xs },
  eventTitle: { ...typography.h2, color: '#fff' },
  dateLine: { ...typography.bodyBold, color: '#e2e8f0', marginTop: spacing.sm },
  locationLine: { ...typography.bodySmall, color: '#cbd5e1', marginTop: 3 },
  description: { ...typography.bodySmall, color: '#e2e8f0', marginTop: spacing.sm },
  detailsHint: { ...typography.label, fontSize: 11, color: '#94a3b8', marginTop: spacing.md },
  decisionStamp: { position: 'absolute', top: 28, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 3 },
  likeStamp: { left: 24, backgroundColor: '#6ee7b7', borderColor: '#052d21', transform: [{ rotate: '-8deg' }] },
  passStamp: { right: 24, backgroundColor: '#fda4af', borderColor: '#451a1a', transform: [{ rotate: '8deg' }] },
  likeStampText: { ...typography.bodyBold, color: '#052d21' },
  passStampText: { ...typography.bodyBold, color: '#451a1a' },
  instruction: { ...typography.bodySmall, color: colors.brand.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  actions: { flex: 1, minHeight: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  actionButton: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: colors.brand.surface },
  passButton: { borderColor: '#7f1d1d' },
  likeButton: { borderColor: '#065f46' },
});
