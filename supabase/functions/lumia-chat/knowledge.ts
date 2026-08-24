/**
 * Lumia product knowledge — retrieval for Edge Function (prod grounding).
 * SSOT: content/lumia/knowledge.json (sync via scripts/sync-lumia-knowledge.sh).
 */

export type KnowledgeArticle = {
  id: string;
  category: string;
  title: string;
  keywords: string[];
  body: string;
  feature_flag?: string;
  feature_flag_value?: boolean;
};

export type KnowledgePack = {
  version: number;
  updated_at: string;
  product: string;
  assistant: string;
  articles: KnowledgeArticle[];
};

export type FeatureFlags = Record<string, boolean | undefined>;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function articleAllowed(article: KnowledgeArticle, flags: FeatureFlags): boolean {
  if (!article.feature_flag) return true;
  const flagOn = Boolean(flags[article.feature_flag]);
  if (typeof article.feature_flag_value === 'boolean') {
    return flagOn === article.feature_flag_value;
  }
  // Default: article only when flag is on
  return flagOn;
}

export function retrieveKnowledge(
  pack: KnowledgePack,
  query: string,
  flags: FeatureFlags,
  limit = 5,
): KnowledgeArticle[] {
  const hay = normalize(query);
  if (!hay) return [];

  const scored = pack.articles
    .filter((article) => articleAllowed(article, flags))
    .map((article) => {
      const keywordHits = article.keywords.reduce(
        (sum, keyword) => (hay.includes(normalize(keyword)) ? sum + 2 : sum),
        0,
      );
      const titleHit = normalize(article.title)
        .split(/\s+/)
        .some((token) => token.length > 2 && hay.includes(token))
        ? 1
        : 0;
      const bodyHit = normalize(article.body)
        .split(/\s+/)
        .filter((token) => token.length > 4 && hay.includes(token)).length;
      const score = keywordHits + titleHit + Math.min(bodyHit, 3);
      return { article, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, limit).map((row) => row.article);

  // Always include policy anchors for pricing / legal cues even if weak match
  const forceIds: string[] = [];
  if (/\b(prix|tarif|cout|euro|abonnement|payant|premium|offre)\b/.test(hay)) {
    forceIds.push('offers-mvp', 'no-ticketing');
  }
  if (/\b(rgpd|cgu|legal|confidential|donnee|supprim|cnil)\b/.test(hay)) {
    forceIds.push('rgpd-where', 'cgu', 'privacy-policy');
  }

  const byId = new Map(pack.articles.map((a) => [a.id, a]));
  for (const id of forceIds) {
    const article = byId.get(id);
    if (!article || !articleAllowed(article, flags)) continue;
    if (!top.some((a) => a.id === id)) top.push(article);
  }

  return top.slice(0, Math.max(limit, 6));
}

export function formatKnowledgeForPrompt(articles: KnowledgeArticle[]): string {
  if (!articles.length) {
    return 'Aucun extrait knowledge pertinent. Si la question porte sur l’app, dis que tu n’as pas la fiche et oriente vers Paramètres / support. Ne rien inventer.';
  }
  return articles
    .map(
      (a) =>
        `### ${a.id} [${a.category}] ${a.title}\n${a.body}`,
    )
    .join('\n\n');
}
