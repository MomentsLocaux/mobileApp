export const CONTACT_INTENTS = ['question', 'diffuseur', 'partenaire', 'autre'] as const;

export type ContactIntent = (typeof CONTACT_INTENTS)[number];

export const CONTACT_INTENT_LABELS: Record<ContactIntent, string> = {
  question: 'Une question sur l’app',
  diffuseur: 'Je publie des événements',
  partenaire: 'J’accueille les gens qui sortent',
  autre: 'Autre',
};
