import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, minimumTouchTarget } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /** Affiche un bouton œil pour révéler/masquer le mot de passe. */
  showPasswordToggle?: boolean;
  /** Couleur de l’icône œil (défaut: texte secondaire de la marque). */
  toggleIconColor?: string;
}

export const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  helperText,
  style,
  containerStyle,
  showPasswordToggle = false,
  toggleIconColor,
  secureTextEntry,
  ...props
}, ref) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isSecure = Boolean(secureTextEntry) && !(showPasswordToggle && isPasswordVisible);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrapper}>
        <TextInput
          ref={ref}
          style={[
            styles.input,
            showPasswordToggle && styles.inputWithToggle,
            error && styles.inputError,
            style,
          ]}
          placeholderTextColor={colors.neutral[400]}
          {...props}
          secureTextEntry={isSecure}
        />
        {showPasswordToggle ? (
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setIsPasswordVisible((visible) => !visible)}
            accessibilityRole="button"
            accessibilityLabel={
              isPasswordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={toggleIconColor ?? colors.brand.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {helperText && !error ? <Text style={styles.helperText}>{helperText}</Text> : null}
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
    color: colors.brand.textSecondary,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.md,
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.brand.text,
    backgroundColor: colors.brand.surface,
  },
  inputWithToggle: {
    paddingRight: spacing.md + 28,
  },
  toggleButton: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: minimumTouchTarget,
    paddingHorizontal: spacing.xs,
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
    color: colors.brand.textSecondary,
    marginTop: spacing.xs,
  },
});
