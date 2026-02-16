import React, { useMemo, useRef, useState } from 'react';
import { View, FlatList, Image, Pressable, Dimensions, StyleSheet, Text, Modal } from 'react-native';
import { Image as ImageIcon, X } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

export type MediaImage = {
  id: string;
  uri: string;
  authorId?: string;
  isUserGenerated?: boolean;
};

const { width } = Dimensions.get('window');
const HERO_HEIGHT = 300;

type Props = {
  images: MediaImage[];
  communityImages?: MediaImage[];
  onAddPhoto?: () => void;
  children?: React.ReactNode;
};

const normalizeImageUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'none') return null;
  return trimmed;
};

export function PlaceMediaGallery({ images, communityImages = [], onAddPhoto, children }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerTab, setViewerTab] = useState<'organizer' | 'community'>('organizer');
  const [viewerIndex, setViewerIndex] = useState(0);
  const listRef = useRef<FlatList<MediaImage>>(null);
  const viewerListRef = useRef<FlatList<MediaImage>>(null);

  const organizerData = useMemo(
    () =>
      images
        .map((img) => {
          const uri = normalizeImageUrl(img?.uri);
          return uri ? { ...img, uri } : null;
        })
        .filter((img): img is MediaImage => !!img),
    [images],
  );
  const communityData = useMemo(
    () =>
      communityImages
        .map((img) => {
          const uri = normalizeImageUrl(img?.uri);
          return uri ? { ...img, uri } : null;
        })
        .filter((img): img is MediaImage => !!img),
    [communityImages],
  );
  const showAdd = typeof onAddPhoto === 'function';
  const currentViewerData = viewerTab === 'organizer' ? organizerData : communityData;

  const openViewer = (tab: 'organizer' | 'community', index = 0) => {
    const targetData = tab === 'organizer' ? organizerData : communityData;
    if (!targetData.length) return;
    setViewerTab(tab);
    setViewerIndex(index);
    setViewerVisible(true);
    requestAnimationFrame(() => {
      viewerListRef.current?.scrollToIndex({ index, animated: false });
    });
  };

  return (
    <View>
      <View style={styles.heroWrapper}>
        {organizerData.length > 0 ? (
          <FlatList
            ref={listRef}
            data={organizerData}
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
              <Pressable onPress={() => openViewer('organizer', activeIndex)}>
                <Image source={{ uri: item.uri }} style={styles.heroImage} />
              </Pressable>
            )}
          />
        ) : (
          <View style={styles.heroPlaceholder}>
            <ImageIcon size={40} color={colors.neutral[400]} />
          </View>
        )}

        {showAdd && (
          <Pressable style={styles.addPhotoCta} onPress={onAddPhoto}>
            <Text style={styles.addPhotoText}>＋</Text>
          </Pressable>
        )}
        {children}
      </View>

      <Modal visible={viewerVisible} transparent={false} animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
            <View style={styles.viewerTabs}>
              <Pressable
                style={[styles.viewerTab, viewerTab === 'organizer' && styles.viewerTabActive]}
                onPress={() => {
                  setViewerTab('organizer');
                  setViewerIndex(0);
                  requestAnimationFrame(() => {
                    viewerListRef.current?.scrollToOffset({ offset: 0, animated: false });
                  });
                }}
              >
                <Text style={[styles.viewerTabText, viewerTab === 'organizer' && styles.viewerTabTextActive]}>
                  Organisateur
                </Text>
              </Pressable>
              <Pressable
                style={[styles.viewerTab, viewerTab === 'community' && styles.viewerTabActive]}
                onPress={() => {
                  setViewerTab('community');
                  setViewerIndex(0);
                  requestAnimationFrame(() => {
                    viewerListRef.current?.scrollToOffset({ offset: 0, animated: false });
                  });
                }}
              >
                <Text style={[styles.viewerTabText, viewerTab === 'community' && styles.viewerTabTextActive]}>
                  Communauté
                </Text>
              </Pressable>
            </View>
            <Pressable style={styles.viewerClose} onPress={() => setViewerVisible(false)}>
              <X size={18} color="#FFF" />
            </Pressable>
          </View>

          {currentViewerData.length > 0 ? (
            <FlatList
              ref={viewerListRef}
              data={currentViewerData}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `${viewerTab}-${item.id}`}
              extraData={viewerTab}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setViewerIndex(index);
              }}
              renderItem={({ item }) => (
                <Image source={{ uri: item.uri }} style={styles.viewerImage} resizeMode="contain" />
              )}
            />
          ) : (
            <View style={styles.viewerEmpty}>
              <ImageIcon size={34} color={colors.neutral[400]} />
              <Text style={styles.viewerEmptyText}>Aucune image disponible</Text>
            </View>
          )}

          {currentViewerData.length > 1 ? (
            <Text style={styles.viewerIndex}>{viewerIndex + 1}/{currentViewerData.length}</Text>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrapper: {
    position: 'relative',
    width: '100%',
    height: HERO_HEIGHT,
    backgroundColor: colors.brand.background,
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
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  addPhotoCta: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 24,
    lineHeight: 24,
    color: '#FFF',
    fontWeight: '600',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewerHeader: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewerTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  viewerTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  viewerTabActive: {
    backgroundColor: colors.brand.secondary,
  },
  viewerTabText: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  viewerTabTextActive: {
    color: '#FFF',
  },
  viewerClose: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  viewerImage: {
    width,
    height: HERO_HEIGHT + 220,
  },
  viewerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  viewerEmptyText: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  viewerIndex: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    ...typography.caption,
    color: '#FFF',
  },
});
