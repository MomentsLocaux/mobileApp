import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  embedQuery,
  formatRagForPrompt,
  retrieveByEmbedding,
  type RagPack,
} from './rag.ts';
import ragChunksJson from './rag-chunks.json' with { type: 'json' };

/**
 * Lumia chat — documentary RAG (prod)
 *
 * 1) Embed user question (OpenAI embeddings)
 * 2) Semantic retrieve over documentary chunks (pre-ingested markdown)
 * 3) Optionally search published events in DB
 * 4) LLM answers ONLY from retrieved docs + events
 *
 * Docs SSOT: content/lumia/docs/*.md
 * Ingest:    node scripts/ingest-lumia-rag.mjs
 * Future:    pgvector table (migration draft, human-applied)
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

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  address: string | null;
  category: string | null;
  starts_at: string | null;
  status: string | null;
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
  'pres',
  'chez',
  'moi',
  'nous',
  'toi',
]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

function scoreEvent(event: EventRow, queryTokens: string[]): number {
  const hay = normalize(
    [event.title, event.description, event.city, event.address, event.category]
      .filter(Boolean)
      .join(' '),
  );
  return queryTokens.reduce((score, token) => (hay.includes(token) ? score + 1 : score), 0);
}

function periodYm(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
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

  let payload: { message?: string; city?: string | null };
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

  const period = periodYm();
  let quotaRemaining: number | null = null;
  try {
    const { data: usageRow, error: usageError } = await supabase
      .from('lumia_chat_usage')
      .select('request_count')
      .eq('user_id', userId)
      .eq('period_ym', period)
      .maybeSingle();

    if (!usageError) {
      const count = usageRow?.request_count ?? 0;
      if (count >= MONTHLY_QUOTA) {
        return jsonResponse(
          {
            ok: false,
            code: 'quota_exceeded',
            message: `Tu as utilisé ton quota Lumia pour ce mois (${MONTHLY_QUOTA} demandes). Reviens le mois prochain.`,
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
      if (!upsertError) {
        quotaRemaining = Math.max(0, MONTHLY_QUOTA - (count + 1));
      }
    }
  } catch (quotaErr) {
    console.log('[lumia-chat] quota table unavailable', quotaErr);
  }

  // --- Documentary RAG ---
  let docHits: ReturnType<typeof retrieveByEmbedding> = [];
  try {
    const queryEmbedding = await embedQuery(OPENAI_API_KEY, EMBED_MODEL, message);

    // Prefer DB match when migration applied; else bundled chunks.
    const { data: dbHits, error: dbErr } = await supabase.rpc('match_lumia_doc_chunks', {
      query_embedding: queryEmbedding,
      match_count: 6,
      match_threshold: 0.25,
    });

    if (!dbErr && Array.isArray(dbHits) && dbHits.length) {
      docHits = dbHits.map((row: {
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
      }));
    } else {
      docHits = retrieveByEmbedding(RAG_PACK, queryEmbedding, 6, 0.25);
    }
  } catch (ragErr) {
    console.log('[lumia-chat] RAG retrieve failed', ragErr);
    return jsonResponse(
      { ok: false, message: 'Lumia est momentanément indisponible. Réessaie dans un instant.' },
      502,
    );
  }

  const docCategories = new Set(docHits.map((h) => h.category));
  const looksLikeEventSearch =
    tokens(message).length > 0 &&
    !docCategories.has('legal') &&
    !/\b(cgu|rgpd|prix|tarif|abonnement|parametr|comment|supprim(er)? (mon )?compte)\b/.test(
      normalize(message),
    );

  let candidateEvents: EventRow[] = [];
  if (looksLikeEventSearch) {
    const queryTokens = tokens(message);
    const orFilter = queryTokens
      .slice(0, 5)
      .map((t) => `title.ilike.%${t}%,city.ilike.%${t}%,description.ilike.%${t}%`)
      .join(',');

    const { data: rows, error: eventsError } = await supabase
      .from('events')
      .select('id,title,description,city,address,category,starts_at,status')
      .eq('status', 'published')
      .or(orFilter)
      .limit(40);

    if (eventsError) {
      console.log('[lumia-chat] events query error', eventsError);
    } else if (Array.isArray(rows)) {
      candidateEvents = (rows as EventRow[])
        .map((event) => ({ event, score: scoreEvent(event, queryTokens) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((row) => row.event);
    }
  }

  const catalogForPrompt = candidateEvents.map((e) => ({
    id: e.id,
    title: e.title,
    city: e.city,
    category: e.category,
    starts_at: e.starts_at,
  }));

  const docsBlock = formatRagForPrompt(docHits);

  const systemPrompt = `Tu es Lumia, assistante de Moments Locaux (France). Tutoiement, ton clair.

Tu es un LLM ancré sur une BASE DOCUMENTAIRE (extraits fournis) + une liste d’événements publiés.
RÈGLES DURES :
1) Réponds UNIQUEMENT à partir des extraits documentaires et/ou des events fournis.
2) N’invente aucun prix, event, id, ni règle absente des extraits.
3) Juridique / RGPD : oriente vers les parcours cités dans les docs ; pas de conseil juridique.
4) Partenaire / Diffuseur / pro / collaboration B2B :
   - Vocabulaire public validé : **Moments Partenaire** (accueillir, attention) vs **Moments Diffuseur** (publier des événements). Cumulables.
   - Moments Partenaire ≠ régie pub ≠ coupons génériques (cf. extraits site).
   - Ouverture espaces pro : après lancement app ; candidature dès maintenant via hello@moments-locaux.com.
   - Ne pas inventer tarifs, quotas ou parcours in-app pro si extraits disent flag off / ouverture future.
   - Pass Lumo in-app = côté habitant ; ne remplace pas le discours B2B Moments Partenaire.
5) Hors sujet → refuse et recentre.
6) Pas de billetterie.

Français, max ~120 mots.
JSON STRICT unique :
{"text":"...","event_ids":["uuid",...]}
event_ids ⊆ events fournis, sinon [].`;

  const userPrompt = JSON.stringify({
    message,
    documentary_excerpts: docsBlock,
    events: catalogForPrompt,
    city: payload.city ?? null,
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      console.log('[lumia-chat] openai error', openaiRes.status, errBody.slice(0, 400));
      return jsonResponse(
        { ok: false, message: 'Lumia est momentanément indisponible. Réessaie dans un instant.' },
        502,
      );
    }

    const openaiJson = await openaiRes.json();
    openaiText = openaiJson?.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    console.log('[lumia-chat] openai fetch failed', err);
    return jsonResponse(
      { ok: false, message: 'Lumia est momentanément indisponible. Réessaie dans un instant.' },
      502,
    );
  }

  let parsed: { text?: string; event_ids?: string[] } = {};
  try {
    parsed = JSON.parse(openaiText);
  } catch {
    parsed = {
      text: docHits[0]?.content?.slice(0, 400) ?? 'Je n’ai pas compris. Reformule ta question.',
      event_ids: [],
    };
  }

  const allowed = new Set(candidateEvents.map((e) => e.id));
  const eventIds = Array.isArray(parsed.event_ids)
    ? parsed.event_ids.filter((id) => typeof id === 'string' && allowed.has(id)).slice(0, 5)
    : [];

  const text =
    typeof parsed.text === 'string' && parsed.text.trim()
      ? parsed.text.trim()
      : 'Je n’ai pas trouvé d’extrait documentaire assez proche. Reformule ou ouvre Paramètres / la carte.';

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

  return jsonResponse({
    ok: true,
    text,
    event_ids: eventIds,
    events,
    rag: {
      model: RAG_PACK.model,
      chunk_ids: docHits.map((h) => h.id),
      scores: docHits.map((h) => Number(h.score.toFixed(3))),
    },
    quota: {
      limit: MONTHLY_QUOTA,
      remaining: quotaRemaining,
      period,
    },
  });
});
