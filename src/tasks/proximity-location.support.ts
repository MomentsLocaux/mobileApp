/** True when the native ExpoTaskManager module is linked (dev/preview builds). */
export function isProximityAlertNativeAvailable(): boolean {
  try {
    const { requireOptionalNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
    return requireOptionalNativeModule('ExpoTaskManager') != null;
  } catch {
    return false;
  }
}
