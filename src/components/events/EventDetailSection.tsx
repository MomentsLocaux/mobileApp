import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { BrandIcon, type BrandIconName } from '@/components/ui/BrandIcon';
import { colors, spacing, typography } from '@/constants/theme';

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
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brand.line,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  title: { ...typography.bodySmall, fontWeight: '800', color: colors.brand.text, flexShrink: 1 },
});
