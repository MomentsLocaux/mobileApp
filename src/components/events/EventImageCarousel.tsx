import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Image, ScrollView, LayoutChangeEvent } from 'react-native';
import { Image as ImageIcon } from 'lucide-react-native';
import { colors, borderRadius, spacing } from '@/constants/theme';

type Props = {
  images: (string | null | undefined)[];
  height?: number;
  borderRadius?: number;
  showDots?: boolean;
  backgroundColor?: string;
};

export const EventImageCarousel: React.FC<Props> = ({
  images,
  height = 220,
  borderRadius: radius = borderRadius.lg,
  showDots = true,
  backgroundColor = colors.neutral[100],
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [width, setWidth] = useState(0);

  const validImages = useMemo(
    () => (images || []).filter((uri) => typeof uri === 'string' && uri.length > 0) as string[],
    [images]
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const handleMomentumEnd = (e: any) => {
    if (!width) return;
    const nextIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(nextIndex);
  };

  const hasImages = validImages.length > 0;

  return (
    <View style={[styles.container, { height }, !hasImages && { backgroundColor }]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={handleLayout}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
      >
        {hasImages
          ? validImages.map((uri, idx) => (
              <Image
                key={`${uri}-${idx}`}
                source={{ uri }}
                style={[
                  styles.image,
                  { width: width || '100%', height, borderRadius: radius, backgroundColor },
                ]}
              />
            ))
          : (
            <View
              style={[
                styles.placeholder,
                { width: width || '100%', height, borderRadius: radius, backgroundColor },
              ]}
            >
              <ImageIcon size={48} color={colors.neutral[400]} />
            </View>
          )}
      </ScrollView>

      {showDots && hasImages && (
        <View style={styles.dotsContainer}>
          {validImages.map((_, idx) => (
            <View
              key={idx}
              style={[styles.dot, idx === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral[200],
    opacity: 0.6,
  },
  dotActive: {
    backgroundColor: colors.primary[600],
    opacity: 1,
  },
});
