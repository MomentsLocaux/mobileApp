import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

type Props = {
  color: string;
  Icon: LucideIcon;
  iconColor?: string;
  size?: number;
};

export const CategoryEventMarker: React.FC<Props> = React.memo(
  ({ color, Icon, iconColor = '#ffffff', size = 36 }) => {
    const headSize = Math.round(size * 0.72);
    const iconSize = Math.max(12, Math.round(size * 0.34));
    const pointerWidth = Math.round(headSize * 0.26);
    const pointerHeight = Math.round(headSize * 0.32);

    return (
      <View collapsable={false} style={styles.container}>
        <View
          style={[styles.head, { width: headSize, height: headSize, borderRadius: headSize / 2, backgroundColor: color }]}
        >
          <View style={styles.innerRing}>
            <Icon size={iconSize} color={iconColor} strokeWidth={2.2} />
          </View>
        </View>
        <View
          style={[
            styles.pointer,
            {
              borderLeftWidth: pointerWidth,
              borderRightWidth: pointerWidth,
              borderTopWidth: pointerHeight,
              borderTopColor: color,
            },
          ]}
        />
      </View>
    );
  }
);
CategoryEventMarker.displayName = 'CategoryEventMarker';

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  innerRing: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
  },
  pointer: {
    marginTop: -2,
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
