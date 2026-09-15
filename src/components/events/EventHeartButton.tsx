import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { Motion } from '@/constants/motion';
import { haptics } from '@/utils/haptics';

interface EventHeartButtonProps {
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  hapticsEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function EventHeartButton({
  active,
  onPress,
  disabled = false,
  hapticsEnabled = true,
  style,
  accessibilityLabel = active
    ? 'Retirer des favoris'
    : 'Aimer et enregistrer',
}: EventHeartButtonProps) {
  const scale = useSharedValue(1);
  const wasActiveRef = useRef(active);

  useEffect(() => {
    if (active && !wasActiveRef.current) {
      scale.value = withSequence(
        withSpring(1.18, Motion.spring.snappy),
        withSpring(1, Motion.spring.soft),
      );
    }
    wasActiveRef.current = active;
  }, [active, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = (event: GestureResponderEvent) => {
    event.stopPropagation?.();
    if (hapticsEnabled) haptics.light();
    scale.value = withSequence(
      withTiming(1.14, { duration: 90 }),
      withTiming(1, { duration: 120 }),
    );
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      activeOpacity={0.86}
    >
      <Animated.View style={iconStyle}>
        <Heart
          size={19}
          color={active ? colors.brand.secondary : colors.brand.text}
          fill={active ? colors.brand.secondary : 'transparent'}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
});
