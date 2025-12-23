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
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
};

export const EventImageCarousel: React.FC<Props> = ({
  images,
  height = 220,
  borderRadius: radius = borderRadius.lg,
  showDots = true,
  backgroundColor = colors.neutral[100],
  onSwipeStart,
  onSwipeEnd,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const validImages = useMemo(() => {
    const seen = new Set<string>();
    const clean = (images || []).filter(
      (uri) => typeof uri === 'string' && uri.trim().length > 0 && !failed.has(uri.trim())
    ) as string[];
    return clean.filter((uri) => {
      if (seen.has(uri)) return false;
      seen.add(uri);
      return true;
    });
  }, [images, failed]);

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
        scrollEnabled={validImages.length > 1}
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={handleLayout}
        onScrollBeginDrag={onSwipeStart}
        onScrollEndDrag={onSwipeEnd}
        onMomentumScrollBegin={onSwipeStart}
        onMomentumScrollEnd={(e) => {
          handleMomentumEnd(e);
          onSwipeEnd?.();
        }}
        scrollEventThrottle={16}
      >
        {hasImages ? (
          validImages.map((uri, idx) => (
            <Image
              key={`${uri}-${idx}`}
              source={{ uri }}
              onError={() =>
                setFailed((prev) => {
                  const next = new Set(prev);
                  next.add(uri);
                  return next;
                })
              }
              style={[
                styles.image,
                { width: width || '100%', height, borderRadius: radius, backgroundColor },
              ]}
            />
          ))
        ) : (
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
