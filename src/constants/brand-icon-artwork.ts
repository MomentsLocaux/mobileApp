/** Purpose-drawn silhouettes from the UI-RELIEF-001 study (`audits/ui-relief-event/proposal.html`). */

export const brandIconArtwork = {
  home: {
    body: 'M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5Z',
    detail: 'M9 21v-7h6v7',
  },
  map: { body: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z', detail: 'M9 3v16M15 5v16' },
  sparkles: {
    body: 'm11 3 2.4 6.6L20 12l-6.6 2.4L11 21l-2.4-6.6L2 12l6.6-2.4Z',
    detail: 'm19 2 .8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8Z',
  },
  heart: {
    body: 'M12 21C9 18.5 2 13.7 2 8.5 2 3 8.5 1 12 6c3.5-5 10-3 10 2.5 0 5.2-7 10-10 12.5Z',
    detail: '',
  },
  user: {
    body: 'M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4 21v-2a8 6 0 0 1 16 0v2Z',
    detail: 'M7 18c.8-1.8 2.5-2.5 5-2.5',
  },
  users: {
    body: 'M9 3a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7ZM2 20v-2a7 5 0 0 1 14 0v2Z',
    detail: 'M17 4a3 3 0 0 1 0 6M18 13c3 0 4 2 4 5v2h-3',
  },
  bell: { body: 'M5 10a7 7 0 0 1 14 0v4l2 3v1H3v-1l2-3Z', detail: 'M9 21h6M8 10a4 4 0 0 1 4-4M11 2h2' },
  settings: {
    body: 'm9 3 1-1h4l1 3 3 1 3-.5 2 3-2 2v3l2 2-2 3-3-.5-3 1-1 3h-4l-1-3-3-1-3 .5-2-3 2-2v-3l-2-2 2-3 3 .5 3-1Z',
    detail: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  },
  calendar: {
    body: 'M5 4h14a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z',
    detail: 'M2 10h20M7 2v4M17 2v4m-10 9 3 3 6-5',
  },
  pin: { body: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z', detail: 'M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' },
  navigation: { body: 'm3 10 18-7-7 18-3-8Z', detail: 'm11 13 6-6' },
  mail: {
    body: 'M4 5h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
    detail: 'm3 7 9 7 9-7',
  },
  back: { body: '', detail: 'm14 5-7 7 7 7M7 12h14' },
  share: { body: '', detail: 'M12 16V3m-5 5 5-5 5 5M5 12v8h14v-8' },
  bulb: {
    body: 'M8 17c0-3-4-4-4-8a8 7 0 0 1 16 0c0 4-4 5-4 8ZM9 21h6',
    detail: 'M8 9a4 3 0 0 1 4-3M10 13l2 2 2-2M12 15v2',
  },
  plus: { body: 'M11 5v6H5v2h6v6h2v-6h6v-2h-6V5z', detail: '' },
  bug: { body: 'M7 9a5 5 0 0 1 10 0v7a5 5 0 0 1-10 0Z', detail: 'M12 11v9M7 11H3M17 11h4M7 16H3M17 16h4M8 5 6 3M16 5l2-2' },
  logout: { body: 'M11 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6Z', detail: 'M9 12h13m-4-4 4 4-4 4' },
  info: { body: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', detail: 'M12 11v6M12 7v.1' },
} as const;

export type BrandIconName = keyof typeof brandIconArtwork;

/** The twelve specimens shown in the visual study, in board order. */
export const BRAND_ICON_STUDY_NAMES = [
  'home',
  'map',
  'sparkles',
  'heart',
  'user',
  'users',
  'bell',
  'settings',
  'calendar',
  'pin',
  'navigation',
  'mail',
] as const satisfies readonly BrandIconName[];
