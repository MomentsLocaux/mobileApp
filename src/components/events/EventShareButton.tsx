import React from 'react';
import { StyleSheet, Text, TouchableOpacity, type GestureResponderEvent } from 'react-native';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { colors, typography } from '@/constants/theme';

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  /** Icon-only 34 px control for narrow rows. */
  compact?: boolean;
};

/** Outline pill matching `EventHeartButton` (34 px, page fill, grey ring). */
export const EventShareButton = React.memo(function EventShareButton({
  onPress,
  accessibilityLabel,
  compact = false,
}: Props) {
  const handlePress = (event: GestureResponderEvent) => {
    event.stopPropagation?.();
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      activeOpacity={0.7}
      style={[styles.button, compact && styles.compact]}
    >
      <BrandIcon name="share" size={18} />
      {compact ? null : (
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          Partager
        </Text>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  button: {
    height: 34,
    minHeight: 34,
    minWidth: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.brand.page,
    flexShrink: 0,
  },
  compact: {
    width: 34,
    paddingHorizontal: 0,
  },
  label: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand.text,
  },
});
