import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, CalendarDays, MapPin, Sparkles, UserPlus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  type SharedValue,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useAuth } from '../src/hooks';
import { useReduceMotion } from '../src/hooks/useReduceMotion';
import { borderRadius, colors, spacing, typography } from '../src/constants/theme';
import { Motion } from '../src/constants/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MOMENT_CARDS = [
  {
    title: 'Concert indie',
    meta: 'Ce soir · 1,2 km',
    accent: '#2bbfe3',
    Icon: CalendarDays,
    delay: 120,
  },
  {
    title: 'Atelier céramique',
    meta: 'Samedi · quartier gare',
    accent: '#10b981',
    Icon: Sparkles,
    delay: 240,
  },
  {
    title: 'Marché local',
    meta: 'Demain · centre-ville',
    accent: '#f59e0b',
    Icon: MapPin,
    delay: 360,
  },
] as const;

const EVENT_POP_POSITIONS = [
  { top: '7%', left: '4%', rotate: '-7deg' },
  { top: '23%', right: '0%', rotate: '5deg' },
  { bottom: '9%', left: '10%', rotate: '4deg' },
] as const;

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const isCompactHeight = height < 720;
  const visibleMomentCards = isCompactHeight ? MOMENT_CARDS.slice(0, 2) : MOMENT_CARDS;
  const logoSceneSize = Math.min(width - spacing.lg * 2, isCompactHeight ? 250 : 330);
  const reduceMotion = useReduceMotion();
  const { isLoading, isAuthenticated, profile } = useAuth();

  const intro = useSharedValue(reduceMotion ? 1 : 0);
  const float = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    intro.value = reduceMotion
      ? 1
      : withTiming(1, { duration: 1200, easing: Motion.easing.emphasized });

    if (reduceMotion) {
      float.value = 0;
      pulse.value = 0;
      return;
    }

    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [float, intro, pulse, reduceMotion]);

  const brandStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [
      { translateY: interpolate(intro.value, [0, 1], [22, 0]) },
      { scale: interpolate(intro.value, [0, 1], [0.96, 1]) },
    ],
  }));

  const heroStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [{ translateY: interpolate(intro.value, [0, 1], [34, 0]) }],
  }));

  const logoSceneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0, 0.35, 1], [0, 0.75, 1]),
    transform: [
      { translateY: interpolate(float.value, [0, 1], [18, -18]) },
      { scale: interpolate(intro.value, [0, 1], [0.82, 1]) },
    ],
  }));

  const logoGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.3, 0.92]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.78, 1.22]) }],
  }));

  const actionsStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [{ translateY: interpolate(intro.value, [0, 1], [28, 0]) }],
  }));

  if (isLoading || (isAuthenticated && !profile)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.secondary} />
      </View>
    );
  }

  if (isAuthenticated && profile && !profile.onboarding_completed) {
    return <Redirect href="/onboarding" />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/map" />;
  }

  return (
    <View style={styles.container}>
      <AnimatedWelcomeBackdrop intro={intro} float={float} pulse={pulse} />

      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(spacing.lg, height * 0.055),
            paddingBottom: Math.max(insets.bottom + spacing.md, isCompactHeight ? spacing.lg : spacing.xl),
          },
        ]}
      >
        <Animated.View style={[styles.brandBlock, brandStyle]}>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>Moments Locaux</Text>
            <Text style={styles.brandSubline}>Sorties, lieux et rencontres près de vous</Text>
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[styles.logoScene, { width: logoSceneSize, height: logoSceneSize }, logoSceneStyle]}
        >
          <Animated.View style={[styles.logoGlow, logoGlowStyle]} />
          <Animated.View style={[styles.logoRing, logoGlowStyle]} />
          <Image
            source={require('../assets/images/icon.png')}
            style={styles.heroLogo}
            accessibilityLabel="Logo Moments Locaux"
          />
          {visibleMomentCards.map((item, index) => (
            <EventPopBubble
              key={item.title}
              item={item}
              intro={intro}
              pulse={pulse}
              index={index}
              placement={EVENT_POP_POSITIONS[index]}
            />
          ))}
        </Animated.View>

        <Animated.View style={[styles.heroBlock, heroStyle]}>
          <View style={styles.liveBadge}>
            <Sparkles size={14} color={colors.brand.primary} />
            <Text style={styles.liveBadgeText}>Découverte locale en direct</Text>
          </View>

          <Text style={[styles.title, isCompactHeight && styles.compactTitle]}>
            Trouvez le bon moment, juste autour de vous.
          </Text>
          <Text style={styles.subtitle}>
            Concerts, marchés, ateliers et sorties spontanées, réunis sur une carte simple et vivante.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.actions, actionsStyle]}>
          <WelcomeAction
            label="Explorer la carte"
            detail="Continuer en invité"
            icon={<MapPin size={20} color={colors.brand.primary} />}
            variant="primary"
            onPress={() => router.replace('/(tabs)/map')}
          />

          <View style={styles.secondaryActions}>
            <WelcomeAction
              label="Se connecter"
              icon={<ArrowRight size={18} color={colors.brand.text} />}
              variant="secondary"
              compact
              onPress={() => router.push('/auth/login')}
            />
            <WelcomeAction
              label="Créer un compte"
              icon={<UserPlus size={18} color={colors.brand.text} />}
              variant="secondary"
              compact
              onPress={() => router.push('/auth/register')}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

