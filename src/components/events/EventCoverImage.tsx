import React from 'react';
import {
  Image as RNImage,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import {
  getEventCoverImageSource,
  type EventCoverVariant,
} from '@/utils/event-card-display';
import {
  detectCoverImageEngine,
  type CoverImageEngine,
} from '@/utils/cover-image-engine';
import {
  configureCoverPrefetch,
  enqueueCoverPrefetch,
  type CoverPrefetchPriority,
} from '@/utils/cover-prefetch-queue';

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
let coverImageEngine: CoverImageEngine | undefined;
let engineLogged = false;

function loadExpoImageModule(): { Image?: ExpoImageComponent } | null {
  if (expoImageModule !== undefined) return expoImageModule;
  try {
    // Optional until the native binary is rebuilt with expo-image.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expoImageModule = require('expo-image') as { Image?: ExpoImageComponent };
  } catch {
    expoImageModule = null;
  }
  return expoImageModule;
}

function getCoverImageEngine(): CoverImageEngine {
  if (!coverImageEngine) {
    coverImageEngine = detectCoverImageEngine(loadExpoImageModule);
    if (__DEV__ && !engineLogged) {
      engineLogged = true;
      console.info('[cover-image] engine=', coverImageEngine);
    }
  }
  return coverImageEngine;
}

function getExpoImage(): ExpoImageComponent | null {
  if (getCoverImageEngine() !== 'expo-image') return null;
  return loadExpoImageModule()?.Image ?? null;
}

async function prefetchOneCover(uri: string): Promise<void> {
  const ExpoImage = getExpoImage();
  if (ExpoImage?.prefetch) {
    await ExpoImage.prefetch(uri, 'memory-disk');
    return;
  }
  await RNImage.prefetch(uri);
}

configureCoverPrefetch(prefetchOneCover);

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

export function prefetchCoverUris(
  uris: string[],
  priority: CoverPrefetchPriority = 'ahead',
): void {
  enqueueCoverPrefetch(uris, priority);
}
