import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { EventWithCreator } from '@/types/database';
import { Motion } from '@/constants/motion';
import { colors, spacing } from '@/constants/theme';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';
import { MapDiscoveryEventCard } from '@/components/search/MapDiscoveryEventCard';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { MapCardSwipeDirection } from '@/utils/map-card-neighbor';
import { sharePublishedEvent } from '@/utils/event-share';
import { prefetchEventMedia } from '@/utils/prefetch-event-media';

/** How much of the neighbor card stays inside the screen, measured from the screen edge. */
const EDGE_PEEK = 20;
/** Map visible between that slice and the centered card. */
const CARD_GAP = 20;
const CARD_INSET = EDGE_PEEK + CARD_GAP;
const CAROUSEL_MS = 320;
/**
 * Tallest framed copy: kicker, two title lines, detail, price and gaps.
 * The row keeps this slot so a taller neighbor is not clipped, but each
 * card itself stops at its own content.
 */
const COPY_BLOCK = 22 + 3 + 48 + 3 + 20 + 3 + 26 + 8;

type SlotRole = 'left' | 'center' | 'right';

function unitCardHeight(cardWidth: number): number {
  const photo = Math.max(0, cardWidth - 20) / 1.85;
  // Handle 14 + framed padding, gap and the reserved copy block.
  return 14 + 10 + photo + 12 + COPY_BLOCK + 14;
}

function slotLeft(role: SlotRole, cardWidth: number, stageWidth: number, inset: number): number {
  if (role === 'center') return inset;
  if (role === 'left') return EDGE_PEEK - cardWidth;
  return stageWidth - EDGE_PEEK;
}

function CarouselCard({
  event,
  role,
  baseLeft,
  cardWidth,
  dragX,
  stats,
  liked,
  onOpen,
  onToggleHeart,
  onAdvance,
}: {
  event: EventWithCreator;
  role: SlotRole;
  baseLeft: number;
  cardWidth: number;
  dragX: SharedValue<number>;
  stats?: EventCardStats;
  liked: boolean;
  onOpen: () => void;
  onToggleHeart?: (event: EventWithCreator) => void;
  onAdvance?: () => void;
}) {
  const base = useSharedValue(baseLeft);
  // Move the resting position and the drag offset in the same layout pass,
  // so the card that just arrived stays on screen instead of remounting.
  useLayoutEffect(() => {
    base.value = baseLeft;
  }, [base, baseLeft]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: base.value + dragX.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.cardShell,
        role === 'center' ? styles.cardCenter : styles.cardSide,
        { width: cardWidth },
        slideStyle,
      ]}
    >
      <View style={styles.handle} accessibilityElementsHidden />
      <View pointerEvents={role === 'center' ? 'auto' : 'none'}>
        <MapDiscoveryEventCard
          event={event}
          variant="feed"
          carousel
          framed
          stats={stats}
          liked={liked}
          onOpen={() => onOpen()}
          onToggleHeart={(item) => onToggleHeart?.(item)}
          onShare={(item) => { void sharePublishedEvent(item); }}
        />
      </View>
      {role !== 'center' && onAdvance ? (
        <Pressable
          onPress={onAdvance}
          accessibilityRole="button"
          accessibilityLabel={role === 'left' ? 'Événement à gauche' : 'Événement à droite'}
          style={role === 'left' ? styles.sideHitLeft : styles.sideHitRight}
        />
      ) : null}
    </Animated.View>
  );
}

interface Props {
  event: EventWithCreator;
  progress: SharedValue<number>;
  currentUserId?: string | null;
  isHearted?: boolean;
  isEventHearted?: (eventId: string) => boolean;
  onToggleHeart?: (event: EventWithCreator) => void;
  onPress: () => void;
  onNavigate: () => void;
  onClose: () => void;
  /** Returns true when a neighbor exists on that side and can be committed. */
  onPrepareNeighbor?: (direction: MapCardSwipeDirection) => boolean;
  onCommitNeighbor?: () => void;
  neighborLeft?: EventWithCreator | null;
  neighborRight?: EventWithCreator | null;
  bottomInset?: number;
}

