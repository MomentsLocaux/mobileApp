/** Device-side Lumia conversation helpers (SCRUM-155). Keep in sync with supabase/functions/lumia-chat/history.ts */

export const LUMIA_HISTORY_TURN_LIMIT = 6;
export const LUMIA_HISTORY_TEXT_MAX = 400;

export type LumiaHistoryTurn = {
  role: 'user' | 'lumia';
  text: string;
};

export type LumiaEdgeHistoryTurn = {
  role: 'user' | 'assistant';
  text: string;
};

const FOLLOW_UP_RE =
  /\b(et|aussi|pareil|pareille|idem|ceux|celles|meme|memes|autre|ailleurs|plutot|toujours|encore|plus\s+pres|demain|ce\s+soir|aujourd|week|semaine|la\s+bas)\b/i;

const LOCATIVE_START_RE = /^(a|sur|dans|pres|proche|autour|demain|aujourd|soir|weekend|week)/i;

const EVENT_TYPE_RE =
  /\b(concerts?|festivals?|brocante|vide[\s-]?grenier|expos?(ition)?|ateliers?|theatres?|cinemas?|sports?|randos?|marches?|spectacles?|evenements?|moments?)\b/;

const NEAR_ME_RE = /\b(pres de moi|autour de moi|chez moi|dans les parages|a cote|proche de moi)\b/i;

export function normalizeLumiaText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isLumiaNearMeQuery(message: string): boolean {
  return NEAR_ME_RE.test(normalizeLumiaText(message));
}

export function isLumiaFollowUp(message: string): boolean {
  const n = normalizeLumiaText(message);
  if (!n) return false;
  const words = n.split(' ').filter(Boolean);
  if (EVENT_TYPE_RE.test(n) && words.length >= 3) return false;
  if (/^(et|aussi)\b/.test(n)) return true;
  if (words.length <= 4 && (FOLLOW_UP_RE.test(n) || LOCATIVE_START_RE.test(n))) return true;
  return false;
}

export function composeLumiaSearchText(message: string, history: LumiaHistoryTurn[]): string {
  const trimmed = message.trim();
  if (!trimmed) return '';
  if (!isLumiaFollowUp(trimmed)) return trimmed;

  const priorUser = history
    .filter((turn) => turn.role === 'user')
    .map((turn) => turn.text.trim())
    .filter(Boolean)
    .slice(-2);
  if (!priorUser.length) return trimmed;
  return `${priorUser.join(' ')} ${trimmed}`.trim();
}

export function toLumiaEdgeHistory(history: LumiaHistoryTurn[]): LumiaEdgeHistoryTurn[] {
  return history
    .filter((turn) => turn.text.trim().length > 0)
    .slice(-LUMIA_HISTORY_TURN_LIMIT)
    .map((turn) => ({
      role: turn.role === 'user' ? 'user' : 'assistant',
      text: turn.text.trim().slice(0, LUMIA_HISTORY_TEXT_MAX),
    }));
}
