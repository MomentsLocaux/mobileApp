import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';

/** ViewBox sized so the tip sits on the bottom edge (Mapbox `iconAnchor: 'bottom'`). */
const PIN_VB_W = 40;
const PIN_VB_H = 48;
const HEAD_CX = 20;
const HEAD_CY = 17;

/**
 * Soft modern pin: colored body + white icon disc.
 * Keeps category color as the brand signal while maximizing icon contrast.
 */
const PIN_BODY = [
  'M 20 46',
  'C 20 46, 6.5 28, 6.5 17',
  'C 6.5 9.5, 12.5 4, 20 4',
  'C 27.5 4, 33.5 9.5, 33.5 17',
  'C 33.5 28, 20 46, 20 46',
  'Z',
].join(' ');

const getLuminance = (hexColor: string): number => {
  const hex = hexColor.replace('#', '').trim();
  if (hex.length !== 6) return 0.4;
  const toLinear = (channel: number) => {
    const n = channel / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

/** Icon on white disc: category color when dark enough, otherwise near-black. */
const resolveIconColor = (categoryColor: string, explicit?: string): string => {
  if (explicit && explicit.toLowerCase() !== '#ffffff' && explicit.toLowerCase() !== '#fff') {
    return explicit;
  }
  return getLuminance(categoryColor) > 0.55 ? '#1A1A1B' : categoryColor;
};

type Props = {
  color: string;
  Icon: LucideIcon;
  iconColor?: string;
  size?: number;
  variant?: 'pin' | 'cluster';
};

export const CategoryEventMarker: React.FC<Props> = React.memo(
  ({ color, Icon, iconColor, size = 42, variant = 'pin' }) => {
    const resolvedIconColor = useMemo(
      () => resolveIconColor(color, iconColor),
      [color, iconColor]
    );

    if (variant === 'cluster') {
      const clusterSize = Math.round(size * 1.05);
      return (
        <View collapsable={false} style={[styles.clusterContainer, { width: clusterSize, height: clusterSize }]}>
          <Svg width={clusterSize} height={clusterSize} viewBox="0 0 40 40">
            <Defs>
              <RadialGradient id="clusterGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <Stop offset="100%" stopColor={color} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={20} cy={20} r={19} fill="url(#clusterGlow)" />
            <Circle cx={20} cy={20} r={14.5} fill={color} />
            <Circle
              cx={20}
              cy={20}
              r={14.5}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={2.4}
              strokeOpacity={0.95}
            />
            <Circle cx={20} cy={20} r={10.2} fill="rgba(15,23,25,0.18)" />
          </Svg>
        </View>
      );
    }

    const pinHeight = Math.round(size * (PIN_VB_H / PIN_VB_W));
    const iconSize = Math.max(15, Math.round(size * 0.42));
    const iconTop = Math.round((pinHeight * HEAD_CY) / PIN_VB_H - iconSize / 2);

    return (
      <View collapsable={false} style={[styles.container, { width: size, height: pinHeight }]}>
        <Svg width={size} height={pinHeight} viewBox={`0 0 ${PIN_VB_W} ${PIN_VB_H}`}>
          <Defs>
            <RadialGradient id="pinHalo" cx="50%" cy="36%" r="48%">
              <Stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <Stop offset="100%" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {/* Soft ground shadow at tip */}
          <Ellipse cx={HEAD_CX} cy={45.5} rx={7} ry={2.2} fill="rgba(0,0,0,0.22)" />

          {/* Soft color halo behind the head */}
          <Circle cx={HEAD_CX} cy={HEAD_CY} r={18} fill="url(#pinHalo)" />

          {/* Colored pin body */}
          <Path
            d={PIN_BODY}
            fill={color}
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {/* White icon disc for max contrast */}
          <Circle
            cx={HEAD_CX}
            cy={HEAD_CY}
            r={9.2}
            fill="#FFFFFF"
            stroke="rgba(15,23,25,0.06)"
            strokeWidth={1}
          />
        </Svg>

        <View style={[styles.iconLayer, { top: iconTop }]}>
          <Icon size={iconSize} color={resolvedIconColor} strokeWidth={2.35} />
        </View>
      </View>
    );
  }
);
CategoryEventMarker.displayName = 'CategoryEventMarker';

const styles = StyleSheet.create({
  clusterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  iconLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
