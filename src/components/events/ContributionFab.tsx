import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { persistStorage } from '@/store/persistStorage';
import { haptics } from '@/utils/haptics';
import {
  CONTRIBUTION_FAB_PEEK_ENTER,
  CONTRIBUTION_FAB_POSITION_KEY,
  CONTRIBUTION_FAB_SIZE,
  CONTRIBUTION_FAB_SNAP_VELOCITY,
  defaultContributionFabPosition,
  getContributionFabBounds,
  parseContributionFabStoredPosition,
  restoreContributionFabPosition,
  type ContributionFabStoredPosition,
} from '@/utils/contribution-fab';

type Props = {
  tabBarHeight: number;
  color: string;
  accessibilityLabel: string;
  onPress: () => void;
  hidden?: boolean;
};

let memoryPosition: ContributionFabStoredPosition | null = null;

export function ContributionFab({
  tabBarHeight,
  color,
  accessibilityLabel,
  onPress,
  hidden = false,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const bounds = useMemo(
    () =>
      getContributionFabBounds({
        width,
        height,
        topInset: insets.top,
        leftInset: insets.left,
        rightInset: insets.right,
        tabBarHeight,
      }),
    [height, insets.left, insets.right, insets.top, tabBarHeight, width],
  );
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const initial = restoreContributionFabPosition(memoryPosition, bounds);
  const translateX = useSharedValue(initial.x);
  const translateY = useSharedValue(initial.y);
  const startX = useSharedValue(initial.x);
  const startY = useSharedValue(initial.y);
  const scale = useSharedValue(1);
  const minX = useSharedValue(bounds.minX);
  const maxX = useSharedValue(bounds.maxX);
  const minY = useSharedValue(bounds.minY);
  const maxY = useSharedValue(bounds.maxY);
  const peekMinX = useSharedValue(bounds.peekMinX);
  const peekMaxX = useSharedValue(bounds.peekMaxX);
  const screenWidth = useSharedValue(bounds.screenWidth);
  const peekedSV = useSharedValue(initial.peeked ? 1 : 0);
  const reduceMotionSV = useSharedValue(reduceMotion);
  const hiddenSV = useSharedValue(hidden);
  const readySV = useSharedValue(memoryPosition != null);
  const [ready, setReady] = useState(memoryPosition != null);
  const [peeked, setPeeked] = useState(initial.peeked);

  const applyPosition = useCallback(
    (x: number, y: number, nextPeeked: boolean) => {
      translateX.value = x;
      translateY.value = y;
      peekedSV.value = nextPeeked ? 1 : 0;
      setPeeked(nextPeeked);
    },
    [peekedSV, translateX, translateY],
  );

  const persistPosition = useCallback((x: number, y: number, nextPeeked: boolean) => {
    const stored: ContributionFabStoredPosition = {
      x,
      y,
      width: boundsRef.current.screenWidth,
      height: boundsRef.current.screenHeight,
      peeked: nextPeeked,
    };
    memoryPosition = stored;
    setPeeked(nextPeeked);
    void persistStorage
      .setItem(CONTRIBUTION_FAB_POSITION_KEY, JSON.stringify(stored))
      .catch(() => undefined);
  }, []);

  const firePress = useCallback(() => {
    onPressRef.current();
  }, []);

  useEffect(() => {
    reduceMotionSV.value = reduceMotion;
  }, [reduceMotion, reduceMotionSV]);

  useEffect(() => {
    hiddenSV.value = hidden;
  }, [hidden, hiddenSV]);

  useEffect(() => {
    readySV.value = ready;
  }, [ready, readySV]);

  useLayoutEffect(() => {
    minX.value = bounds.minX;
    maxX.value = bounds.maxX;
    minY.value = bounds.minY;
    maxY.value = bounds.maxY;
    peekMinX.value = bounds.peekMinX;
    peekMaxX.value = bounds.peekMaxX;
    screenWidth.value = bounds.screenWidth;
    const next = restoreContributionFabPosition(memoryPosition, bounds);
    applyPosition(next.x, next.y, next.peeked);
  }, [applyPosition, bounds, maxX, maxY, minX, minY, peekMaxX, peekMinX, screenWidth]);

  useEffect(() => {
    let cancelled = false;
    if (memoryPosition) {
      setReady(true);
      return;
    }

    persistStorage
      .getItem(CONTRIBUTION_FAB_POSITION_KEY)
      .then((raw) => {
        if (cancelled) return;
        const stored = parseContributionFabStoredPosition(raw);
        const next = stored
          ? restoreContributionFabPosition(stored, boundsRef.current)
          : defaultContributionFabPosition(boundsRef.current);
        if (stored) memoryPosition = stored;
        applyPosition(next.x, next.y, next.peeked);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        const next = defaultContributionFabPosition(boundsRef.current);
        applyPosition(next.x, next.y, next.peeked);
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [applyPosition]);

  const pan = Gesture.Pan()
    .minDistance(8)
    .hitSlop(peeked ? 28 : 16)
    .enabled(!hidden && ready)
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onStart(() => {
      if (!reduceMotionSV.value) {
        scale.value = withTiming(1.08, { duration: Motion.duration.micro });
      }
      runOnJS(haptics.selection)();
    })
    .onUpdate((event) => {
      const nextX = Math.min(peekMaxX.value, Math.max(peekMinX.value, startX.value + event.translationX));
      const nextY = Math.min(maxY.value, Math.max(minY.value, startY.value + event.translationY));
      translateX.value = nextX;
      translateY.value = nextY;
    })
    .onEnd((event) => {
      const x = translateX.value;
      const y = translateY.value;
      let side: 'left' | 'right' = x + CONTRIBUTION_FAB_SIZE / 2 < screenWidth.value / 2 ? 'left' : 'right';
      if (event.velocityX <= -CONTRIBUTION_FAB_SNAP_VELOCITY) side = 'left';
      else if (event.velocityX >= CONTRIBUTION_FAB_SNAP_VELOCITY) side = 'right';
      const dockedX = side === 'left' ? minX.value : maxX.value;
      const peekX = side === 'left' ? peekMinX.value : peekMaxX.value;
      const peekMid = (dockedX + peekX) / 2;
      const pushedPastDock =
        side === 'left' ? x <= minX.value - CONTRIBUTION_FAB_PEEK_ENTER : x >= maxX.value + CONTRIBUTION_FAB_PEEK_ENTER;
      const nearDocked = side === 'left' ? x <= minX.value + 8 : x >= maxX.value - 8;
      const shoveOffScreen =
        nearDocked &&
        (side === 'left'
          ? event.velocityX <= -CONTRIBUTION_FAB_SNAP_VELOCITY
          : event.velocityX >= CONTRIBUTION_FAB_SNAP_VELOCITY);
      const alreadyPeeked = side === 'left' ? x <= peekMid : x >= peekMid;
      const nextPeeked = pushedPastDock || shoveOffScreen || alreadyPeeked;
      const snapX = nextPeeked ? peekX : dockedX;
      const snapY = Math.min(maxY.value, Math.max(minY.value, y));
      peekedSV.value = nextPeeked ? 1 : 0;
      if (reduceMotionSV.value) {
        translateX.value = snapX;
        translateY.value = snapY;
        scale.value = 1;
      } else {
        translateX.value = withSpring(snapX, Motion.spring.snappy);
        translateY.value = withSpring(snapY, Motion.spring.snappy);
        scale.value = withSpring(1, Motion.spring.soft);
      }
      runOnJS(persistPosition)(snapX, snapY, nextPeeked);
    });

  const tap = Gesture.Tap()
    .enabled(!hidden && ready)
    .hitSlop(peeked ? 28 : 16)
    .onBegin(() => {
      if (!reduceMotionSV.value) {
        scale.value = withTiming(Motion.transform.pressScale, { duration: Motion.duration.micro });
      }
    })
    .onFinalize(() => {
      scale.value = reduceMotionSV.value ? 1 : withSpring(1, Motion.spring.soft);
    })
    .onEnd(() => {
      if (peekedSV.value) {
        const side = translateX.value + CONTRIBUTION_FAB_SIZE / 2 < screenWidth.value / 2 ? 'left' : 'right';
        const snapX = side === 'left' ? minX.value : maxX.value;
        const snapY = translateY.value;
        peekedSV.value = 0;
        if (reduceMotionSV.value) {
          translateX.value = snapX;
          scale.value = 1;
        } else {
          translateX.value = withSpring(snapX, Motion.spring.snappy);
          scale.value = withSpring(1, Motion.spring.soft);
        }
        runOnJS(persistPosition)(snapX, snapY, false);
        runOnJS(haptics.selection)();
        return;
      }
      runOnJS(firePress)();
    });

  const composed = Gesture.Exclusive(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: hiddenSV.value || !readySV.value ? 0 : 1,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        collapsable={false}
        pointerEvents={hidden || !ready ? 'none' : 'auto'}
        accessible={!hidden && ready}
        accessibilityRole="button"
        accessibilityLabel={peeked ? 'Bouton plus rangé' : accessibilityLabel}
        accessibilityHint={
          peeked
            ? 'Touchez pour afficher le bouton, ou faites glisser pour le déplacer.'
            : 'Touchez pour ouvrir. Poussez complètement contre un bord pour le ranger.'
        }
        style={[styles.fab, { backgroundColor: color }, animatedStyle]}
      >
        <Plus size={28} color={colors.brand.onAccent} strokeWidth={2.6} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CONTRIBUTION_FAB_SIZE,
    height: CONTRIBUTION_FAB_SIZE,
    borderRadius: CONTRIBUTION_FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.brand.page,
    overflow: 'visible',
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
  },
});
