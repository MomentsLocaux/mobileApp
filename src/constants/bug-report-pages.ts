export const BUG_REPORT_ATTACHMENT_BUCKET = 'bug-report-attachments';

export const BUG_REPORT_PAGE_IDS = [
  'home',
  'map',
  'event_detail',
  'event_create',
  'event_suggest',
  'proposals',
  'favorites',
  'community',
  'shop',
  'missions',
  'profile',
  'settings',
  'notifications',
  'lumia',
  'contests',
  'onboarding',
  'auth',
  'creator',
  'roadtrip',
  'moderation',
  'admin_console',
  'website',
  'scraper',
  'emails',
  'qa',
  'other',
] as const;

export type BugReportPageId = (typeof BUG_REPORT_PAGE_IDS)[number];

export type BugReportPageAudience = 'app' | 'ops' | 'all';

export type BugReportPageOption = {
  id: BugReportPageId;
  label: string;
  audience: BugReportPageAudience;
};

export const BUG_REPORT_PAGES: BugReportPageOption[] = [
  { id: 'home', label: 'Accueil', audience: 'app' },
  { id: 'map', label: 'Carte', audience: 'app' },
  { id: 'event_detail', label: "Détail d'un moment", audience: 'app' },
  { id: 'event_create', label: 'Création / publication', audience: 'app' },
  { id: 'event_suggest', label: 'Suggestion depuis une affiche', audience: 'app' },
  { id: 'proposals', label: 'Propositions', audience: 'app' },
  { id: 'favorites', label: 'Favoris', audience: 'app' },
  { id: 'community', label: 'Communauté', audience: 'app' },
  { id: 'shop', label: 'Boutique', audience: 'app' },
  { id: 'missions', label: 'Missions', audience: 'app' },
  { id: 'profile', label: 'Profil', audience: 'app' },
  { id: 'settings', label: 'Paramètres', audience: 'app' },
  { id: 'notifications', label: 'Notifications', audience: 'app' },
  { id: 'lumia', label: 'Lumia', audience: 'app' },
  { id: 'contests', label: 'Concours', audience: 'app' },
  { id: 'onboarding', label: 'Onboarding', audience: 'app' },
  { id: 'auth', label: 'Connexion / compte', audience: 'app' },
  { id: 'creator', label: 'Espace diffuseur / créateur', audience: 'app' },
  { id: 'roadtrip', label: 'Roadtrip', audience: 'app' },
  { id: 'moderation', label: 'Modération (app)', audience: 'app' },
  { id: 'admin_console', label: "Console d'administration", audience: 'ops' },
  { id: 'website', label: 'Site web', audience: 'ops' },
  { id: 'scraper', label: 'Collecte / scrapper', audience: 'ops' },
  { id: 'emails', label: 'Emails', audience: 'ops' },
  { id: 'qa', label: 'QA / tests', audience: 'ops' },
  { id: 'other', label: 'Autre / non précisé', audience: 'all' },
];

const PAGE_SET = new Set<string>(BUG_REPORT_PAGE_IDS);

export const isBugReportPageId = (value: string | null | undefined): value is BugReportPageId =>
  Boolean(value && PAGE_SET.has(value));

export const bugReportPageLabel = (page: string | null | undefined) =>
  BUG_REPORT_PAGES.find((option) => option.id === page)?.label || page || 'Autre / non précisé';

export const mobileBugReportPages = BUG_REPORT_PAGES.filter(
  (option) => option.audience === 'app' || option.audience === 'all',
);

export function foldBugReportPageValue(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/\s+/g, ' ');
}

/**
 * Maps a free-text / legacy `bug_reports.page` value to the catalog.
 * Keep in sync with `public.normalize_bug_report_page` in supabase migrations.
 */
export function normalizeBugReportPage(raw: string | null | undefined): BugReportPageId {
  if (raw == null) return 'other';
  const trimmed = raw.trim();
  if (!trimmed) return 'other';
  if (isBugReportPageId(trimmed)) return trimmed;

  const v = foldBugReportPageValue(trimmed);
  if (!v) return 'other';
  if (isBugReportPageId(v)) return v;

  if (
    v === '/bug-report' ||
    v === 'bug-report' ||
    v.includes('bug report') ||
    v === '/(tabs)/_layout' ||
    v === '/+not-found' ||
    v === 'tout' ||
    v.includes('spinner')
  ) {
    return 'other';
  }

  if (v === 'qa' || v.startsWith('qa:') || v.startsWith('qa ')) return 'qa';
  if (v.includes('scrapper') || v.includes('scraper') || v.includes('collecte')) return 'scraper';
  if (v.includes('site web') || v.includes('website')) return 'website';
  if (v.includes('email welcome') || v.includes('emails auto') || v === 'emails') return 'emails';
  if (v.includes('roadtrip')) return 'roadtrip';
  if (v.includes('lumia') || v.includes('chatbot') || v.includes('/chatbot')) return 'lumia';
  if (v.includes('onboarding') || v.includes('autorisation ios') || v.includes('guide pas a pas')) return 'onboarding';
  if (v.includes('/auth') || v === '/login' || v.endsWith('/login') || v === 'auth') return 'auth';
  if (v.includes('concours') || v.includes('contest')) return 'contests';
  if (v.includes('boutique') || v.includes('/shop') || v.includes('premium') || v.includes('payante')) return 'shop';
  if (v.includes('notification') || v.includes('preferences email')) return 'notifications';
  if (v.includes('/settings') || v === 'settings') return 'settings';
  if (v.includes('favorit')) return 'favorites';
  if (
    v.includes('communaute') ||
    v.includes('community') ||
    v.includes('membres') ||
    v.includes('/profile/invite') ||
    v.includes('detail membre')
  ) {
    return 'community';
  }
  if (v.includes('proposal') || v.includes('proposition')) return 'proposals';
  if (v.includes('suggest') || v.includes('suggestion')) return 'event_suggest';
  if (
    v.includes('creer-evenement') ||
    v.includes('/events/create') ||
    v.includes('publication') ||
    v.includes('modifier-evenement') ||
    v.includes('preview')
  ) {
    return 'event_create';
  }
  if (
    v.includes('bottom sheet map') ||
    v.includes('marker') ||
    v.includes('drom-com') ||
    v.includes('sortby') ||
    v.includes('modale navigation') ||
    v === 'recherche' ||
    v === '/map' ||
    v.includes('/(tabs)/map') ||
    v.includes(' map') ||
    /(^|[\s/])map([\s/]|$)/.test(v) ||
    (v.includes('carte') && !v.includes('page'))
  ) {
    return 'map';
  }
  if (
    v.includes('/events') ||
    v.includes('page evenement') ||
    v.includes('detail evenement') ||
    v.includes('event card') ||
    v.includes('eventcard') ||
    v.includes('eventdetail') ||
    v.includes('evenement')
  ) {
    return 'event_detail';
  }
  if (
    v === '/home' ||
    v === '/' ||
    v === 'home' ||
    v.includes('homescreen') ||
    v.includes('greeting') ||
    v.includes('modale de triage')
  ) {
    return 'home';
  }
  if (v.includes('profil') || v.includes('gamification')) return 'profile';
  if (v.includes('diffuseur') || v.includes('partenaire') || v.includes('creator') || v.includes('claim ownership')) {
    return 'creator';
  }
  if (v.includes('moderation')) return 'moderation';
  if (v.includes('mission')) return 'missions';
  if (v.includes('admin') || v.includes('console')) return 'admin_console';

  return 'other';
}
