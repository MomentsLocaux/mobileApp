/**
 * Allowlisted in-app destinations (keep in sync with src/constants/lumia-deeplinks.ts).
 */
export type LumiaDeeplink = {
  href: string;
  label: string;
  hint: string;
};

export const LUMIA_DEEPLINKS: LumiaDeeplink[] = [
  { href: '/(tabs)', label: 'Accueil', hint: 'fil / liste des moments' },
  { href: '/(tabs)/map', label: 'Carte', hint: 'ouvrir la carte Mapbox' },
  { href: '/(tabs)/favorites', label: 'Favoris', hint: 'moments sauvegardés' },
  { href: '/(tabs)/proposals', label: 'Propositions', hint: 'swipe idées (si flag)' },
  { href: '/(tabs)/profile', label: 'Profil', hint: 'menu profil' },
  { href: '/settings', label: 'Paramètres', hint: 'écran paramètres' },
  { href: '/settings/legal/cgu', label: 'CGU', hint: 'conditions générales' },
  { href: '/settings/legal/mentions', label: 'Mentions légales', hint: 'mentions légales' },
  { href: '/settings/legal/cookies', label: 'Cookies', hint: 'politique cookies' },
  { href: '/settings/privacy/policy', label: 'Confidentialité', hint: 'politique de confidentialité' },
  { href: '/settings/privacy/delete', label: 'Supprimer mon compte', hint: 'suppression de compte' },
  { href: '/settings/notifications', label: 'Notifications', hint: 'préférences notifs' },
  { href: '/settings/permissions', label: 'Autorisations', hint: 'localisation, etc.' },
  { href: '/notifications', label: 'Boîte notifications', hint: 'inbox notifications' },
  { href: '/bug-report', label: 'Signaler un bug', hint: 'support / bug' },
  { href: '/profile/edit', label: 'Modifier le profil', hint: 'édition profil' },
  { href: '/profile/invite', label: 'Inviter des amis', hint: 'partage invitation' },
  { href: '/(tabs)/community', label: 'Membres', hint: 'communauté pairs (si flag)' },
];

const ALLOWED = new Set(LUMIA_DEEPLINKS.map((d) => d.href));

export function isAllowedLumiaHref(href: string): boolean {
  const path = normalizeLumiaHref(href);
  if (!path) return false;
  if (ALLOWED.has(path)) return true;
  return /^\/events\/[0-9a-f-]{36}$/i.test(path);
}

export function normalizeLumiaHref(href: string): string | null {
  const raw = href.trim();
  if (!raw) return null;
  const stripped = raw
    .replace(/^moments-locaux:\/\//i, '/')
    .replace(/^app:\/\//i, '/')
    .replace(/^https?:\/\/moments-locaux\.app/i, '');
  if (!stripped.startsWith('/')) return null;
  return stripped.split('?')[0];
}

export function formatDeeplinkCatalogForPrompt(): string {
  return LUMIA_DEEPLINKS.map((d) => `- [${d.label}](${d.href}) — ${d.hint}`).join('\n');
}

export type LumiaAction = { href: string; label: string };

/** Keep only allowlisted actions (max 3). */
export function filterLumiaActions(raw: unknown): LumiaAction[] {
  if (!Array.isArray(raw)) return [];
  const out: LumiaAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const href = typeof (item as { href?: string }).href === 'string'
      ? normalizeLumiaHref((item as { href: string }).href)
      : null;
    const label = typeof (item as { label?: string }).label === 'string'
      ? (item as { label: string }).label.trim()
      : '';
    if (!href || !label || !isAllowedLumiaHref(href)) continue;
    if (out.some((a) => a.href === href)) continue;
    out.push({ href, label: label.slice(0, 48) });
    if (out.length >= 3) break;
  }
  return out;
}
