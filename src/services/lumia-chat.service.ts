import { LUMIA_NAME } from '@/constants/lumia';
import { EventsService } from '@/services/events.service';
import type { EventWithCreator } from '@/types/database';

export type LumiaChatReply = {
  text: string;
  events: EventWithCreator[];
};

const STOP_WORDS = new Set([
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'de',
  'du',
  'au',
  'aux',
  'et',
  'ou',
  'à',
  'a',
  'en',
  'dans',
  'sur',
  'pour',
  'par',
  'ce',
  'cet',
  'cette',
  'quoi',
  'que',
  'qui',
  'faire',
  'près',
  'pres',
  'chez',
  'moi',
  'nous',
  'toi',
  'il',
  'y',
  'a-t-il',
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function tokens(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function eventHaystack(event: EventWithCreator): string {
  return normalize(
    [
      event.title,
      event.description,
      event.city,
      event.address,
      event.category,
      event.ambiance,
      ...(event.tags || []),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function scoreEvent(event: EventWithCreator, queryTokens: string[]): number {
  const hay = eventHaystack(event);
  return queryTokens.reduce((score, token) => (hay.includes(token) ? score + 1 : score), 0);
}

export function matchEventsLocally(
  query: string,
  catalog: EventWithCreator[],
  limit = 5,
): EventWithCreator[] {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return [];

  return catalog
    .filter((event) => event.status === 'published' || event.status == null)
    .map((event) => ({ event, score: scoreEvent(event, queryTokens) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.event);
}

export async function askLumiaLocal(query: string): Promise<LumiaChatReply> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { text: 'Dis-moi ce que tu cherches — un lieu, un thème, un moment.', events: [] };
  }

  const catalog = await EventsService.listEvents({ limit: 80 });
  const events = matchEventsLocally(trimmed, catalog);

  if (!events.length) {
    return {
      text: `Je n’ai rien trouvé parmi les moments publiés pour « ${trimmed} ». Reformule, ou ouvre la carte — je n’invente jamais un événement.`,
      events: [],
    };
  }

  const names = events.map((event) => event.title).join(', ');
  return {
    text: `Voici ce que j’ai parmi les moments publiés : ${names}. Tape un titre pour ouvrir le détail.`,
    events,
  };
}

export const LUMIA_CHAT_WELCOME = `Salut, je suis ${LUMIA_NAME}. Demande-moi un moment près de toi (thème, ville, week-end). Je ne te propose que des événements déjà publiés dans l’app.`;
