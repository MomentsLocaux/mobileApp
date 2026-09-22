import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { BrandIcon, type BrandIconName } from '@/components/ui/BrandIcon';
import { colors, spacing, typography } from '@/constants/theme';
import { relief } from '@/constants/relief';

export function EventDetailSection({
  title,
  icon,
  children,
  style,
}: {
  title?: string;
  icon?: BrandIconName;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <View style={styles.heading}>
          {icon ? <BrandIcon name={icon} size={23} /> : null}
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    ...relief.shadow,
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: relief.border,
    borderTopColor: relief.shine,
    borderBottomWidth: 3,
    borderBottomColor: relief.edge,
    backgroundColor: colors.brand.surfaceMuted,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  title: { ...typography.bodySmall, fontWeight: '800', color: colors.brand.text, flexShrink: 1 },
});
