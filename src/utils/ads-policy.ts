export const AD_SESSION_CAP = 3;
export const LIST_MIN_EVENTS = 8;
export const LIST_INTERVAL = 8;
export const LIST_MAX_ADS = 2;

const shownSlots = new Set<string>();
const pendingSlots = new Set<string>();

/** Indexes of events that are followed by a list ad. Never the first row. */
export function listAdIndexes(eventCount: number): number[] {
  if (eventCount < LIST_MIN_EVENTS) return [];
  const indexes: number[] = [];
  for (
    let after = LIST_MIN_EVENTS;
    after <= eventCount && indexes.length < LIST_MAX_ADS;
    after += LIST_INTERVAL
  ) {
    indexes.push(after - 1);
  }
  return indexes;
}

export type AdConsentSnapshot = {
  canRequestAds: boolean;
  consentNotRequired: boolean;
  selectPersonalisedAds: boolean;
  usePreciseGeolocationData: boolean;
};

export type AdPlatform = 'ios' | 'android' | 'other';

export type AdRequestPlan = {
  canRequest: boolean;
  personalized: boolean;
  allowPreciseLocation: boolean;
  requestTrackingPermission: boolean;
};

export function planAdRequest(consent: AdConsentSnapshot, platform: AdPlatform): AdRequestPlan {
  if (!consent.canRequestAds) {
    return {
      canRequest: false,
      personalized: false,
      allowPreciseLocation: false,
      requestTrackingPermission: false,
    };
  }

  const personalized = consent.consentNotRequired || consent.selectPersonalisedAds;
  const allowPreciseLocation = consent.usePreciseGeolocationData === true;
  return {
    canRequest: true,
    personalized,
    allowPreciseLocation,
    requestTrackingPermission: platform === 'ios' && personalized,
  };
}

export function canServeUnit(unitId: string, productionBuild: boolean, testPublisher: string): boolean {
  if (!unitId.trim()) return false;
  if (productionBuild && unitId.includes(testPublisher)) return false;
  return true;
}

export function reserveAdSlot(slotId: string, cap = AD_SESSION_CAP): boolean {
  if (shownSlots.has(slotId) || pendingSlots.has(slotId)) return true;
  if (shownSlots.size + pendingSlots.size >= cap) return false;
  pendingSlots.add(slotId);
  return true;
}

export function commitAdImpression(slotId: string): void {
  pendingSlots.delete(slotId);
  shownSlots.add(slotId);
}

export function releaseAdSlot(slotId: string): void {
  pendingSlots.delete(slotId);
}

export function resetAdSession(): void {
  shownSlots.clear();
  pendingSlots.clear();
}

export function adSessionSize(): number {
  return shownSlots.size + pendingSlots.size;
}
