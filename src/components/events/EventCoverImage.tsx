import React from 'react';
import {
  Image as RNImage,
  NativeModules,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import {
  getEventCoverImageSource,
  type EventCoverVariant,
} from '@/utils/event-card-display';

type ContentFit = 'cover' | 'contain';

type ExpoImageComponent = React.ComponentType<{
  source: { uri: string; cacheKey?: string; width?: number; height?: number };
  style?: StyleProp<ImageStyle>;
  contentFit?: ContentFit;
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  recyclingKey?: string;
  transition?: number;
  onLoadEnd?: () => void;
  onError?: () => void;
}> & {
  prefetch?: (urls: string | string[], policy?: string) => Promise<boolean>;
};

let expoImageModule: { Image?: ExpoImageComponent } | null | undefined;

function getExpoImage(): ExpoImageComponent | null {
  const native = NativeModules as { ExpoImage?: unknown };
  if (!native?.ExpoImage) return null;
  if (expoImageModule === undefined) {
    try {
      // Optional until the native binary is rebuilt with expo-image.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      expoImageModule = require('expo-image') as { Image?: ExpoImageComponent };
    } catch {
      expoImageModule = null;
    }
  }
  return expoImageModule?.Image ?? null;
}

export type EventCoverImageProps = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  recyclingKey?: string;
  variant?: EventCoverVariant;
  contentFit?: ContentFit;
  onLoadEnd?: () => void;
  onError?: () => void;
};

export function EventCoverImage({
  uri,
  style,
  recyclingKey,
  variant = 'detail',
  contentFit = 'cover',
  onLoadEnd,
  onError,
}: EventCoverImageProps) {
  const source = getEventCoverImageSource(uri, variant);
  const ExpoImage = getExpoImage();
  if (ExpoImage) {
    return (
      <ExpoImage
        source={source}
        style={style}
        contentFit={contentFit}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey ?? source.cacheKey}
        transition={0}
        onLoadEnd={onLoadEnd}
        onError={onError}
      />
    );
  }

  return (
    <RNImage
      source={{ uri: source.uri }}
      style={style}
      fadeDuration={0}
      resizeMode={contentFit}
      onLoadEnd={onLoadEnd}
      onError={onError}
    />
  );
}

export function prefetchCoverUris(uris: string[]): void {
  const unique = uris.filter(Boolean);
  if (!unique.length) return;
  const ExpoImage = getExpoImage();
  if (ExpoImage?.prefetch) {
    void ExpoImage.prefetch(unique, 'memory-disk').catch(() => undefined);
    return;
  }
  unique.forEach((uri) => {
    void RNImage.prefetch(uri).catch(() => undefined);
  });
}
