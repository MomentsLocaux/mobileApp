/**
 * Destinations a future notification may open via `data.route`.
 * Unknown values are ignored. Installed builds only learn these keys
 * after a new TestFlight or Android binary.
 */
export const NOTIFICATION_ROUTE_HREFS = {
  welcome: '/(tabs)/map',
  map: '/(tabs)/map',
  home: '/(tabs)',
  settings: '/settings',
  notification_settings: '/settings/notifications',
  permissions: '/settings/permissions',
  proposals: '/(tabs)/proposals',
  suggestions: '/profile/my-suggestions',
  favorites: '/(tabs)/favorites',
  profile: '/(tabs)/profile',
  community: '/(tabs)/community',
  agenda: '/agenda',
  messages: '/messages',
  inbox: '/notifications',
} as const;

export type NotificationRouteKey = keyof typeof NOTIFICATION_ROUTE_HREFS;
export type NotificationRouteHref = (typeof NOTIFICATION_ROUTE_HREFS)[NotificationRouteKey];

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const pickString = (data: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const hrefForKey = (key: string | undefined): NotificationRouteHref | null => {
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(NOTIFICATION_ROUTE_HREFS, key)) {
    return NOTIFICATION_ROUTE_HREFS[key as NotificationRouteKey];
  }
  return null;
};

/**
 * Explicit tap target. `route` wins. `kind: welcome` is the alias already
 * stored on the prepared welcome campaign.
 */
export function hrefForNotificationDestination(data: unknown): NotificationRouteHref | null {
  const record = asRecord(data);
  const explicit = hrefForKey(pickString(record, 'route', 'screen'));
  if (explicit) return explicit;
  const kind = pickString(record, 'kind');
  if (kind === 'welcome' || kind === 'welcome_explore') {
    return NOTIFICATION_ROUTE_HREFS.welcome;
  }
  return null;
}
