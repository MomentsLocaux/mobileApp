import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { getCategoryColor, getCategoryTextColor } from '@/constants/categories';
import { getCategoryLucideIcon } from '@/constants/category-visuals';

type Props = {
  category?: string | null;
  height: number;
  style?: StyleProp<ViewStyle>;
};

/** Cover fallback: category color + Lucide icon (avoids stretching the app icon). */
export function EventCoverPlaceholder({ category, height, style }: Props) {
  const Icon = getCategoryLucideIcon(category);
  const backgroundColor = getCategoryColor(category || '');
  const iconColor = getCategoryTextColor(category || '');

  return (
    <View style={[styles.root, { height, backgroundColor }, style]}>
      <Icon size={Math.min(56, Math.round(height * 0.28))} color={iconColor} strokeWidth={1.75} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
