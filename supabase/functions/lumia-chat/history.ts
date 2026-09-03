/**
 * Follow-up + history helpers for Lumia (SCRUM-155).
 * Keep in sync with src/utils/lumia-conversation.ts
 */

export type HistoryTurn = {
  role: 'user' | 'assistant' | 'lumia';
  text?: string;
  content?: string;
};

const FOLLOW_UP_RE =
  /\b(et|aussi|pareil|pareille|idem|ceux|celles|meme|memes|autre|ailleurs|plutot|toujours|encore|plus\s+pres|demain|ce\s+soir|aujourd|week|semaine|la\s+bas)\b/i;

const LOCATIVE_START_RE = /^(a|sur|dans|pres|proche|autour|demain|aujourd|soir|weekend|week)/i;

const EVENT_TYPE_RE =
  /\b(concerts?|festivals?|brocante|vide[\s-]?grenier|expos?(ition)?|ateliers?|theatres?|cinemas?|sports?|randos?|marches?|spectacles?|evenements?|moments?)\b/;

const NEAR_ME_RE = /\b(pres de moi|autour de moi|chez moi|dans les parages|a cote|proche de moi)\b/i;

const TURN_LIMIT = 6;
const TEXT_MAX = 400;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function turnText(turn: HistoryTurn): string {
  const raw = typeof turn.text === 'string' ? turn.text : typeof turn.content === 'string' ? turn.content : '';
  return raw.trim();
}

export function isNearMeQuery(message: string): boolean {
  return NEAR_ME_RE.test(normalize(message));
}

export function isFollowUp(message: string): boolean {
  const n = normalize(message);
  if (!n) return false;
  const words = n.split(' ').filter(Boolean);
  if (EVENT_TYPE_RE.test(n) && words.length >= 3) return false;
  if (/^(et|aussi)\b/.test(n)) return true;
  if (words.length <= 4 && (FOLLOW_UP_RE.test(n) || LOCATIVE_START_RE.test(n))) return true;
  return false;
}

export function sanitizeHistory(raw: unknown): { role: 'user' | 'assistant'; text: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { role: 'user' | 'assistant'; text: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const turn = item as HistoryTurn;
    const text = turnText(turn).slice(0, TEXT_MAX);
    if (!text) continue;
    const role = turn.role === 'user' ? 'user' : 'assistant';
    out.push({ role, text });
    if (out.length >= TURN_LIMIT) break;
  }
  return out;
}

export function composeSearchText(
  message: string,
  history: { role: 'user' | 'assistant'; text: string }[],
): string {
  const trimmed = message.trim();
  if (!trimmed) return '';
  if (!isFollowUp(trimmed)) return trimmed;
  const priorUser = history
    .filter((turn) => turn.role === 'user')
    .map((turn) => turn.text.trim())
    .filter(Boolean)
    .slice(-2);
  if (!priorUser.length) return trimmed;
  return `${priorUser.join(' ')} ${trimmed}`.trim();
}
