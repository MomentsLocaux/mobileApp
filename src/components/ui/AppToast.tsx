import React from 'react';
import { StyleSheet } from 'react-native';
import {
  BaseToast,
  ErrorToast,
  type ToastConfig,
} from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const baseStyle = {
  backgroundColor: colors.brand.surface,
  borderLeftWidth: 4,
  borderRadius: borderRadius.lg,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
  height: undefined as unknown as number,
  minHeight: 62,
  paddingVertical: spacing.sm,
  width: '92%' as const,
};

export const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={[baseStyle, { borderLeftColor: colors.brand.success }]}
      contentContainerStyle={styles.content}
      text1Style={styles.title}
      text2Style={styles.subtitle}
      text1NumberOfLines={2}
      text2NumberOfLines={3}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={[baseStyle, { borderLeftColor: colors.brand.error }]}
      contentContainerStyle={styles.content}
      text1Style={styles.title}
      text2Style={styles.subtitle}
      text1NumberOfLines={2}
      text2NumberOfLines={3}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={[baseStyle, { borderLeftColor: colors.brand.secondary }]}
      contentContainerStyle={styles.content}
      text1Style={styles.title}
      text2Style={styles.subtitle}
      text1NumberOfLines={2}
      text2NumberOfLines={3}
    />
  ),
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
});
