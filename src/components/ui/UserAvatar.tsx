import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { getIllustratedAvatar, isRemoteAvatarUrl } from '@/constants/avatar-presets';
import { colors, typography } from '@/constants/theme';
import { PresetAvatarArt } from './PresetAvatarArt';

type Props = {
  uri?: string | null;
  name?: string | null;
  size: number;
  style?: StyleProp<ViewStyle>;
  fallback?: 'initial' | 'empty';
  onRemoteError?: () => void;
};

export function UserAvatar({
  uri,
  name,
  size,
  style,
  fallback = 'initial',
  onRemoteError,
}: Props) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const preset = getIllustratedAvatar(uri);
  const showRemote = !preset && isRemoteAvatarUrl(uri) && failedUri !== uri;
  const initial = (name || '?').trim().slice(0, 1).toUpperCase() || '?';
  const radius = size / 2;

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.brand.surfaceMuted,
        },
        style,
      ]}
    >
      {preset ? (
        <PresetAvatarArt preset={preset} size={size} />
      ) : showRemote ? (
        <Image
          source={{ uri: uri as string }}
          style={{ width: size, height: size, borderRadius: radius }}
          onError={() => {
            setFailedUri(uri ?? null);
            onRemoteError?.();
          }}
          accessibilityIgnoresInvertColors
        />
      ) : fallback === 'initial' ? (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}>
          <Text style={[styles.initial, { fontSize: Math.max(11, Math.round(size * 0.38)) }]}>{initial}</Text>
        </View>
      ) : (
        <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.brand.surfaceMuted }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 181, 24, 0.16)',
  },
  initial: {
    ...typography.h5,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
});
