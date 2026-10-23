import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from 'react-native-google-mobile-ads';
import { colors, spacing, typography } from '@/constants/theme';
import {
  loadNativeAd,
  prepareAdRequest,
  resetAdsConsentCache,
  subscribeAdsConsent,
  type PreparedAdRequest,
} from '@/services/ads.service';
import { commitAdImpression, releaseAdSlot, reserveAdSlot } from '@/utils/ads-policy';

async function requestAdConsent(): Promise<PreparedAdRequest> {
  try {
    return await prepareAdRequest();
  } catch (error) {
    if (__DEV__) console.warn('[ads] consentement échec', error);
    resetAdsConsentCache();
    return prepareAdRequest();
  }
}

export function AdCardNative({ slotId, inset = false }: { slotId: string; inset?: boolean }) {
  const [ad, setAd] = useState<NativeAd | null>(null);
  const [adHeight, setAdHeight] = useState<number>();
  const [consentGeneration, setConsentGeneration] = useState(0);
  const displayed = useRef(false);
  const held = useRef(false);

  useEffect(() => subscribeAdsConsent(() => setConsentGeneration((generation) => generation + 1)), []);

  useEffect(() => {
    displayed.current = false;
    held.current = false;
    if (!reserveAdSlot(slotId)) {
      if (__DEV__) console.warn('[ads] quota', slotId);
      return;
    }
    held.current = true;
    let cancelled = false;
    let loaded: NativeAd | null = null;
    const dropPending = () => {
      if (displayed.current) return;
      held.current = false;
      releaseAdSlot(slotId);
    };

    void (async () => {
      let request;
      try {
        request = await requestAdConsent();
      } catch (error) {
        if (!cancelled) dropPending();
        if (__DEV__) console.warn('[ads] consentement échec', slotId, error);
        return;
      }
      if (cancelled || !request.canRequest) {
        if (!cancelled) dropPending();
        if (__DEV__) console.warn('[ads] consentement bloqué', slotId, request);
        return;
      }
      try {
        const nativeAd = await loadNativeAd(request);
        if (cancelled) {
          nativeAd.destroy();
          return;
        }
        loaded = nativeAd;
        setAd(nativeAd);
      } catch (error) {
        if (!cancelled) dropPending();
        if (__DEV__) console.warn('[ads] chargement échec', slotId, error);
      }
    })();

    return () => {
      cancelled = true;
      loaded?.destroy();
      setAd(null);
      if (held.current && !displayed.current) releaseAdSlot(slotId);
    };
  }, [slotId, consentGeneration]);

  if (!ad) return null;

  return (
    <View
      style={[styles.listing, inset && styles.listingInset]}
      accessibilityRole="summary"
      accessibilityLabel="Publicité"
      onLayout={() => {
        if (displayed.current) return;
        displayed.current = true;
        commitAdImpression(slotId);
      }}
    >
      <NativeAdView key={ad.responseId} nativeAd={ad} style={[styles.ad, { height: adHeight }]}>
        {/* Keep one native content container so Fabric preserves asset coordinates. */}
        <View
          collapsable={false}
          style={styles.adContent}
          onLayout={({ nativeEvent }) => {
            // Measure content, not the constrained parent: this also adapts to
            // rotation and large text. Round outward for the native validator.
            setAdHeight(Math.ceil(nativeEvent.layout.height) + 1);
          }}
        >
          <View collapsable={false} style={styles.media}>
            {/* Size the media in the flow using the feed frame's ratio.
                Contain preserves the complete creative without cropping. */}
            <NativeMediaView resizeMode="contain" style={styles.mediaContent} />
            <View pointerEvents="none" style={styles.badge}>
              <Text style={styles.badgeText}>Publicité</Text>
            </View>
          </View>
          <View style={styles.copy}>
            <View style={styles.kickerRow}>
              {ad.icon?.url ? (
                <NativeAsset assetType={NativeAssetType.ICON}>
                  <Image source={{ uri: ad.icon.url }} style={styles.icon} />
                </NativeAsset>
              ) : null}
              {ad.advertiser ? (
                <View collapsable={false} style={styles.kickerAsset}>
                  <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                    <Text style={styles.kicker}>{ad.advertiser}</Text>
                  </NativeAsset>
                </View>
              ) : (
                <Text style={styles.kicker} numberOfLines={1}>Publicité</Text>
              )}
            </View>
            <View collapsable={false} style={styles.asset}>
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <Text style={styles.title}>{ad.headline}</Text>
              </NativeAsset>
            </View>
            {ad.body ? (
              <View collapsable={false} style={styles.asset}>
                <NativeAsset assetType={NativeAssetType.BODY}>
                  <Text style={styles.detail}>{ad.body}</Text>
                </NativeAsset>
              </View>
            ) : null}
            {ad.callToAction ? (
              <View collapsable={false} style={styles.asset}>
                <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                  <Text accessibilityRole="button" style={styles.cta}>{ad.callToAction}</Text>
                </NativeAsset>
              </View>
            ) : null}
          </View>
        </View>
      </NativeAdView>
    </View>
  );
}

const styles = StyleSheet.create({
  listing: {
    marginBottom: spacing.xl,
    gap: 10,
  },
  listingInset: {
    marginHorizontal: spacing.lg,
  },
  ad: {
    width: '100%',
    alignSelf: 'stretch',
  },
  adContent: {
    width: '100%',
    gap: 10,
  },
  media: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.brand.surfaceMuted,
  },
  mediaContent: {
    width: '100%',
    aspectRatio: 1.4,
    minHeight: 120,
  },
  badge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    maxWidth: '70%',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.brand.page,
  },
  badgeText: {
    ...typography.caption,
    color: colors.brand.text,
    fontWeight: '700',
  },
  copy: {
    width: '100%',
    gap: 2,
  },
  kickerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  asset: {
    alignSelf: 'stretch',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  kickerAsset: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  kicker: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  title: {
    ...typography.h5,
    color: colors.brand.text,
    fontWeight: '700',
  },
  detail: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  cta: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
    textDecorationLine: 'underline',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
});
