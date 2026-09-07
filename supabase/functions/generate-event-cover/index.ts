import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

/**
 * SCRUM-117 — Sobriety-first event cover from title / place / category.
 * Auth: JWT required. No client API keys.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENAI_IMAGE_MODEL = Deno.env.get('OPENAI_EVENT_COVER_MODEL') ?? 'dall-e-3';
const BUCKET = 'event-media';

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

function buildPrompt(input: { title: string; description: string; category: string; city: string }): string {
  const place = input.city.trim() || 'France';
  const category = input.category.trim() || 'événement local';
  const desc = input.description.trim().slice(0, 280);
  return [
    'Create a sober photographic cover image for a local community event.',
    `Event title (do NOT render as readable text in the image): ${input.title}.`,
    `Place: ${place}. Category: ${category}.`,
    desc ? `Mood from description: ${desc}` : '',
    'Style: quiet documentary photography, natural light, muted earth and forest-green tones, no logos, no brand names, no posters, no typography, no watermarks, no people faces in close-up.',
    '16:9 landscape, high quality, not stock-AI glossy, not neon, not cyberpunk.',
  ]
    .filter(Boolean)
    .join(' ');
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

  let payload: { title?: unknown; description?: unknown; category?: unknown; city?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, message: 'Données invalides.' }, 400);
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  if (title.length < 3) {
    return jsonResponse({ ok: false, message: 'Ajoute un titre avant de générer une cover.' }, 400);
  }

  const prompt = buildPrompt({
    title,
    description: typeof payload.description === 'string' ? payload.description : '',
    category: typeof payload.category === 'string' ? payload.category : '',
    city: typeof payload.city === 'string' ? payload.city : '',
  });

  const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      size: '1792x1024',
      quality: 'standard',
      response_format: 'b64_json',
      n: 1,
    }),
  });

  if (!openaiRes.ok) {
    const errBody = await openaiRes.text();
    console.log('[generate-event-cover] openai error', openaiRes.status, errBody.slice(0, 500));
    return jsonResponse({ ok: false, message: 'La génération a échoué. Réessaie ou ajoute une photo.' }, 502);
  }

  const openaiJson = await openaiRes.json();
  const b64 = openaiJson?.data?.[0]?.b64_json as string | undefined;
  if (!b64) {
    return jsonResponse({ ok: false, message: 'Image vide renvoyée par le modèle.' }, 502);
  }

  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const filePath = `event-covers/${user.id}/ai-${Date.now()}.png`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, bytes, {
    contentType: 'image/png',
    upsert: true,
  });
  if (uploadError) {
    console.log('[generate-event-cover] upload error', uploadError);
    return jsonResponse({ ok: false, message: 'Impossible d’enregistrer la cover.' }, 500);
  }

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  return jsonResponse({
    ok: true,
    cover_url: publicUrl.publicUrl,
    storage_path: filePath,
  });
});
