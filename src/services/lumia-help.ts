import knowledgePack from '@/content/lumia/knowledge.json';
import { features } from '@/config/features';

export type LumiaHelpHit = {
  id: string;
  score: number;
  answer: string;
  preferHelp: boolean;
};

type KnowledgeArticle = {
  id: string;
  category: string;
  title: string;
  keywords: string[];
  body: string;
  feature_flag?: string;
  feature_flag_value?: boolean;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

const HOW_TO_CUES =
  /\b(comment|comment faire|ou (est|sont|trouver)|cest quoi|ca sert|aide-moi|explique|utiliser|fonctionn|parametr|reglage|autorisation|signaler|rgpd|cgu|prix|tarif|offre)\b/;

const FLAG_MAP: Record<string, () => boolean> = {
  socialPeers: () => features.socialPeers,
  eventCreate: () => features.eventCreate,
  checkin: () => features.checkin,
  offers: () => features.offers,
};

function articleAllowed(article: KnowledgeArticle): boolean {
  if (!article.feature_flag) return true;
  const getter = FLAG_MAP[article.feature_flag];
  const flagOn = getter ? getter() : false;
  if (typeof article.feature_flag_value === 'boolean') {
    return flagOn === article.feature_flag_value;
  }
  return flagOn;
}

const ARTICLES = (knowledgePack.articles as KnowledgeArticle[]).filter(articleAllowed);

export function matchAppHelp(query: string): LumiaHelpHit | null {
  const hay = normalize(query);
  if (!hay) return null;

  let best: { article: KnowledgeArticle; score: number } | null = null;
  for (const article of ARTICLES) {
    const score = article.keywords.reduce(
      (sum, keyword) => (hay.includes(normalize(keyword)) ? sum + 1 : sum),
      0,
    );
    if (score > 0 && (!best || score > best.score)) {
      best = { article, score };
    }
  }

  if (!best) return null;

  const howTo = HOW_TO_CUES.test(hay);
  const legalOrOffers = best.article.category === 'legal' || best.article.category === 'offers';

  return {
    id: best.article.id,
    score: best.score,
    answer: best.article.body,
    preferHelp: howTo || legalOrOffers || best.score >= 2,
  };
}

/** Feature flags snapshot for Edge Function grounding (same keys as knowledge.feature_flag). */
export function lumiaFeatureFlagsForApi(): Record<string, boolean> {
  return {
    socialPeers: features.socialPeers,
    eventCreate: features.eventCreate,
    checkin: features.checkin,
    offers: features.offers,
  };
}
