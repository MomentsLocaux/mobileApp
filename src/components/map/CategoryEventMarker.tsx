import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';

const PIN_VIEWBOX_WIDTH = 32;
const PIN_VIEWBOX_HEIGHT = 40;

/** Single teardrop path — head and pointer read as one shape. */
const BULB_CENTER_Y = 11;

const PIN_PATH = [
  'M 16 38',
  'C 16 38, 5 20, 5 12',
  'C 5 6, 10 2, 16 2',
  'C 22 2, 27 6, 27 12',
  'C 27 20, 16 38, 16 38',
  'Z',
].join(' ');

type Props = {
  color: string;
  Icon: LucideIcon;
  iconColor?: string;
  size?: number;
  variant?: 'pin' | 'cluster';
};

export const CategoryEventMarker: React.FC<Props> = React.memo(
  ({ color, Icon, iconColor = '#ffffff', size = 36, variant = 'pin' }) => {
    const pinHeight = Math.round(size * (PIN_VIEWBOX_HEIGHT / PIN_VIEWBOX_WIDTH));
    const iconSize = Math.max(14, Math.round(size * 0.46));
    const iconTop = Math.max(
      0,
      Math.round((pinHeight * BULB_CENTER_Y) / PIN_VIEWBOX_HEIGHT - iconSize / 2)
    );

    if (variant === 'cluster') {
      const clusterSize = Math.round(size * 0.92);
      return (
        <View collapsable={false} style={styles.clusterContainer}>
          <Svg width={clusterSize} height={clusterSize} viewBox="0 0 32 32">
            <Circle cx={16} cy={16} r={13} fill={color} stroke="#ffffff" strokeWidth={2.5} />
          </Svg>
        </View>
      );
    }

    return (
      <View collapsable={false} style={[styles.container, { width: size, height: pinHeight }]}>
        <Svg width={size} height={pinHeight} viewBox={`0 0 ${PIN_VIEWBOX_WIDTH} ${PIN_VIEWBOX_HEIGHT}`}>
          <Path d={PIN_PATH} fill={color} stroke="#ffffff" strokeWidth={2.2} strokeLinejoin="round" />
        </Svg>
        <View style={[styles.iconLayer, { top: iconTop }]}>
          <Icon size={iconSize} color={iconColor} strokeWidth={2.2} />
        </View>
      </View>
    );
  }
);
CategoryEventMarker.displayName = 'CategoryEventMarker';

const styles = StyleSheet.create({
  clusterContainer: {
    width: 40,
    height: 40,
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
