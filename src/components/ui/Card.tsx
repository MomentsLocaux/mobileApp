import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../constants/theme';

interface CardProps extends ViewProps {
  padding?: keyof typeof spacing;
  elevation?: 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  elevation = 'md',
  style,
  ...props
}) => {
  return (
    <View
      style={[
        styles.card,
        { padding: spacing[padding] },
        shadows[elevation],
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.lg,
  },
});
