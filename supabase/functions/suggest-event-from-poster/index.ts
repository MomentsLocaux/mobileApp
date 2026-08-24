import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  EXTRACTION_JSON_SCHEMA,
  mapRawToFields,
  type RawExtraction,
} from './schema.ts';
import {
  filterTagSlugs,
  formatTaxonomyForPrompt,
  isAllowedCategory,
  isAllowedSubcategory,
} from './taxonomy.ts';

/**
 * SCRUM-107 — Poster / flyer / screenshot → structured event fields (vision).
 *
 * Auth: JWT required. Quota: event_suggest_usage (monthly, UTC).
 * Model: gpt-4o-mini + Structured Outputs.
 * Mobile maps fields → useCreateEventStore (SCRUM-108).
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENAI_MODEL = Deno.env.get('OPENAI_EVENT_SUGGEST_MODEL') ?? 'gpt-4o-mini';
const MONTHLY_QUOTA = Number(Deno.env.get('EVENT_SUGGEST_MONTHLY_QUOTA') ?? '10');
const MAX_BASE64_CHARS = 6_000_000; // ~4.5 MB binary

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function buildSystemPrompt(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const taxonomy = formatTaxonomyForPrompt();

  return `Tu analyses une photo d'affiche, flyer ou capture d'écran d'événement local en France.

Objectif : extraire les informations visibles pour préremplir un formulaire d'événement Moments Locaux.

RÈGLES DURES :
1) Ne retourne detected_event=true que si l'image contient clairement un événement (date, titre, lieu…).
2) N'invente AUCUNE information absente de l'image. Champ illisible ou absent → value null et confidence ≤ 0.3.
3) category_slug et subcategory_slug DOIVENT être choisis UNIQUEMENT dans la taxonomie fournie. Sinon null.
4) tag_slugs : uniquement des slugs autorisés, max 3 (ex. "gratuit" si affiché).
5) Si l'année n'est pas sur l'affiche, infère ${year} ou ${year + 1} selon le contexte ; mets year_inferred=true et confidence modérée.
6) Dates au format YYYY-MM-DD, horaires HH:mm (24h). Prix en euros (nombre, pas de symbole).
7) confidence entre 0 et 1 par champ (_confidence). ≥0.85 = très lisible, 0.6–0.84 = incertain, <0.6 = douteux.
8) warnings : liste de notes courtes (ex. "date partiellement coupée").

${taxonomy}`;
}

type ImagePayload =
  | { kind: 'url'; url: string }
  | { kind: 'base64'; dataUrl: string };

function resolveImage(payload: {
  image_url?: unknown;
  image_base64?: unknown;
  image_mime?: unknown;
}): ImagePayload | { error: string } {
  const url = typeof payload.image_url === 'string' ? payload.image_url.trim() : '';
  if (url) {
    if (!/^https?:\/\//i.test(url)) {
      return { error: 'URL image invalide.' };
    }
    return { kind: 'url', url };
  }

  const b64 = typeof payload.image_base64 === 'string' ? payload.image_base64.trim() : '';
  if (b64) {
    if (b64.length > MAX_BASE64_CHARS) {
      return { error: 'Image trop volumineuse (max ~4 Mo).' };
    }
    const mime =
      typeof payload.image_mime === 'string' && payload.image_mime.startsWith('image/')
        ? payload.image_mime
        : 'image/jpeg';
    const dataUrl = b64.startsWith('data:') ? b64 : `data:${mime};base64,${b64}`;
    return { kind: 'base64', dataUrl };
  }

  return { error: 'image_url ou image_base64 requis.' };
}

function sanitizeExtraction(raw: RawExtraction): RawExtraction {
  let category = raw.category_slug;
  let subcategory = raw.subcategory_slug;

  if (!isAllowedCategory(category)) {
    category = null;
    subcategory = null;
  } else if (!isAllowedSubcategory(category, subcategory)) {
    subcategory = null;
  }

  return {
    ...raw,
    category_slug: category,
    subcategory_slug: subcategory,
    tag_slugs: filterTagSlugs(raw.tag_slugs),
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((w) => typeof w === 'string').slice(0, 8)
      : [],
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Méthode non autorisée.' }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, code: 'service_error', message: 'Configuration serveur manquante.' }, 500);
  }

  if (!OPENAI_API_KEY) {
    return jsonResponse({ ok: false, code: 'service_error', message: 'OPENAI_API_KEY manquante côté serveur.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return jsonResponse({ ok: false, code: 'service_error', message: 'Authentification requise.' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return jsonResponse({ ok: false, code: 'service_error', message: 'Utilisateur invalide.' }, 401);
  }
  const userId = userData.user.id;

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, code: 'service_error', message: 'Données invalides.' }, 400);
  }

  const imageResult = resolveImage(payload);
  if ('error' in imageResult) {
    return jsonResponse({ ok: false, code: 'service_error', message: imageResult.error }, 400);
  }

  const period = periodYm();
  let quotaRemaining: number | null = null;

  try {
    const { data: usageRow, error: usageError } = await supabase
      .from('event_suggest_usage')
      .select('request_count')
      .eq('user_id', userId)
      .eq('period_ym', period)
      .maybeSingle();

    if (usageError) {
      console.log('[suggest-event-from-poster] quota read error', usageError);
      return jsonResponse(
        { ok: false, code: 'service_error', message: 'Quota indisponible. Réessaie plus tard.' },
        503,
      );
    }

    const count = usageRow?.request_count ?? 0;
    if (count >= MONTHLY_QUOTA) {
      return jsonResponse(
        {
          ok: false,
          code: 'quota_exceeded',
          message: `Tu as atteint ta limite d'analyses d'affiches pour ce mois (${MONTHLY_QUOTA}). Tu peux saisir l'événement manuellement.`,
          quota: { limit: MONTHLY_QUOTA, remaining: 0, period },
        },
        429,
      );
    }

    const { error: upsertError } = await supabase.from('event_suggest_usage').upsert(
      {
        user_id: userId,
        period_ym: period,
        request_count: count + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,period_ym' },
    );

    if (upsertError) {
      console.log('[suggest-event-from-poster] quota write error', upsertError);
    } else {
      quotaRemaining = Math.max(0, MONTHLY_QUOTA - (count + 1));
    }
  } catch (quotaErr) {
    console.log('[suggest-event-from-poster] quota exception', quotaErr);
    return jsonResponse(
      { ok: false, code: 'service_error', message: 'Quota indisponible. Réessaie plus tard.' },
      503,
    );
  }

  const imageContent =
    imageResult.kind === 'url'
      ? { type: 'image_url' as const, image_url: { url: imageResult.url, detail: 'high' as const } }
      : { type: 'image_url' as const, image_url: { url: imageResult.dataUrl, detail: 'high' as const } };

  let raw: RawExtraction;
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.1,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'poster_event_extraction',
            strict: true,
            schema: EXTRACTION_JSON_SCHEMA,
          },
        },
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyse cette image et extrais les champs événement visibles.',
              },
              imageContent,
            ],
          },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      console.log('[suggest-event-from-poster] openai error', openaiRes.status, errBody.slice(0, 500));
      return jsonResponse(
        {
          ok: false,
          code: 'service_error',
          message: 'Analyse indisponible pour le moment. Réessaie ou saisis manuellement.',
        },
        502,
      );
    }

    const openaiJson = await openaiRes.json();
    const content = openaiJson?.choices?.[0]?.message?.content ?? '';
    raw = JSON.parse(content) as RawExtraction;
  } catch (err) {
    console.log('[suggest-event-from-poster] openai fetch/parse failed', err);
    return jsonResponse(
      {
        ok: false,
        code: 'service_error',
        message: 'Analyse indisponible pour le moment. Réessaie ou saisis manuellement.',
      },
      502,
    );
  }

  if (!raw.detected_event) {
    return jsonResponse({
      ok: false,
      code: 'no_event_detected',
      detected_event: false,
      message:
        "Nous n'avons pas réussi à identifier un événement sur cette image. Tu peux saisir les informations manuellement.",
      quota: { limit: MONTHLY_QUOTA, remaining: quotaRemaining, period },
    });
  }

  const hasAnyField =
    raw.title ||
    raw.start_date ||
    raw.venue_name ||
    raw.address_text ||
    raw.city_hint ||
    raw.description;

  if (!hasAnyField) {
    return jsonResponse({
      ok: false,
      code: 'image_unreadable',
      detected_event: false,
      message:
        "Certaines informations sont illisibles sur cette image. Réessaie avec une photo plus nette ou saisis manuellement.",
      warnings: raw.warnings ?? [],
      quota: { limit: MONTHLY_QUOTA, remaining: quotaRemaining, period },
    });
  }

  const sanitized = sanitizeExtraction(raw);
  const fields = mapRawToFields(sanitized);

  return jsonResponse({
    ok: true,
    detected_event: true,
    fields,
    warnings: sanitized.warnings,
    model: OPENAI_MODEL,
    quota: { limit: MONTHLY_QUOTA, remaining: quotaRemaining, period },
  });
});
