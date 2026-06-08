import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { spacing, typography } from '@/constants/theme';
import type { SocialProvider } from '@/services/oauth.service';

type Props = {
  onProviderPress: (provider: SocialProvider) => Promise<void>;
  disabled?: boolean;
};

const PROVIDERS: { id: SocialProvider; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'google', label: 'Google', icon: 'logo-google' },
  { id: 'apple', label: 'Apple', icon: 'logo-apple' },
  { id: 'facebook', label: 'Facebook', icon: 'logo-facebook' },
];

export function SocialLoginButtons({ onProviderPress, disabled }: Props) {
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);

  const handlePress = async (provider: SocialProvider) => {
    if (disabled || loadingProvider) return;
    setLoadingProvider(provider);
    try {
      await onProviderPress(provider);
    } finally {
      setLoadingProvider(null);
    }
  };

  const visibleProviders = PROVIDERS.filter((p) => p.id !== 'apple' || Platform.OS === 'ios');

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou continuer avec</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.buttons}>
        {visibleProviders.map((provider) => {
          const isLoading = loadingProvider === provider.id;
          return (
            <TouchableOpacity
              key={provider.id}
              style={styles.button}
              onPress={() => handlePress(provider.id)}
              disabled={disabled || !!loadingProvider}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name={provider.icon} size={20} color="#fff" />
                  <Text style={styles.buttonText}>{provider.label}</Text>
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
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dividerText: {
    ...typography.caption,
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
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
