import React, { useMemo, useRef, useState } from 'react';
import { View, FlatList, Image, Pressable, Dimensions, StyleSheet, Text } from 'react-native';
import { Image as ImageIcon } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/components/ui/v2/theme';

export type MediaImage = {
  id: string;
  uri: string;
  authorId?: string;
  isUserGenerated?: boolean;
};

const { width } = Dimensions.get('window');
const HERO_HEIGHT = 300;
const THUMB_SIZE = 64;

type Props = {
  images: MediaImage[];
  onAddPhoto?: () => void;
};

export function PlaceMediaGallery({ images, onAddPhoto }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<MediaImage>>(null);

  const data = useMemo(() => images.filter((img) => img?.uri), [images]);
  const showAdd = typeof onAddPhoto === 'function';
  const thumbData = useMemo(
    () => (showAdd ? [...data, { id: 'add', uri: '' }] : data),
    [data, showAdd]
  );

  const handleThumbPress = (index: number) => {
    if (!data.length) return;
    listRef.current?.scrollToIndex({ index, animated: true });
    setActiveIndex(index);
  };

  return (
    <View>
      <View style={styles.heroWrapper}>
        {data.length > 0 ? (
          <FlatList
            ref={listRef}
            data={data}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / width);
              setActiveIndex(index);
            }}
            renderItem={({ item }) => (
              <Image source={{ uri: item.uri }} style={styles.heroImage} />
            )}
          />
        ) : (
          <View style={styles.heroPlaceholder}>
            <ImageIcon size={40} color={colors.scale.neutral[400]} />
          </View>
        )}

        {showAdd && (
          <Pressable style={styles.addPhotoCta} onPress={onAddPhoto}>
            <Text style={styles.addPhotoText}>＋ Ajouter une photo</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={thumbData}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbList}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) =>
          item.id === 'add' ? (
            <Pressable style={styles.addThumb} onPress={onAddPhoto}>
              <Text style={styles.addThumbText}>＋</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => handleThumbPress(index)}>
              <Image
                source={{ uri: item.uri }}
                style={[styles.thumb, index === activeIndex && styles.thumbActive]}
              />
            </Pressable>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrapper: {
    position: 'relative',
    width: '100%',
    height: HERO_HEIGHT,
    backgroundColor: colors.scale.neutral[100],
  },
  heroImage: {
    width,
    height: HERO_HEIGHT,
    resizeMode: 'cover',
  },
  heroPlaceholder: {
    width,
    height: HERO_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scale.neutral[100],
  },
  addPhotoCta: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  addPhotoText: {
    ...typography.bodySmall,
    color: colors.scale.neutral[0],
    fontWeight: '600',
  },
  thumbList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: borderRadius.md,
    opacity: 0.8,
  },
  thumbActive: {
    opacity: 1,
    borderWidth: 2,
    borderColor: colors.scale.neutral[900],
  },
  addThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.scale.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumbText: {
    fontSize: 22,
    color: colors.scale.neutral[600],
  },
});
