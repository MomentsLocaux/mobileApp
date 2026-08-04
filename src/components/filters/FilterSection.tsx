import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { filterColors, filterSpacing, filterTypography } from '@/constants/filter-tokens';

export interface FilterSectionProps {
  title: string;
  hint?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function FilterSection({ title, hint, children, style, testID }: FilterSectionProps) {
  return (
    <View style={[styles.section, style]} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: filterSpacing.sectionMarginTop,
    gap: filterSpacing.sectionGap,
  },
  title: {
    ...filterTypography.sectionTitle,
    color: filterColors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hint: {
    ...filterTypography.sectionHint,
    color: filterColors.textSecondary,
    lineHeight: 18,
  },
});