export const MapEventUnitOverlay: React.FC<Props> = ({
  event,
  progress,
  currentUserId,
  isHearted,
  isEventHearted,
  onToggleHeart,
  onPress,
  onNavigate: _onNavigate,
  onClose,
  onPrepareNeighbor,
  onCommitNeighbor,
  neighborLeft = null,
  neighborRight = null,
  bottomInset = spacing.md,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const [statsById, setStatsById] = useState<Record<string, EventCardStats>>({});
  const statsRef = useRef(statsById);
  statsRef.current = statsById;
  const [interactive, setInteractive] = useState(false);
  const [stageWidth, setStageWidth] = useState(0);
  const reduceMotion = useReduceMotion();
  const carousel = Boolean(onPrepareNeighbor && onCommitNeighbor);
  const dragY = useSharedValue(0);
  const dragX = useSharedValue(0);
  const stride = useSharedValue(320);
  const allowLeft = useSharedValue(neighborLeft ? 1 : 0);
  const allowRight = useSharedValue(neighborRight ? 1 : 0);
  const switching = useSharedValue(0);
  const prepareNeighborRef = useRef(onPrepareNeighbor);
  const commitNeighborRef = useRef(onCommitNeighbor);
  const reduceMotionRef = useRef(reduceMotion);
  const onCloseRef = useRef(onClose);
  prepareNeighborRef.current = onPrepareNeighbor;
  commitNeighborRef.current = onCommitNeighbor;
  reduceMotionRef.current = reduceMotion;
  onCloseRef.current = onClose;

  const measuredStage = stageWidth || windowWidth;
  const inset = carousel ? CARD_INSET : spacing.md;
  const cardWidth = Math.max(0, measuredStage - inset * 2);
  const cardHeight = unitCardHeight(cardWidth);

  const releaseHorizontal = useCallback((direction: MapCardSwipeDirection) => {
    if (!prepareNeighborRef.current?.(direction)) {
      switching.value = 0;
      dragX.value = withSpring(0, Motion.spring.sheet);
      return;
    }
    switching.value = 1;
    const commit = commitNeighborRef.current;
    if (reduceMotionRef.current) {
      switching.value = 0;
      dragX.value = 0;
      commit?.();
      return;
    }
    // Right neighbor enters from the right edge, so the row travels left.
    const target = direction === 'right' ? -stride.value : stride.value;
    dragX.value = withTiming(target, { duration: CAROUSEL_MS }, (finished) => {
      if (!finished) {
        switching.value = 0;
        dragX.value = withSpring(0, Motion.spring.sheet);
        return;
      }
      if (commit) runOnJS(commit)();
    });
  }, [dragX, stride, switching]);

  useLayoutEffect(() => {
    allowLeft.value = neighborLeft ? 1 : 0;
    allowRight.value = neighborRight ? 1 : 0;
  }, [allowLeft, allowRight, neighborLeft, neighborRight]);

  useLayoutEffect(() => {
    if (cardWidth > 0) stride.value = cardWidth + CARD_GAP;
  }, [cardWidth, stride]);

  useLayoutEffect(() => {
    dragY.value = 0;
    dragX.value = 0;
    switching.value = 0;
  }, [dragX, dragY, event.id, switching]);

  const pan = useMemo(() => {
    const vertical = Gesture.Pan()
      .activeOffsetY(12)
      .failOffsetX([-24, 24])
      .onUpdate((gesture) => {
        if (switching.value === 1) return;
        dragY.value = Math.max(0, gesture.translationY);
      })
      .onEnd((gesture) => {
        if (switching.value === 1) return;
        if (gesture.translationY > 72 || gesture.velocityY > 900) {
          // Keep the card where the finger released. Resetting dragY
          // snaps it back up before the close animation fades it out.
          runOnJS(onCloseRef.current)();
          return;
        }
        dragY.value = withSpring(0, Motion.spring.sheet);
      });

    const horizontal = Gesture.Pan()
      .enabled(Boolean(onPrepareNeighbor && onCommitNeighbor))
      .activeOffsetX([-16, 16])
      .failOffsetY([-28, 28])
      .onUpdate((gesture) => {
        if (switching.value === 1) return;
        let next = gesture.translationX;
        if (next > 0 && allowLeft.value === 0) next *= 0.22;
        if (next < 0 && allowRight.value === 0) next *= 0.22;
        const limit = stride.value;
        if (next > limit) next = limit + (next - limit) * 0.2;
        if (next < -limit) next = -limit + (next + limit) * 0.2;
        dragX.value = next;
      })
      .onEnd((gesture) => {
        if (switching.value === 1) return;
        const direction: MapCardSwipeDirection | null =
          gesture.translationX <= -56 || (gesture.translationX < 0 && gesture.velocityX < -800)
            ? 'right'
            : gesture.translationX >= 56 || (gesture.translationX > 0 && gesture.velocityX > 800)
              ? 'left'
              : null;
        if (!direction) {
          dragX.value = withSpring(0, Motion.spring.sheet);
          return;
        }
        switching.value = 1;
        runOnJS(releaseHorizontal)(direction);
      })
      .onFinalize(() => {
        if (switching.value === 1) return;
        dragX.value = withSpring(0, Motion.spring.sheet);
      });

    return Gesture.Exclusive(horizontal, vertical);
  }, [allowLeft, allowRight, dragX, dragY, onCommitNeighbor, onPrepareNeighbor, releaseHorizontal, stride, switching]);

  useEffect(() => {
    const ids = [event.id, neighborLeft?.id, neighborRight?.id].filter((id): id is string => Boolean(id));
    const missing = ids.filter((id) => !statsRef.current[id]);
    prefetchEventMedia(event, { priority: 'visible' });
    if (neighborLeft) prefetchEventMedia(neighborLeft, { priority: 'visible' });
    if (neighborRight) prefetchEventMedia(neighborRight, { priority: 'visible' });
    if (missing.length === 0) return undefined;
    let cancelled = false;
    EventCardStatsService.getStatsForEvents(missing, currentUserId).then((stats) => {
      if (cancelled) return;
      setStatsById((prev) => ({ ...prev, ...stats }));
    });
    return () => {
      cancelled = true;
    };
  }, [currentUserId, event, neighborLeft, neighborRight]);

  useAnimatedReaction(
    () => progress.value > 0.08,
    (next, previous) => {
      if (next !== previous) {
        runOnJS(setInteractive)(next);
      }
    },
  );

  void _onNavigate;

  const stageStyle = useAnimatedStyle(() => {
    const reveal = Math.min(Math.max(progress.value, 0), 1);
    return {
      opacity: interpolate(reveal, [0, 0.35, 1], [0, 1, 1]),
      transform: [{ translateY: (1 - reveal) * 120 + dragY.value }],
    };
  });

  const slots = useMemo(() => {
    const next: { item: EventWithCreator; role: SlotRole }[] = [];
    if (neighborLeft) next.push({ item: neighborLeft, role: 'left' });
    next.push({ item: event, role: 'center' });
    if (neighborRight) next.push({ item: neighborRight, role: 'right' });
    return next;
  }, [event, neighborLeft, neighborRight]);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        pointerEvents={interactive ? 'box-none' : 'none'}
        style={[styles.stage, { bottom: bottomInset, height: cardHeight }, stageStyle]}
        onLayout={(layoutEvent) => {
          const width = layoutEvent.nativeEvent.layout.width;
          setStageWidth((prev) => (prev === width ? prev : width));
        }}
      >
        {cardWidth > 0 ? slots.map(({ item, role }) => (
          <CarouselCard
            key={item.id}
            event={item}
            role={role}
            baseLeft={slotLeft(role, cardWidth, measuredStage, inset)}
            cardWidth={cardWidth}
            dragX={dragX}
            stats={statsById[item.id]}
            liked={isEventHearted ? isEventHearted(item.id) : item.id === event.id && Boolean(isHearted)}
            onOpen={item.id === event.id ? onPress : () => releaseHorizontal(role === 'left' ? 'left' : 'right')}
            onToggleHeart={onToggleHeart}
            onAdvance={role === 'center' ? undefined : () => releaseHorizontal(role)}
          />
        )) : null}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
  },
  cardShell: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: colors.brand.page,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardCenter: { zIndex: 2 },
  cardSide: { zIndex: 1 },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 2,
    backgroundColor: colors.brand.line,
  },
  sideHitLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: EDGE_PEEK,
  },
  sideHitRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: EDGE_PEEK,
  },
});
