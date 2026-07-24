import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Platform,
  Linking,
  Alert,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Compass,
  Map,
  MapPinned,
  Navigation,
  X,
} from 'lucide-react-native';
import type { EventWithCreator } from '../../types/database';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getEventLocationLabel } from '@/utils/event-card-display';
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { FloatingPressable } from '@/components/ui/FloatingPressable';
import { haptics } from '@/utils/haptics';

interface Props {
  visible: boolean;
  event: EventWithCreator | null;
  onClose: () => void;
  /** Optional: open the event on the in-app map. */
  onOpenInAppMap?: () => void;
}

const buildUrls = (lat: number, lon: number) => ({
  wazeApp: `waze://?ll=${lat},${lon}&navigate=yes`,
  wazeWeb: `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`,
  google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
  apple: `http://maps.apple.com/?daddr=${lat},${lon}`,
});

type NavigationUrlKey = keyof ReturnType<typeof buildUrls>;

async function tryOpenUrl(url: string) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

async function openNavigation(urls: ReturnType<typeof buildUrls>, preference: 'waze' | 'google' | 'apple') {
  const order: NavigationUrlKey[] =
    Platform.OS === 'ios'
      ? preference === 'waze'
        ? ['wazeApp', 'wazeWeb', 'google', 'apple']
        : preference === 'apple'
          ? ['apple', 'google', 'wazeWeb']
          : ['google', 'wazeWeb', 'apple']
      : preference === 'waze'
        ? ['wazeApp', 'wazeWeb', 'google']
        : ['google', 'wazeWeb'];

  for (const key of order) {
    const url = urls[key];
    const opened = await tryOpenUrl(url);
    if (opened) {
      return;
    }
  }

  Alert.alert('Navigation', 'Aucune application de navigation disponible.');
}

type NavOption = {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  onPress: () => void;
  accent?: boolean;
};

export const NavigationOptionsSheet: React.FC<Props> = ({
  visible,
  event,
  onClose,
  onOpenInAppMap,
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  const urls = useMemo(() => {
    if (!event) return null;
    const coordsArray =
      event.location && typeof event.location === 'object' && 'coordinates' in event.location
        ? event.location.coordinates
        : undefined;
    let lat: number | undefined;
    let lon: number | undefined;

    if (Array.isArray(coordsArray) && coordsArray.length === 2) {
      lon = Number(coordsArray[0]);
      lat = Number(coordsArray[1]);
    } else {
      lat = typeof event.latitude === 'number' ? event.latitude : undefined;
      lon = typeof event.longitude === 'number' ? event.longitude : undefined;
    }

    if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) {
      return null;
    }

    return buildUrls(lat, lon);
  }, [event]);

  const locationLabel = useMemo(
    () => (event ? getEventLocationLabel(event) : ''),
    [event]
  );

  useEffect(() => {
    if (!visible) {
      progress.value = 0;
      return;
    }
    progress.value = reduceMotion
      ? 1
      : withSpring(1, Motion.spring.sheet);
  }, [progress, reduceMotion, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: (1 - progress.value) * 48,
      },
    ],
    opacity: 0.92 + progress.value * 0.08,
  }));

  const closeAnimated = () => {
    if (reduceMotion) {
      onClose();
      return;
    }
    progress.value = withTiming(0, {
      duration: Motion.duration.fast,
      easing: Motion.easing.exit,
    });
    setTimeout(onClose, Motion.duration.fast);
  };

  const launch = async (preference: 'waze' | 'google' | 'apple') => {
    if (!urls) return;
    await openNavigation(urls, preference);
    closeAnimated();
  };

  if (!event || !urls) return null;

  const options: NavOption[] = [
    ...(onOpenInAppMap
      ? [
          {
            key: 'in-app',
            title: 'Carte Moments Locaux',
            subtitle: 'Voir le pin et le parcours dans l’app',
            icon: <MapPinned size={20} color={colors.brand.primary} strokeWidth={2.25} />,
            iconBg: colors.brand.secondary,
            accent: true,
            onPress: () => {
              closeAnimated();
              // Let the sheet start closing before navigation.
              setTimeout(() => onOpenInAppMap(), reduceMotion ? 0 : 80);
            },
          } satisfies NavOption,
        ]
      : []),
    {
      key: 'waze',
      title: 'Waze',
      subtitle: 'Navigation temps réel',
      icon: <Navigation size={20} color="#041018" strokeWidth={2.25} />,
      iconBg: '#33CCFF',
      onPress: () => {
        void launch('waze');
      },
    },
    {
      key: 'google',
      title: 'Google Maps',
      subtitle: 'Itinéraire et transports',
      icon: <Map size={20} color="#FFFFFF" strokeWidth={2.25} />,
      iconBg: '#1A73E8',
      onPress: () => {
        void launch('google');
      },
    },
    ...(Platform.OS === 'ios'
      ? [
          {
            key: 'apple',
            title: 'Apple Plans',
            subtitle: 'Navigation native iOS',
            icon: <Compass size={20} color="#FFFFFF" strokeWidth={2.25} />,
            iconBg: '#64D2FF',
            onPress: () => {
              void launch('apple');
            },
          } satisfies NavOption,
        ]
      : []),
  ];

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={closeAnimated}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdropWrap, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAnimated} accessibilityLabel="Fermer">
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.androidDim]} />
            )}
            <View style={styles.backdropTint} />
          </Pressable>
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm },
            sheetStyle,
          ]}
        >
          <LinearGradient
            colors={['rgba(43,191,227,0.18)', 'rgba(26,36,38,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.sheetGlow}
            pointerEvents="none"
          />

          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>Y aller</Text>
              <Text style={styles.title} numberOfLines={2}>
                {event.title || 'Événement'}
              </Text>
              {locationLabel ? (
                <View style={styles.locationRow}>
                  <MapPinned size={14} color={colors.brand.secondary} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {locationLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            <FloatingPressable
              style={styles.closeBtn}
              onPress={closeAnimated}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              animateEntrance={false}
            >
              <X size={18} color={colors.brand.text} />
            </FloatingPressable>
          </View>

          <View style={styles.options}>
            {options.map((option, index) => (
              <FloatingPressable
                key={option.key}
                style={[styles.optionCard, option.accent && styles.optionCardAccent]}
                onPress={() => {
                  haptics.selection();
                  option.onPress();
                }}
                accessibilityRole="button"
                accessibilityLabel={option.title}
                entranceDelay={reduceMotion ? 0 : 40 + index * 35}
              >
                <View style={[styles.optionIcon, { backgroundColor: option.iconBg }]}>
                  {option.icon}
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                <ChevronRight size={18} color="rgba(255,255,255,0.35)" />
              </FloatingPressable>
            ))}
          </View>

          <FloatingPressable
            style={styles.cancelBtn}
            onPress={closeAnimated}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
            animateEntrance={false}
          >
            <Text style={styles.cancelText}>Annuler</Text>
          </FloatingPressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  androidDim: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 14, 16, 0.45)',
  },
  sheet: {
    backgroundColor: '#121a1c',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  sheetGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
    fontWeight: '800',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  locationText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    flexShrink: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  options: {
    gap: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 72,
  },
  optionCardAccent: {
    backgroundColor: 'rgba(43,191,227,0.12)',
    borderColor: 'rgba(43,191,227,0.35)',
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  optionSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  cancelBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cancelText: {
    ...typography.body,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
});
