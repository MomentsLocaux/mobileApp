/**
 * Allowed taxonomy slugs for poster extraction (synced from event_category / event_subcategory / event_tag).
 * The model must pick only from these lists — never invent values.
 */

export const CATEGORY_SLUGS = [
  'arts-culture',
  'marches-artisanat',
  'fetes-animations',
  'famille-enfants',
  'gastronomie-saveurs',
  'nature-bienetre',
  'ateliers-apprentissage',
  'sport-loisirs',
  'vie-locale',
  'insolite-ephemere',
] as const;

export const SUBCATEGORIES_BY_CATEGORY: Record<string, string[]> = {
  'arts-culture': [
    'exposition',
    'lecture-poesie',
    'musique-live',
    'performance-rue',
    'projection',
    'spectacle-vivant',
  ],
  'ateliers-apprentissage': [
    'atelier-artisanal',
    'atelier-creatif',
    'conference-locale',
    'initiation',
    'repair-cafe',
  ],
  'famille-enfants': [
    'activite-enfants',
    'atelier-enfants',
    'sortie-famille',
    'spectacle-jeune-public',
  ],
  'fetes-animations': [
    'animation-saisonniere',
    'carnaval',
    'fete-quartier',
    'feu-artifice',
    'soiree-theme',
  ],
  'gastronomie-saveurs': [
    'cuisine-monde',
    'degustation',
    'food-truck',
    'marche-gourmand',
    'repas-partage',
  ],
  'insolite-ephemere': [
    'action-surprise',
    'decoration-exceptionnelle',
    'installation-temporaire',
    'lieu-ephemere',
    'micro-evenement',
  ],
  'marches-artisanat': [
    'createurs-locaux',
    'marche-artisanal',
    'pop-up-local',
    'produits-fermiers',
    'vide-grenier',
  ],
  'nature-bienetre': [
    'atelier-ecolo',
    'balade',
    'jardin-partage',
    'nettoyage-citoyen',
    'yoga',
  ],
  'sport-loisirs': [
    'jeu-collectif',
    'loisir-plein-air',
    'sport-amateur',
    'tournoi-local',
  ],
  'vie-locale': [
    'action-solidaire',
    'evenement-associatif',
    'initiative-citoyenne',
    'patrimoine-local',
    'reunion-publique',
  ],
};

export const TAG_SLUGS = [
  'accessible-pmr',
  'animaux-acceptes',
  'aujourd-hui',
  'ce-weekend',
  'enfants-bienvenus',
  'ephemere',
  'exterieur',
  'gratuit',
  'interieur',
  'participation-libre',
  'payant',
] as const;

export function formatTaxonomyForPrompt(): string {
  const lines = CATEGORY_SLUGS.map((cat) => {
    const subs = SUBCATEGORIES_BY_CATEGORY[cat] ?? [];
    return `- ${cat}: [${subs.join(', ')}]`;
  });
  return [
    'Catégories (category_slug) et sous-catégories (subcategory_slug) autorisées :',
    ...lines,
    '',
    `Tags autorisés (tag_slugs, 0 à 3 max) : ${TAG_SLUGS.join(', ')}`,
  ].join('\n');
}

export function isAllowedCategory(slug: string | null | undefined): slug is string {
  return typeof slug === 'string' && (CATEGORY_SLUGS as readonly string[]).includes(slug);
}

export function isAllowedSubcategory(categorySlug: string, subSlug: string | null | undefined): boolean {
  if (!subSlug) return false;
  const allowed = SUBCATEGORIES_BY_CATEGORY[categorySlug];
  return Array.isArray(allowed) && allowed.includes(subSlug);
}

export function filterTagSlugs(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const allowed = new Set<string>(TAG_SLUGS);
  return tags
    .filter((t): t is string => typeof t === 'string' && allowed.has(t))
    .slice(0, 3);
}
