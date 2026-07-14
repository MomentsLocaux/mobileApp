import { DISCOVERY_CAPTURE_ENABLED } from '@/config/discovery.flags';

/** True when capture flag is on and the native ExpoTaskManager module is linked. */
export function isDiscoveryCaptureNativeAvailable(): boolean {
  if (!DISCOVERY_CAPTURE_ENABLED) return false;

  try {
    const { requireOptionalNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
    return requireOptionalNativeModule('ExpoTaskManager') != null;
  } catch {
    return false;
  }
}
