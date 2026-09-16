import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  Modal,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ImageIcon, X } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { EventCoverImage } from './EventCoverImage';

export type MediaImage = {
  id: string;
  uri: string;
  authorId?: string;
  isUserGenerated?: boolean;
};

const HERO_HEIGHT = 300;
const VIEWER_CHROME = 40;

type Props = {
  images: MediaImage[];
  communityImages?: MediaImage[];
  onAddPhoto?: () => void;
  onPrimaryImageReady?: () => void;
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

export function PlaceMediaGallery({
  images,
  communityImages = [],
  onAddPhoto,
  onPrimaryImageReady,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerTab, setViewerTab] = useState<'organizer' | 'community'>('organizer');
  const [viewerIndex, setViewerIndex] = useState(0);
  const [stageSize, setStageSize] = useState({ width: windowWidth, height: HERO_HEIGHT + 220 });
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
  const stageWidth = stageSize.width || windowWidth;

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

  const selectViewerTab = (tab: 'organizer' | 'community') => {
    setViewerTab(tab);
    setViewerIndex(0);
    requestAnimationFrame(() => {
      viewerListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  };

  const singleHero = organizerData.length === 1 ? organizerData[0] : null;

  return (
    <View>
      <View style={styles.heroWrapper}>
        {singleHero ? (
          <Pressable onPress={() => openViewer('organizer', 0)}>
            <EventCoverImage
              uri={singleHero.uri}
              recyclingKey={singleHero.id}
              variant="detail"
              style={[styles.heroImage, { width: windowWidth }]}
              onLoadEnd={onPrimaryImageReady}
            />
          </Pressable>
        ) : organizerData.length > 1 ? (
          <FlatList
            ref={listRef}
            data={organizerData}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            getItemLayout={(_, index) => ({
              length: windowWidth,
              offset: windowWidth * index,
              index,
            })}
            initialNumToRender={1}
            renderItem={({ item, index }) => (
              <Pressable onPress={() => openViewer('organizer', index)}>
                <EventCoverImage
                  uri={item.uri}
                  recyclingKey={item.id}
                  variant="detail"
                  style={[styles.heroImage, { width: windowWidth }]}
                  onLoadEnd={index === 0 ? onPrimaryImageReady : undefined}
                />
              </Pressable>
            )}
          />
        ) : (
          <View style={[styles.heroPlaceholder, { width: windowWidth }]}>
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

      <Modal
        visible={viewerVisible}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerVisible(false)}
      >
        <View style={styles.viewerContainer}>
          <StatusBar barStyle="light-content" />
          <View
            style={[
              styles.viewerHeader,
              {
                paddingTop: insets.top + spacing.md,
                paddingBottom: spacing.md,
              },
            ]}
          >
            <View style={styles.viewerHeaderSide} />
            <View style={styles.viewerTabs}>
              <Pressable
                style={[styles.viewerTab, viewerTab === 'organizer' && styles.viewerTabActive]}
                onPress={() => selectViewerTab('organizer')}
                accessibilityRole="button"
                accessibilityState={{ selected: viewerTab === 'organizer' }}
                accessibilityLabel="Photos organisateur"
              >
                <Text style={[styles.viewerTabText, viewerTab === 'organizer' && styles.viewerTabTextActive]}>
                  Organisateur
                </Text>
              </Pressable>
              <Pressable
                style={[styles.viewerTab, viewerTab === 'community' && styles.viewerTabActive]}
                onPress={() => selectViewerTab('community')}
                accessibilityRole="button"
                accessibilityState={{ selected: viewerTab === 'community' }}
                accessibilityLabel="Photos communauté"
              >
                <Text style={[styles.viewerTabText, viewerTab === 'community' && styles.viewerTabTextActive]}>
                  Communauté
                </Text>
              </Pressable>
            </View>
            <View style={styles.viewerHeaderSide}>
              <Pressable
                style={styles.viewerClose}
                onPress={() => setViewerVisible(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Fermer"
              >
                <X size={18} color="#FFF" />
              </Pressable>
            </View>
          </View>

          <View
            style={styles.viewerStage}
            onLayout={(e) => {
              const { width: nextWidth, height: nextHeight } = e.nativeEvent.layout;
              if (nextWidth === stageSize.width && nextHeight === stageSize.height) return;
              setStageSize({ width: nextWidth, height: nextHeight });
            }}
          >
            {currentViewerData.length > 0 ? (
              <FlatList
                ref={viewerListRef}
                data={currentViewerData}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => `${viewerTab}-${item.id}`}
                extraData={`${viewerTab}:${stageWidth}:${stageSize.height}`}
                getItemLayout={(_, index) => ({
                  length: stageWidth,
                  offset: stageWidth * index,
                  index,
                })}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / stageWidth);
                  setViewerIndex(index);
                }}
                renderItem={({ item }) => (
                  <View style={{ width: stageWidth, height: stageSize.height }}>
                    <EventCoverImage
                      uri={item.uri}
                      recyclingKey={`viewer-${item.id}`}
                      contentFit="contain"
                      style={{ width: stageWidth, height: stageSize.height }}
                    />
                  </View>
                )}
              />
            ) : (
              <View style={styles.viewerEmpty}>
                <ImageIcon size={34} color={colors.neutral[400]} />
                <Text style={styles.viewerEmptyText}>Aucune image disponible</Text>
              </View>
            )}
          </View>

          <View style={[styles.viewerFooter, { paddingBottom: insets.bottom + spacing.md }]}>
            {currentViewerData.length > 1 ? (
              <Text style={styles.viewerIndex}>
                {viewerIndex + 1}/{currentViewerData.length}
              </Text>
            ) : (
              <View style={styles.viewerIndexSpacer} />
            )}
          </View>
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
    backgroundColor: colors.brand.page,
  },
  heroImage: {
    height: HERO_HEIGHT,
  },
  heroPlaceholder: {
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  viewerHeaderSide: {
    width: VIEWER_CHROME,
    height: VIEWER_CHROME,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  viewerTabs: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  viewerTab: {
    minHeight: VIEWER_CHROME,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: colors.brand.onAccent,
  },
  viewerClose: {
    width: VIEWER_CHROME,
    height: VIEWER_CHROME,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  viewerStage: {
    flex: 1,
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
  viewerFooter: {
    minHeight: VIEWER_CHROME,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
  },
  viewerIndex: {
    ...typography.caption,
    color: '#FFF',
    textAlign: 'center',
  },
  viewerIndexSpacer: {
    height: 16,
  },
});