type AnimatedWelcomeBackdropProps = {
  intro: SharedValue<number>;
  float: SharedValue<number>;
  pulse: SharedValue<number>;
};

function AnimatedWelcomeBackdrop({ intro, float, pulse }: AnimatedWelcomeBackdropProps) {
  const topPanelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0, 0.45, 1], [0, 0.82, 1]),
    transform: [
      { translateY: interpolate(intro.value, [0, 1], [-260, 0]) },
      { translateX: interpolate(float.value, [0, 1], [0, -8]) },
      { rotate: '-13deg' },
    ],
  }));

  const middlePanelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0, 0.55, 1], [0, 0.78, 0.94]),
    transform: [
      { translateX: interpolate(intro.value, [0, 1], [260, 0]) },
      { translateY: interpolate(float.value, [0, 1], [0, 10]) },
      { rotate: '10deg' },
    ],
  }));

  const bottomPanelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0, 0.65, 1], [0, 0.9, 1]),
    transform: [
      { translateY: interpolate(intro.value, [0, 1], [360, 0]) },
      { translateX: interpolate(float.value, [0, 1], [0, 12]) },
      { rotate: '-11deg' },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.18, 0.36]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.96, 1.08]) }],
  }));

  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <LinearGradient
        colors={['#efffc0', '#dcfb92', '#baf7d1']}
        locations={[0, 0.58, 1]}
        style={styles.baseWash}
      />
      <Animated.View style={[styles.ambientGlow, glowStyle]} />
      <Animated.View style={[styles.topPanel, topPanelStyle]} />
      <Animated.View style={[styles.middlePanel, middlePanelStyle]} />
      <Animated.View style={[styles.bottomPanel, bottomPanelStyle]} />
      <LinearGradient
        colors={['rgba(15,23,25,0.02)', 'rgba(15,23,25,0.24)', 'rgba(15,23,25,0.92)']}
        locations={[0, 0.62, 1]}
        style={styles.scrim}
      />
    </View>
  );
}

type EventPopBubbleProps = {
  item: (typeof MOMENT_CARDS)[number];
  intro: SharedValue<number>;
  pulse: SharedValue<number>;
  index: number;
  placement: (typeof EVENT_POP_POSITIONS)[number];
};

function EventPopBubble({ item, intro, pulse, index, placement }: EventPopBubbleProps) {
  const delayed = useSharedValue(0);
  const { rotate, ...positionStyle } = placement;

  useEffect(() => {
    delayed.value = withDelay(
      item.delay,
      withTiming(1, { duration: Motion.duration.screen, easing: Motion.easing.emphasized })
    );
  }, [delayed, item.delay]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: delayed.value,
    transform: [
      { translateY: interpolate(delayed.value, [0, 1], [42, 0]) },
      {
        translateX: interpolate(pulse.value, [0, 1], [0, index % 2 === 0 ? 10 : -10]),
      },
      { scale: interpolate(delayed.value, [0, 0.68, 1], [0.2, 1.08, 1]) },
      { rotate },
    ],
  }));

  const Icon = item.Icon;

  return (
    <Animated.View style={[styles.eventBubble, positionStyle, cardStyle]}>
      <View style={[styles.eventBubbleIcon, { backgroundColor: item.accent }]}>
        <Icon size={16} color={colors.brand.primary} />
      </View>
      <View style={styles.eventBubbleCopy}>
        <Text style={styles.eventBubbleTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.eventBubbleMeta} numberOfLines={1}>
          {item.meta}
        </Text>
      </View>
    </Animated.View>
  );
}

