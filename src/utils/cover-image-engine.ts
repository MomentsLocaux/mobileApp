export type CoverImageEngine = 'expo-image' | 'react-native';

type ExpoImageModule = { Image?: unknown };

/**
 * Prefer requiring the JS module: Expo Image registers via JSI and may be
 * absent from NativeModules even when the native binary is linked.
 */
export function detectCoverImageEngine(
  loadModule: () => ExpoImageModule | null,
): CoverImageEngine {
  try {
    if (loadModule()?.Image) return 'expo-image';
  } catch {
    // require('expo-image') throws when the native module is not in the binary.
  }
  return 'react-native';
}
