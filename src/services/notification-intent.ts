/**
 * Notification taps can arrive before auth restore finishes.
 * The href waits here until the signed-in app is on screen, then one consumer takes it.
 */
let pendingHref: string | null = null;
let routingReady = false;

export function stageNotificationHref(href: string) {
  pendingHref = href;
}

export function peekNotificationHref(): string | null {
  return pendingHref;
}

export function consumeNotificationHref(): string | null {
  const href = pendingHref;
  pendingHref = null;
  return href;
}

/** Screen to open once the user is authenticated. Falls back to the main tabs. */
export function hrefAfterAuthentication(fallback = '/(tabs)'): string {
  return consumeNotificationHref() ?? fallback;
}

/** True only after the signed-in shell has painted, so a route is not replaced by the boot redirect. */
export function isNotificationRoutingReady(): boolean {
  return routingReady;
}

export function markNotificationRoutingReady() {
  routingReady = true;
}

/** Sign-out: the next tap waits until the user is back inside the app. */
export function suspendNotificationRouting() {
  routingReady = false;
}

/** Test helper. */
export function resetNotificationIntent() {
  pendingHref = null;
  routingReady = false;
}
