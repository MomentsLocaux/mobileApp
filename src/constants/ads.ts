import { Platform } from 'react-native';

/** Google's public sample publisher. Safe to ship in source. Real units come from EAS. */
export const GOOGLE_TEST_AD_PUBLISHER = 'ca-app-pub-3940256099942544';

const TEST_NATIVE_UNIT = {
  ios: `${GOOGLE_TEST_AD_PUBLISHER}/3986624511`,
  android: `${GOOGLE_TEST_AD_PUBLISHER}/2247696110`,
} as const;

export function nativeAdUnitId(): string {
  const fromEnv =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_UNIT_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_UNIT_ID;
  const trimmed = fromEnv?.trim();
  if (trimmed) return trimmed;
  return Platform.OS === 'ios' ? TEST_NATIVE_UNIT.ios : TEST_NATIVE_UNIT.android;
}

export function isGoogleTestAdUnit(unitId: string): boolean {
  return unitId.includes(GOOGLE_TEST_AD_PUBLISHER);
}
