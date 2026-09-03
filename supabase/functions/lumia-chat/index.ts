import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  embedQuery,
  formatRagForPrompt,
  retrieveByEmbedding,
  RAG_MIN_SCORE,
  type RagPack,
} from './rag.ts';
import { GREETING_REPLY, buildLumiaSystemPrompt } from './prompt.ts';
import { isGreeting, routeLumiaMessage } from './route.ts';
import { searchEvents, type EventRow } from './search-events.ts';
import { composeSearchText, isFollowUp, isNearMeQuery, sanitizeHistory } from './history.ts';
import { filterLumiaActions } from './deeplinks.ts';
import ragChunksJson from './rag-chunks.json' with { type: 'json' };

/**
 * Lumia chat — ADR 008 minimal agent
 *
 * 1) Guard: greeting → fixed reply
 * 2) Route: useAppHelp (RAG) / useSearchEvents (tool)
 * 3) LLM answers ONLY from tool + RAG context
 * 4) event_ids ⊆ search_events results
 *
 * SCRUM-100 / RGPD: never persist chat transcripts; never log message content.
 * Docs SSOT: content/lumia/docs/*.md
 * Ingest:    node scripts/ingest-lumia-rag.mjs
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENAI_MODEL = Deno.env.get('OPENAI_LUMIA_MODEL') ?? 'gpt-4o-mini';
const EMBED_MODEL = Deno.env.get('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';
const MONTHLY_QUOTA = Number(Deno.env.get('LUMIA_MONTHLY_QUOTA') ?? '20');

const RAG_PACK = ragChunksJson as RagPack;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Operational logs only — never include user message / LLM prompt bodies (SCRUM-100). */
function logOps(event: string, detail?: string) {
  const safe = detail ? detail.replace(/\s+/g, ' ').slice(0, 120) : '';
  console.log(safe ? `[lumia-chat] ${event} ${safe}` : `[lumia-chat] ${event}`);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function periodYm(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

async function runAppHelp(
  supabase: ReturnType<typeof createClient>,
  message: string,
): Promise<ReturnType<typeof retrieveByEmbedding>> {
  const queryEmbedding = await embedQuery(OPENAI_API_KEY, EMBED_MODEL, message);

  const { data: dbHits, error: dbErr } = await supabase.rpc('match_lumia_doc_chunks', {
    query_embedding: queryEmbedding,
    match_count: 6,
    match_threshold: RAG_MIN_SCORE,
  });

  if (!dbErr && Array.isArray(dbHits) && dbHits.length) {
    return dbHits.map(
      (row: {
        id: string;
        doc_id: string;
        title: string;
        category: string;
        content: string;
        score: number;
      }) => ({
        id: row.id,
        doc_id: row.doc_id,
        title: row.title,
        category: row.category,
        content: row.content,
        embedding: [],
        score: row.score,
      }),
    );
  }

  return retrieveByEmbedding(RAG_PACK, queryEmbedding, 6, RAG_MIN_SCORE);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Méthode non autorisée.' }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, message: 'Configuration serveur manquante.' }, 500);
  }

  if (!OPENAI_API_KEY) {
    return jsonResponse({ ok: false, message: 'OPENAI_API_KEY manquante côté serveur.' }, 500);
  }

  if (!RAG_PACK?.chunks?.length) {
    return jsonResponse(
      { ok: false, message: 'Base documentaire Lumia non ingérée (rag-chunks.json vide).' },
      500,
    );
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return jsonResponse({ ok: false, message: 'Authentification requise.' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return jsonResponse({ ok: false, message: 'Utilisateur invalide.' }, 401);
  }
  const userId = userData.user.id;

  let payload: { message?: string; city?: string | null; history?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, message: 'Données invalides.' }, 400);
  }

  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (!message || message.length > 800) {
    return jsonResponse(
      { ok: false, message: 'Message vide ou trop long (max 800 caractères).' },
      400,
    );
  }

  const history = sanitizeHistory(payload.history);
  const searchText = composeSearchText(message, history);
  const priorHadEvents = isFollowUp(message) && history.some((turn) => turn.role === 'user');

  // --- Layer 4: greeting guard ---
  if (isGreeting(message)) {
    return jsonResponse({
      ok: true,
      text: GREETING_REPLY,
      event_ids: [],
      events: [],
      quota: null,
      route: { isGreeting: true },
    });
  }

  const period = periodYm();
  let quotaRemaining: number | null = null;

  try {
    const { data: usageRow, error: usageError } = await supabase
      .from('lumia_chat_usage')
      .select('request_count')
      .eq('user_id', userId)
      .eq('period_ym', period)
      .maybeSingle();

    if (usageError) {
      logOps('quota_read_error', usageError.message ?? String(usageError.code ?? ''));
      return jsonResponse(
        {
          ok: false,
          code: 'service_error',
          message: 'Quota Lumia indisponible. Réessaie dans un instant.',
        },
        503,
      );
    }

    const count = usageRow?.request_count ?? 0;
    if (count >= MONTHLY_QUOTA) {
      return jsonResponse(
        {
          ok: false,
          code: 'quota_exceeded',
          message: `Tu as utilisé ton quota Lumia pour ce mois (${MONTHLY_QUOTA} messages). Reviens le mois prochain.`,
          quota: { limit: MONTHLY_QUOTA, remaining: 0, period },
        },
        429,
      );
    }

    const { error: upsertError } = await supabase.from('lumia_chat_usage').upsert(
      {
        user_id: userId,
        period_ym: period,
        request_count: count + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,period_ym' },
    );

    if (upsertError) {
      logOps('quota_write_error', upsertError.message ?? String(upsertError.code ?? ''));
      return jsonResponse(
        {
          ok: false,
          code: 'service_error',
          message: 'Quota Lumia indisponible. Réessaie dans un instant.',
        },
        503,
      );
    }

    quotaRemaining = Math.max(0, MONTHLY_QUOTA - (count + 1));
  } catch (_quotaErr) {
    logOps('quota_exception');
    return jsonResponse(
      {
        ok: false,
        code: 'service_error',
        message: 'Quota Lumia indisponible. Réessaie dans un instant.',
      },
      503,
    );
  }

  const route = routeLumiaMessage(priorHadEvents ? searchText : message);
  if (priorHadEvents) {
    route.useSearchEvents = true;
  }

  // --- Layer 2: app_help (RAG) ---
  let docHits: ReturnType<typeof retrieveByEmbedding> = [];
  if (route.useAppHelp) {
    try {
      docHits = await runAppHelp(supabase, message);
    } catch (_ragErr) {
      logOps('app_help_failed');
      return jsonResponse(
        { ok: false, message: 'Lumia est momentanément indisponible. Réessaie dans un instant.' },
        502,
      );
    }
  }

  // --- Layer 3: search_events tool ---
  let candidateEvents: EventRow[] = [];
  let searchMeta: Awaited<ReturnType<typeof searchEvents>>['query'] | null = null;
  if (route.useSearchEvents) {
    try {
      const hintCity =
        isNearMeQuery(message) || isNearMeQuery(searchText) ? payload.city ?? null : null;
      const result = await searchEvents(supabase, searchText, hintCity, 8);
      candidateEvents = result.events;
      searchMeta = result.query;
    } catch (_searchErr) {
      logOps('search_events_failed');
    }
  }

  // If we skipped RAG but search returned nothing and message looks like usage, fetch docs as fallback
  if (!docHits.length && !candidateEvents.length && !route.useAppHelp) {
    try {
      docHits = await runAppHelp(supabase, message);
    } catch {
      // ignore
    }
  }

  const catalogForPrompt = candidateEvents.map((e) => ({
    id: e.id,
    title: e.title,
    city: e.city,
    category: e.category,
    starts_at: e.starts_at,
  }));

  const userPrompt = JSON.stringify({
    message,
    conversation_history: history,
    tool_app_help: formatRagForPrompt(docHits),
    tool_search_events: catalogForPrompt,
    search_meta: searchMeta,
    city_hint: payload.city ?? null,
  });

  let openaiText = '';
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildLumiaSystemPrompt() },
          ...history.map((turn) => ({ role: turn.role, content: turn.text })),
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      logOps('openai_http_error', String(openaiRes.status));
      return jsonResponse(
        { ok: false, message: 'Lumia est momentanément indisponible. Réessaie dans un instant.' },
        502,
      );
    }

    const openaiJson = await openaiRes.json();
    openaiText = openaiJson?.choices?.[0]?.message?.content ?? '';
  } catch (_err) {
    logOps('openai_fetch_failed');
    return jsonResponse(
      { ok: false, message: 'Lumia est momentanément indisponible. Réessaie dans un instant.' },
      502,
    );
  }

  let parsed: { text?: string; event_ids?: string[]; actions?: unknown } = {};
  try {
    parsed = JSON.parse(openaiText);
  } catch {
    parsed = {
      text:
        docHits[0]?.content?.slice(0, 400) ??
        'Je n’ai pas compris. Reformule : question sur l’app, ou un moment / une ville.',
      event_ids: [],
      actions: [],
    };
  }

  const allowed = new Set(candidateEvents.map((e) => e.id));
  const eventIds = Array.isArray(parsed.event_ids)
    ? parsed.event_ids.filter((id) => typeof id === 'string' && allowed.has(id)).slice(0, 5)
    : [];

  const actions = filterLumiaActions(parsed.actions);

  const text =
    typeof parsed.text === 'string' && parsed.text.trim()
      ? parsed.text.trim()
      : 'Je n’ai pas trouvé d’info assez proche. Reformule ou ouvre Paramètres / la carte.';

  const events = candidateEvents
    .filter((e) => eventIds.includes(e.id))
    .map((e) => ({
      id: e.id,
      title: e.title,
      city: e.city,
      category: e.category,
      starts_at: e.starts_at,
      status: e.status,
    }));

  // Auto-chip for each returned event if model forgot actions
  for (const e of events) {
    const href = `/events/${e.id}`;
    if (!actions.some((a) => a.href === href) && actions.length < 3) {
      actions.push({ href, label: e.title.slice(0, 48) });
    }
  }

  return jsonResponse({
    ok: true,
    text,
    event_ids: eventIds,
    events,
    actions,
    route,
    rag: {
      model: RAG_PACK.model,
      chunk_ids: docHits.map((h) => h.id),
      scores: docHits.map((h) => Number(h.score.toFixed(3))),
    },
    search_meta: searchMeta,
    quota: {
      limit: MONTHLY_QUOTA,
      remaining: quotaRemaining,
      period,
    },
  });
});
