import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import type { SocialProvider } from '@/services/oauth.service';

type Props = {
  onProviderPress: (provider: SocialProvider) => Promise<void>;
  disabled?: boolean;
  /** Login photo uses light glass; register page is also light. */
  variant?: 'light' | 'dark';
};

const PROVIDERS: { id: SocialProvider; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'google', label: 'Google', icon: 'logo-google' },
  { id: 'apple', label: 'Apple', icon: 'logo-apple' },
  { id: 'facebook', label: 'Facebook', icon: 'logo-facebook' },
];

/** Facebook OAuth is not production-ready; keep the provider listed so it can be re-enabled later. */
const HIDDEN_PROVIDERS = new Set<SocialProvider>(['facebook']);

export function SocialLoginButtons({ onProviderPress, disabled, variant = 'light' }: Props) {
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);
  const isLight = variant === 'light';

  const handlePress = async (provider: SocialProvider) => {
    if (disabled || loadingProvider) return;
    setLoadingProvider(provider);
    try {
      await onProviderPress(provider);
    } finally {
      setLoadingProvider(null);
    }
  };

  const visibleProviders = PROVIDERS.filter((p) => {
    if (HIDDEN_PROVIDERS.has(p.id)) return false;
    if (p.id === 'apple') return Platform.OS === 'ios';
    return true;
  });
  const iconColor = isLight ? (colors.brand.ink as string) : '#fff';

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, isLight ? styles.dividerLineLight : styles.dividerLineDark]} />
        <Text style={[styles.dividerText, isLight ? styles.dividerTextLight : styles.dividerTextDark]}>
          ou continuer avec
        </Text>
        <View style={[styles.dividerLine, isLight ? styles.dividerLineLight : styles.dividerLineDark]} />
      </View>

      <View style={styles.buttons}>
        {visibleProviders.map((provider) => {
          const isLoading = loadingProvider === provider.id;
          return (
            <TouchableOpacity
              key={provider.id}
              style={[styles.button, isLight ? styles.buttonLight : styles.buttonDark]}
              onPress={() => handlePress(provider.id)}
              disabled={disabled || !!loadingProvider}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={iconColor} size="small" />
              ) : (
                <>
                  <Ionicons name={provider.icon} size={20} color={iconColor} />
                  <Text style={[styles.buttonText, isLight ? styles.buttonTextLight : styles.buttonTextDark]}>
                    {provider.label}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerLineLight: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dividerLineDark: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dividerText: {
    ...typography.caption,
  },
  dividerTextLight: {
    color: 'rgba(255,255,255,0.9)',
  },
  dividerTextDark: {
    color: 'rgba(255,255,255,0.65)',
  },
  buttons: {
    gap: spacing.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
  },
  buttonLight: {
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  buttonDark: {
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  buttonTextLight: {
    color: colors.brand.ink as string,
  },
  buttonTextDark: {
    color: '#fff',
  },
});
