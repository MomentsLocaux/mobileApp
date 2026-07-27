import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { AppBackground } from '@/components/ui/AppBackground';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';

type Props = {
  style?: StyleProp<ViewStyle>;
  opacity?: number;
};

/** AppBackground tinted by ADR_007 identity accent (safe default if unauthenticated). */
export function IdentityAppBackground({ style, opacity }: Props) {
  const { accent } = useAccountIdentity();
  return <AppBackground style={style} opacity={opacity} accentColor={accent.accent} />;
}
