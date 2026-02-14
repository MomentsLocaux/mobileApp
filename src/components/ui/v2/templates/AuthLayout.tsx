import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { Typography } from '../atoms/Typography';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  contentContainerStyle,
}: AuthLayoutProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerBlock}>
            <View style={styles.logoPlaceholder}>
              <Typography variant="bodyStrong" color={colors.textSecondary}>
                LOGO
              </Typography>
            </View>

            <View style={styles.titleBlock}>
              <Typography variant="displayLarge" style={styles.title}>
                {title}
              </Typography>
              <Typography variant="body" color={colors.textSecondary} style={styles.subtitle}>
                {subtitle}
              </Typography>
            </View>
          </View>

          <View style={styles.contentBlock}>{children}</View>

          {footer ? <View style={styles.footerBlock}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  headerBlock: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  logoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLevel1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  titleBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 24,
  },
  contentBlock: {
    gap: spacing.lg,
  },
  footerBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
});
