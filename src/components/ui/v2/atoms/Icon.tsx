import React from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { colors } from '../theme';

type IconProps = {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ icon: IconComponent, size = 20, color = colors.textPrimary, strokeWidth = 2 }: IconProps) {
  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} />;
}
