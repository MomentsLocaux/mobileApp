import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

/**
 * SCRUM-117 — Sobriety-first event cover from title / place / category.
 * Optional reference photo via /v1/images/edits so the place stays recognizable.
 * Auth: JWT required. No client API keys.
 * Quota: 2 generations per draft_id (event_cover_generate_usage).
 *
 * GPT image models (`gpt-image-*`) reject DALL·E-only params (`response_format`,
 * `1792x1024`, `quality: standard`). They always return `b64_json`.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENAI_IMAGE_MODEL = Deno.env.get('OPENAI_EVENT_COVER_MODEL') ?? 'gpt-image-1';
const BUCKET = 'event-media';
const GPT_IMAGE_FALLBACK = 'gpt-image-1';
const PUBLIC_MARKER = '/storage/v1/object/public/event-media/';
const COVER_GENERATE_LIMIT = Number(Deno.env.get('EVENT_COVER_GENERATE_LIMIT') ?? '2');
const DRAFT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseDraftId(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  return DRAFT_ID_RE.test(raw) ? raw : null;
}

function isMissingQuotaInfra(message: string): boolean {
  return /could not find the function|schema cache|does not exist|42P01|42883/i.test(message);
}

const TONES = ['sobre', 'festif', 'intimiste', 'nature'] as const;
type CoverTone = (typeof TONES)[number];

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

function isGptImageModel(model: string): boolean {
  return /^gpt-image/i.test(model);
}

function parseTone(value: unknown): CoverTone {
  return typeof value === 'string' && (TONES as readonly string[]).includes(value)
    ? (value as CoverTone)
    : 'sobre';
}

function toneLine(tone: CoverTone): string {
  switch (tone) {
    case 'festif':
      return 'Mood: lively local celebration, warm golden-hour or string-light atmosphere, photographic not neon, not CGI.';
    case 'intimiste':
      return 'Mood: intimate indoor or small-gathering atmosphere, soft lamp light, close but no identifiable faces.';
    case 'nature':
      return 'Mood: outdoor landscape and vegetation, natural light, quiet documentary feel.';
    default:
      return 'Mood: quiet documentary photography, natural light, muted earth and forest-green tones.';
  }
}

function asString(value: unknown, max = 280): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function buildPrompt(input: {
  title: string;
  description: string;
  category: string;
  subcategory: string;
  city: string;
  tags: string;
  tone: CoverTone;
  hasReference: boolean;
}): string {
  const place = input.city || 'France';
  const category = input.category || 'événement local';
  const parts = [
    input.hasReference
      ? 'Create a sober photographic cover image inspired by the reference photo of a real local event. Keep the place, architecture and atmosphere recognizable. Do not copy text, logos, posters, watermarks or close-up faces from the photo.'
      : 'Create a sober photographic cover image for a local community event.',
    `Event title (do NOT render as readable text in the image): ${input.title}.`,
    `Place: ${place}. Category: ${category}.`,
    input.subcategory ? `Subcategory: ${input.subcategory}.` : '',
    input.tags ? `Tags: ${input.tags}.` : '',
    input.description ? `Mood from description: ${input.description}` : '',
    toneLine(input.tone),
    'No logos, no brand names, no posters, no typography, no watermarks, no people faces in close-up. 16:9 landscape, high quality, not stock-AI glossy, not neon, not cyberpunk.',
  ];
  return parts.filter(Boolean).join(' ');
}

function resolveUserStoragePath(raw: string, userId: string): string | null {
  let path = raw.trim();
  if (!path) return null;
  const idx = path.indexOf(PUBLIC_MARKER);
  if (idx !== -1) path = path.slice(idx + PUBLIC_MARKER.length);
  path = path.replace(/^\/+/, '').split('?')[0];
  if (!path || path.includes('..')) return null;
  const prefix = `event-covers/${userId}/`;
  if (!path.startsWith(prefix)) return null;
  return path;
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function shouldRetryWithGptImage(status: number, errBody: string, model: string): boolean {
  if (isGptImageModel(model) || status !== 400) return false;
  return /response_format|unknown_parameter|invalid.*size|invalid.*quality|invalid_value/i.test(errBody);
}

type ImageRequest = { res: Response; model: string };

async function requestGeneration(model: string, prompt: string): Promise<ImageRequest> {
  const body = isGptImageModel(model)
    ? { model, prompt, n: 1, size: '1536x1024', quality: 'medium' }
    : {
        model,
        prompt,
        n: 1,
        size: '1792x1024',
        quality: 'standard',
        response_format: 'b64_json',
      };
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { res, model };
}

async function requestEdit(model: string, prompt: string, image: Blob, fileName: string): Promise<ImageRequest> {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('n', '1');
  form.append('size', isGptImageModel(model) ? '1536x1024' : '1792x1024');
  form.append('quality', isGptImageModel(model) ? 'medium' : 'standard');
  form.append('image', image, fileName);
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  return { res, model };
}

serve(async (req) => {
  try {
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
      return jsonResponse({ ok: false, message: 'Génération indisponible.' }, 503);
    }

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!token) return jsonResponse({ ok: false, message: 'Authentification requise.' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return jsonResponse({ ok: false, message: 'Utilisateur invalide.' }, 401);
    }

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ ok: false, message: 'Données invalides.' }, 400);
    }

    const title = asString(payload.title, 160);
    if (title.length < 3) {
      return jsonResponse({ ok: false, message: 'Ajoute un titre avant de générer une cover.' }, 400);
    }

    const draftId = parseDraftId(payload.draft_id);
    if (!draftId) {
      return jsonResponse({ ok: false, message: 'Brouillon invalide. Relance le parcours.' }, 400);
    }

    const { data: quotaOk, error: quotaError } = await supabase.rpc('consume_event_cover_generate_quota', {
      p_user_id: user.id,
      p_draft_id: draftId,
      p_limit: COVER_GENERATE_LIMIT,
    });
    if (quotaError) {
      const message = quotaError.message || '';
      console.log('[generate-event-cover] quota rpc error', message);
      if (!isMissingQuotaInfra(message)) {
        return jsonResponse({ ok: false, message: 'Quota indisponible. Réessaie plus tard.' }, 503);
      }
    } else if (quotaOk === false) {
      return jsonResponse(
        {
          ok: false,
          code: 'quota_exceeded',
          message: `Tu as déjà ${COVER_GENERATE_LIMIT} propositions pour cet événement. Choisis-en une, ou ajoute une photo.`,
        },
        429,
      );
    }

    const quotaConsumed = !quotaError && quotaOk === true;
    const releaseQuota = async () => {
      if (!quotaConsumed) return;
      const { error: releaseError } = await supabase.rpc('release_event_cover_generate_quota', {
        p_user_id: user.id,
        p_draft_id: draftId,
      });
      if (releaseError) {
        console.log('[generate-event-cover] quota release error', releaseError.message);
      }
    };

    const tone = parseTone(payload.tone);
    const tagsRaw = Array.isArray(payload.tags)
      ? payload.tags.filter((t): t is string => typeof t === 'string').join(', ')
      : asString(payload.tags, 160);
    const referenceRaw = asString(payload.reference_path || payload.reference_url, 500);
    const referencePath = referenceRaw ? resolveUserStoragePath(referenceRaw, user.id) : null;

    let referenceBlob: Blob | null = null;
    let referenceName = 'reference.jpg';
    if (referencePath) {
      const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(referencePath);
      if (downloadError || !file) {
        console.log('[generate-event-cover] reference download failed', downloadError);
      } else {
        const mime = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
        referenceBlob = new Blob([await file.arrayBuffer()], { type: mime });
        referenceName = referencePath.split('/').pop() || referenceName;
      }
    }

    const prompt = buildPrompt({
      title,
      description: asString(payload.description, 280),
      category: asString(payload.category, 80),
      subcategory: asString(payload.subcategory, 80),
      city: asString(payload.city, 80),
      tags: tagsRaw.slice(0, 160),
      tone,
      hasReference: Boolean(referenceBlob),
    });

    let modelUsed = OPENAI_IMAGE_MODEL;
    let openaiRes = referenceBlob
      ? (await requestEdit(modelUsed, prompt, referenceBlob, referenceName)).res
      : (await requestGeneration(modelUsed, prompt)).res;

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      console.log('[generate-event-cover] openai error', openaiRes.status, modelUsed, errBody.slice(0, 500));
      if (shouldRetryWithGptImage(openaiRes.status, errBody, modelUsed)) {
        modelUsed = GPT_IMAGE_FALLBACK;
        openaiRes = referenceBlob
          ? (await requestEdit(modelUsed, prompt, referenceBlob, referenceName)).res
          : (await requestGeneration(modelUsed, prompt)).res;
        if (!openaiRes.ok) {
          const retryBody = await openaiRes.text();
          console.log('[generate-event-cover] openai retry error', openaiRes.status, modelUsed, retryBody.slice(0, 500));
        }
      } else if (openaiRes.status === 401 || openaiRes.status === 403) {
        await releaseQuota();
        return jsonResponse(
          {
            ok: false,
            code: 'openai_images_scope',
            message:
              'La génération d’image n’est pas autorisée sur la clé OpenAI du projet. Ajoute le droit Images, puis réessaie.',
          },
          503,
        );
      }
    }

    if (!openaiRes.ok) {
      await releaseQuota();
      return jsonResponse({ ok: false, message: 'La génération a échoué. Réessaie ou ajoute une photo.' }, 502);
    }

    const openaiJson = await openaiRes.json();
    const b64 = openaiJson?.data?.[0]?.b64_json as string | undefined;
    if (!b64) {
      await releaseQuota();
      return jsonResponse({ ok: false, message: 'Image vide renvoyée par le modèle.' }, 502);
    }

    const bytes = decodeBase64(b64);
    const filePath = `event-covers/${user.id}/ai-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, bytes, {
      contentType: 'image/png',
      upsert: true,
    });
    if (uploadError) {
      await releaseQuota();
      console.log('[generate-event-cover] upload error', uploadError);
      return jsonResponse({ ok: false, message: 'Impossible d’enregistrer la cover.' }, 500);
    }

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

    return jsonResponse({
      ok: true,
      cover_url: publicUrl.publicUrl,
      storage_path: filePath,
    });
  } catch (err) {
    console.log('[generate-event-cover] unhandled', err);
    return jsonResponse({ ok: false, message: 'La génération a échoué. Réessaie ou ajoute une photo.' }, 500);
  }
});
