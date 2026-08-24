import { LUMIA_NAME } from '@/constants/lumia';
import { supabase } from '@/lib/supabase/client';
import { EventsService } from '@/services/events.service';
import { lumiaFeatureFlagsForApi, matchAppHelp } from '@/services/lumia-help';
import type { EventWithCreator } from '@/types/database';

export type LumiaChatReply = {
  text: string;
  events: EventWithCreator[];
  quota?: { limit: number; remaining: number | null; period: string } | null;
};

type LumiaChatEdgeSuccess = {
  ok: true;
  text: string;
  event_ids?: string[];
  quota?: { limit: number; remaining: number | null; period: string };
};

type LumiaChatEdgeError = {
  ok?: false;
  code?: string;
  message?: string;
  quota?: { limit: number; remaining: number | null; period: string };
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
    return {
      text: 'Pose-moi une question sur l’app (carte, favoris, compte…) ou décris un moment que tu cherches.',
      events: [],
    };
  }

  const help = matchAppHelp(trimmed);
  if (help?.preferHelp) {
    return { text: help.answer, events: [] };
  }

  const catalog = await EventsService.listEvents({ limit: 80 });
  const events = matchEventsLocally(trimmed, catalog);

  if (events.length) {
    const names = events.map((event) => event.title).join(', ');
    return {
      text: `Voici ce que j’ai parmi les moments publiés : ${names}. Tu peux ouvrir une fiche ci-dessous.`,
      events,
    };
  }

  if (help) {
    return { text: help.answer, events: [] };
  }

  return {
    text: `Je n’ai pas trouvé de moment publié pour « ${trimmed} », et ce n’est pas une question d’usage que je reconnais encore. Reformule : « comment ouvrir la carte », ou un thème / une ville. Je n’invente jamais d’événement.`,
    events: [],
  };
}

/** Prefer Edge Function (OpenAI + DB grounding); fall back to local matcher if offline/errors. */
export async function askLumia(query: string): Promise<LumiaChatReply> {
  const trimmed = query.trim();
  if (!trimmed) {
    return askLumiaLocal(trimmed);
  }

  try {
    const { data, error } = await supabase.functions.invoke<LumiaChatEdgeSuccess | LumiaChatEdgeError>(
      'lumia-chat',
      {
        body: {
          message: trimmed,
          feature_flags: lumiaFeatureFlagsForApi(),
        },
      },
    );

    if (error) {
      const response = (error as { context?: Response }).context;
      if (response) {
        try {
          const payload = (await response.json()) as LumiaChatEdgeError;
          if (payload?.message) {
            return {
              text: payload.message,
              events: [],
              quota: payload.quota ?? null,
            };
          }
        } catch {
          // Fall through to local.
        }
      }
      return askLumiaLocal(trimmed);
    }

    if (!data || data.ok !== true || typeof (data as LumiaChatEdgeSuccess).text !== 'string') {
      const err = data as LumiaChatEdgeError | null;
      if (err?.message) {
        return { text: err.message, events: [], quota: err.quota ?? null };
      }
      return askLumiaLocal(trimmed);
    }

    const success = data as LumiaChatEdgeSuccess;
    const ids = Array.isArray(success.event_ids) ? success.event_ids.filter(Boolean) : [];
    const events = ids.length ? await EventsService.getEventsByIds(ids) : [];
    const ordered = ids
      .map((id) => events.find((event) => event.id === id))
      .filter((event): event is EventWithCreator => Boolean(event));

    return {
      text: success.text,
      events: ordered,
      quota: success.quota ?? null,
    };
  } catch {
    return askLumiaLocal(trimmed);
  }
}

export const LUMIA_CHAT_WELCOME = `Salut, je suis ${LUMIA_NAME}. Je t’aide à utiliser Moments Locaux (carte, favoris, compte, signalement…) et à trouver des moments déjà publiés. Je n’invente pas d’événements et je ne vends pas de tickets.`;
