import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { features } from '@/config/features';
import { GOOGLE_TEST_AD_PUBLISHER, nativeAdUnitId } from '@/constants/ads';
import { canServeUnit, planAdRequest, type AdRequestPlan } from '@/utils/ads-policy';

export type PreparedAdRequest = Pick<AdRequestPlan, 'canRequest' | 'personalized' | 'allowPreciseLocation'>;

const EMPTY_REQUEST: PreparedAdRequest = {
  canRequest: false,
  personalized: false,
  allowPreciseLocation: false,
};

let prepared: Promise<PreparedAdRequest> | null = null;
let mobileAdsStarted = false;
const consentListeners = new Set<() => void>();

export function subscribeAdsConsent(listener: () => void): () => void {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
}

function isProductionBuild(): boolean {
  const extra = Constants.expoConfig?.extra as { adsProductionBuild?: boolean } | undefined;
  return extra?.adsProductionBuild === true;
}

export function resetAdsConsentCache(): void {
  prepared = null;
}

function publishAdsConsentChange(): void {
  prepared = null;
  consentListeners.forEach((listener) => listener());
}

export async function prepareAdRequest(): Promise<PreparedAdRequest> {
  if (!features.ads) return EMPTY_REQUEST;
  if (!prepared) {
    prepared = runPrepare().catch((error: unknown) => {
      prepared = null;
      throw error;
    });
  }
  return prepared;
}

async function runPrepare(): Promise<PreparedAdRequest> {
  const unitId = nativeAdUnitId();
  const productionBuild = isProductionBuild();
  if (!canServeUnit(unitId, productionBuild, GOOGLE_TEST_AD_PUBLISHER)) {
    if (__DEV__) console.warn('[ads] bloc refusé', { productionBuild });
    return EMPTY_REQUEST;
  }

  const ads = await import('react-native-google-mobile-ads');
  let info;
  try {
    info = await ads.AdsConsent.gatherConsent();
  } catch (error) {
    if (__DEV__) console.warn('[ads] consentement échec', error);
    throw error;
  }
  if (__DEV__) console.warn('[ads] consentement', { status: info.status, canRequestAds: info.canRequestAds });
  if (!info.canRequestAds) return EMPTY_REQUEST;

  const choices = await ads.AdsConsent.getUserChoices();
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';
  const plan = planAdRequest(
    {
      canRequestAds: true,
      consentNotRequired: info.status === ads.AdsConsentStatus.NOT_REQUIRED,
      selectPersonalisedAds: choices.selectPersonalisedAds,
      usePreciseGeolocationData: choices.usePreciseGeolocationData,
    },
    platform,
  );

  if (plan.requestTrackingPermission) {
    try {
      const tracking = await import('expo-tracking-transparency');
      const current = await tracking.getTrackingPermissionsAsync();
      if (current.status === 'undetermined') {
        await tracking.requestTrackingPermissionsAsync();
      }
    } catch {
      // The system prompt needs a native rebuild with the ads flag on.
    }
  }

  if (!mobileAdsStarted) {
    const mobileAds = ads.default();
    await mobileAds.setRequestConfiguration({
      maxAdContentRating: ads.MaxAdContentRating.T,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds.initialize();
    mobileAdsStarted = true;
  }

  return {
    canRequest: plan.canRequest,
    personalized: plan.personalized,
    allowPreciseLocation: plan.allowPreciseLocation,
  };
}

export async function loadNativeAd(request: PreparedAdRequest) {
  const ads = await import('react-native-google-mobile-ads');
  // Precise coordinates are not attached by the app. `allowPreciseLocation` is
  // already stored in the consent string: Google may use the phone location
  // only when that purpose was accepted and the system permission is granted.
  void request.allowPreciseLocation;
  return ads.NativeAd.createForAdRequest(nativeAdUnitId(), {
    requestNonPersonalizedAdsOnly: !request.personalized,
  });
}

export async function reopenAdsPrivacyOptions(): Promise<void> {
  if (!features.ads) return;
  const ads = await import('react-native-google-mobile-ads');
  await ads.AdsConsent.requestInfoUpdate();
  await ads.AdsConsent.showPrivacyOptionsForm();
  publishAdsConsentChange();
}
