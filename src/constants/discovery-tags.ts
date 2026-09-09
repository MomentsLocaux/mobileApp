/** Métier chips for SearchBar — aligned with scraper EventTagNormalizer slugs. */

export const OPERATIONAL_EVENT_TAGS = new Set([
  'needs_category',
  'needs_review',
  'dates_a_verifier',
  'dates_festimap',
  'source_date_or_geo_changed',
  'source_festimap',
]);

export const DISCOVERY_TAG_CHIPS: { slug: string; label: string }[] = [
  { slug: 'vide_grenier', label: 'Vide-grenier' },
  { slug: 'brocante', label: 'Brocante' },
  { slug: 'marche', label: 'Marché' },
  { slug: 'festival', label: 'Festival' },
  { slug: 'exposition', label: 'Exposition' },
  { slug: 'atelier', label: 'Atelier' },
  { slug: 'concert', label: 'Concert' },
  { slug: 'spectacle', label: 'Spectacle' },
  { slug: 'theatre', label: 'Théâtre' },
  { slug: 'musique', label: 'Musique' },
  { slug: 'jazz', label: 'Jazz' },
  { slug: 'patrimoine', label: 'Patrimoine' },
  { slug: 'enfants', label: 'Enfants' },
  { slug: 'famille', label: 'Famille' },
  { slug: 'sport', label: 'Sport' },
  { slug: 'gratuit', label: 'Gratuit' },
];

export function formatEventTagLabel(slug: string, labels?: Record<string, string>): string {
  const mapped = labels?.[slug]?.trim();
  if (mapped) return mapped;
  const cleaned = slug.replace(/^#+/, '').replace(/_/g, ' ').trim();
  if (!cleaned) return slug;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function isOperationalEventTag(tag: string): boolean {
  return OPERATIONAL_EVENT_TAGS.has(tag.trim());
}

export function resolveDiscoveryTagChips(
  taxonomy: Array<{ slug?: string | null; label?: string | null }>,
  isHidden: (slug: string) => boolean
): { slug: string; label: string }[] {
  const bySlug = new Map<string, string>();
  for (const chip of DISCOVERY_TAG_CHIPS) {
    bySlug.set(chip.slug, chip.label);
  }
  for (const tag of taxonomy) {
    const slug = (tag.slug || '').trim().toLowerCase();
    if (!slug || isHidden(slug)) continue;
    bySlug.set(slug, (tag.label || '').trim() || formatEventTagLabel(slug));
  }
  return [...bySlug.entries()]
    .map(([slug, label]) => ({ slug, label }))
    .slice(0, 18);
}