type WelcomeActionProps = {
  label: string;
  detail?: string;
  icon: React.ReactNode;
  variant: 'primary' | 'secondary';
  compact?: boolean;
  onPress: () => void;
};

function WelcomeAction({ label, detail, icon, variant, compact, onPress }: WelcomeActionProps) {
  const pressed = useSharedValue(1);
  const actionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressed.value }],
  }));

  return (
    <AnimatedPressable
      style={[
        actionStyle,
        styles.actionButton,
        variant === 'primary' ? styles.primaryAction : styles.secondaryAction,
        compact && styles.compactAction,
      ]}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(Motion.transform.pressScale, { duration: Motion.duration.micro });
      }}
      onPressOut={() => {
        pressed.value = withTiming(1, { duration: Motion.duration.fast });
      }}
      accessibilityRole="button"
    >
      <View style={styles.actionIcon}>{icon}</View>
      <View style={styles.actionTextBlock}>
        <Text style={variant === 'primary' ? styles.primaryActionText : styles.secondaryActionText}>
          {label}
        </Text>
        {detail ? <Text style={styles.actionDetail}>{detail}</Text> : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  baseWash: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  ambientGlow: {
    position: 'absolute',
    top: '16%',
    left: '16%',
    width: '72%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(43,191,227,0.36)',
  },
  topPanel: {
    position: 'absolute',
    top: -70,
    left: -60,
    width: '120%',
    height: '34%',
    backgroundColor: 'rgba(248,217,255,0.88)',
  },
  middlePanel: {
    position: 'absolute',
    top: '28%',
    right: -90,
    width: '122%',
    height: '31%',
    backgroundColor: 'rgba(213,255,69,0.9)',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: '135%',
    height: '42%',
    backgroundColor: 'rgba(255,112,59,0.92)',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  brandBlock: {
    alignItems: 'center',
  },
  brandCopy: {
    alignItems: 'center',
  },
  brandName: {
    ...typography.h5,
    color: colors.brand.primary,
  },
  brandSubline: {
    ...typography.small,
    color: 'rgba(15,23,25,0.72)',
    marginTop: 2,
  },
  heroBlock: {
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  liveBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
  },
  liveBadgeText: {
    ...typography.label,
    color: colors.brand.primary,
  },
  title: {
    color: colors.brand.text,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: 0,
  },
  compactTitle: {
    fontSize: 30,
    lineHeight: 34,
  },
  subtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.82)',
    maxWidth: 340,
  },
  logoScene: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  logoGlow: {
    position: 'absolute',
    width: '48%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(43,191,227,0.32)',
    shadowColor: colors.brand.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 34,
  },
  logoRing: {
    position: 'absolute',
    width: '68%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(43,191,227,0.36)',
  },
  heroLogo: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    shadowColor: colors.brand.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.72,
    shadowRadius: 18,
  },
  eventBubble: {
    position: 'absolute',
    width: '62%',
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,25,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  eventBubbleIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBubbleCopy: {
    flex: 1,
  },
  eventBubbleTitle: {
    ...typography.bodySmall,
    fontWeight: '800',
    color: colors.brand.text,
  },
  eventBubbleMeta: {
    ...typography.small,
    color: 'rgba(255,255,255,0.66)',
    marginTop: 2,
  },
  actions: {
    gap: spacing.md,
    zIndex: 20,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryAction: {
    backgroundColor: colors.brand.secondary,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  compactAction: {
    minHeight: 54,
  },
  actionIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextBlock: {
    flexShrink: 1,
  },
  primaryActionText: {
    ...typography.bodyBold,
    color: colors.brand.primary,
  },
  secondaryActionText: {
    ...typography.bodyBold,
    color: colors.brand.text,
    fontSize: 14,
  },
  actionDetail: {
    ...typography.small,
    color: 'rgba(15,23,25,0.72)',
    marginTop: 1,
  },
});
