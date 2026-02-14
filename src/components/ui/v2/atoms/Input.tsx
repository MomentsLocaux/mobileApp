import React, { forwardRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { Typography } from './Typography';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, helperText, containerStyle, style, ...props },
  ref
) {
  const computedA11yLabel =
    props.accessibilityLabel ??
    label ??
    (typeof props.placeholder === 'string' ? props.placeholder : 'Champ');

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Typography variant="body" color={colors.textPrimary} weight="600">
          {label}
        </Typography>
      ) : null}

      <TextInput
        ref={ref}
        style={[styles.input, style]}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.primary}
        accessible
        accessibilityLabel={computedA11yLabel}
        accessibilityHint={props.secureTextEntry ? 'Champ sécurisé' : undefined}
        {...props}
      />

      {error ? (
        <Typography variant="caption" color={colors.danger}>
          {error}
        </Typography>
      ) : helperText ? (
        <Typography variant="caption" color={colors.textSecondary}>
          {helperText}
        </Typography>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  input: {
    minHeight: 56,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    ...typography.body,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
