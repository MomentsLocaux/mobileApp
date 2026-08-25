/**
 * Lightweight intent router (ADR 008).
 * Not the "brain" — just decides which tools to call before the LLM.
 */

const GREETING_RE =
  /^(hello|hi|hey|yo|hola|bonjour|bonsoir|salut|coucou|hey\s+lumia|salut\s+lumia|bonjour\s+lumia)([\s!.?…]*)?$/i;

const USAGE_HINT_RE =
  /\b(comment|ou\s+(est|trouver|ouvrir)|parametr|compte|cgu|rgpd|confidentialit|supprim(er)?(\s+mon)?\s+compte|signaler|favori|notification|abonnement|tarif|prix|offre|habitue|eclaireur|partenaire|diffuseur|c.?est\s+quoi)\b/i;

const EVENT_HINT_RE =
  /\b(concert|spectacle|expo|exposition|festival|marche|brocante|vide[\s-]?grenier|atelier|sortie|soiree|cinema|theatre|sport|match|rando|concerts?|evenement|moment|pres\s+de|aupr[eè]s|demain|aujourd.?hui|ce\s+week|weekend|cette\s+semaine|ce\s+soir|ce\s+week-end)\b/i;

const PLACE_HINT_RE = /\b(a|à|pres\s+de|près\s+de|sur|dans)\s+[a-zàâäéèêëïîôùûüç-]{3,}/i;

export type LumiaRoute = {
  isGreeting: boolean;
  /** Call documentary RAG (app_help). */
  useAppHelp: boolean;
  /** Call search_events tool. */
  useSearchEvents: boolean;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

export function isGreeting(message: string): boolean {
  return GREETING_RE.test(message.trim());
}

/**
 * Route tools for a non-greeting message.
 * - Strong usage question → RAG only
 * - Event-ish → search_events (+ RAG if also usage-ish or weak signal)
 * - Ambiguous → both (LLM will ignore empty sides)
 */
export function routeLumiaMessage(message: string): LumiaRoute {
  if (isGreeting(message)) {
    return { isGreeting: true, useAppHelp: false, useSearchEvents: false };
  }

  const n = normalize(message);
  const usage = USAGE_HINT_RE.test(n);
  const eventish = EVENT_HINT_RE.test(n) || PLACE_HINT_RE.test(n);

  if (usage && !eventish) {
    return { isGreeting: false, useAppHelp: true, useSearchEvents: false };
  }
  if (eventish && !usage) {
    return { isGreeting: false, useAppHelp: false, useSearchEvents: true };
  }
  if (eventish && usage) {
    return { isGreeting: false, useAppHelp: true, useSearchEvents: true };
  }

  // Ambiguous short query ("jazz Metz") → prefer events; still allow weak RAG later if needed
  const words = n.split(/\s+/).filter((w) => w.length > 1);
  if (words.length <= 4) {
    return { isGreeting: false, useAppHelp: true, useSearchEvents: true };
  }

  return { isGreeting: false, useAppHelp: true, useSearchEvents: false };
}
