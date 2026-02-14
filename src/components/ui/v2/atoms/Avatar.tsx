import React from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, shadows } from '../theme';
import { Typography } from './Typography';

type AvatarProps = {
  uri?: string | null;
  source?: ImageSourcePropType;
  name?: string | null;
  size?: number;
  badge?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({ uri, source, name, size = 56, badge, style }: AvatarProps) {
  const fallback = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const imageSource = source ?? (uri ? { uri } : undefined);

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      {imageSource ? (
        <Image source={imageSource} style={[styles.image, { borderRadius: size / 2 }]} />
      ) : (
        <View style={[styles.fallback, { borderRadius: size / 2 }]}>
          <Typography variant="subsection" color={colors.textPrimary}>
            {fallback}
          </Typography>
        </View>
      )}
      {badge ? <View style={styles.badgeSlot}>{badge}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    overflow: 'visible',
    ...shadows.subtleGlow,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceLevel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSlot: {
    position: 'absolute',
    right: -8,
    bottom: -4,
  },
});
