import React, { forwardRef } from 'react';
import { View, TextInput, Text, StyleSheet, type TextInputProps } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  helperText,
  style,
  ...props
}, ref) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={ref}
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.neutral[400]}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
});
Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.neutral[700],
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.neutral[900],
    backgroundColor: colors.neutral[50],
  },
  inputError: {
    borderColor: colors.error[500],
  },
  error: {
    ...typography.caption,
    color: colors.error[500],
    marginTop: spacing.xs,
  },
  helperText: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
});
