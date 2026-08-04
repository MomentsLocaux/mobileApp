const CATEGORY_HINTS: Record<string, string> = {
  'arts-culture': 'Expositions, théâtre, patrimoine, cinéma et rencontres culturelles.',
  'marches-artisanat': 'Marchés locaux, brocantes, créateurs, savoir-faire et produits artisanaux.',
  'fetes-animations': 'Concerts, festivals, bals, spectacles et animations de quartier.',
  'famille-enfants': 'Jeux, contes, ateliers et sorties adaptées aux enfants et aux familles.',
  'gastronomie-saveurs': 'Dégustations, fêtes gourmandes, producteurs et découvertes culinaires.',
  'nature-bienetre': 'Balades, jardinage, bien-être, écologie et activités en plein air.',
  'ateliers-apprentissage': 'Cours, initiations, démonstrations et ateliers pratiques ou créatifs.',
  'sport-loisirs': 'Rencontres sportives, randonnées, jeux et activités de loisirs.',
  'vie-locale': 'Rencontres associatives, solidarité, débats et initiatives de quartier.',
  'insolite-ephemere': 'Pop-up, expériences originales, lieux temporaires et rendez-vous inattendus.',
};

export function getProposalCategoryHint(slug: string): string {
  return CATEGORY_HINTS[slug] || 'Découvre les événements locaux proposés dans cette catégorie.';
}

