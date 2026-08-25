#!/usr/bin/env node
/**
 * Simulate Lumia reply (ADR 008: prompt + RAG app_help, no DB events).
 * Usage: node scripts/test-lumia-query.mjs "ta question"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAG_FILE = path.join(ROOT, 'supabase/functions/lumia-chat/rag-chunks.json');
const MODEL = process.env.OPENAI_LUMIA_MODEL || 'gpt-4o-mini';
const EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const MIN_SCORE = 0.38;

const SYSTEM_PROMPT = `Tu es Lumia, assistante de Moments Locaux (France). Tutoiement, ton clair et utile.
Tu réponds UNIQUEMENT à partir de tool_app_help (extraits) et tool_search_events (ici vide en simu locale).
RÈGLES : réponds à la question ; n’évoque un sujet QUE s’il est dans les extraits ; n’invente rien ; pas de billetterie ; hors sujet → refuse.
En MVP on ne change PAS l’email in-app. Si la question porte sur l’email : dis que c’est impossible in-app et oriente hello@moments-locaux.com.
Quand tu cites un écran réellement utile, utilise un lien Markdown [libellé](href) depuis : [CGU](/settings/legal/cgu), [Confidentialité](/settings/privacy/policy), [Supprimer mon compte](/settings/privacy/delete), [Carte](/(tabs)/map), [Paramètres](/settings), [Modifier le profil](/profile/edit).
actions = [] sauf si tu ouvres vraiment l’écran cité.
JSON STRICT: {"text":"...","event_ids":[],"actions":[]}`;

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

function cosine(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function formatRag(hits) {
  if (!hits.length) return 'Aucun extrait documentaire pertinent.';
  return hits
    .map((h, i) => `### Extrait ${i + 1} (${h.id} · ${h.category})\n${h.content}`)
    .join('\n\n');
}

async function embed(apiKey, text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).data[0].embedding;
}

function routeLocal(message) {
  const GREETING_RE =
    /^(hello|hi|hey|yo|hola|bonjour|bonsoir|salut|coucou|hey\s+lumia|salut\s+lumia|bonjour\s+lumia)([\s!.?…]*)?$/i;
  if (GREETING_RE.test(message.trim())) return { isGreeting: true, useAppHelp: false };
  return { isGreeting: false, useAppHelp: true };
}

async function main() {
  loadEnv();
  const message = process.argv.slice(2).join(' ').trim();
  if (!message) {
    console.error('Usage: node scripts/test-lumia-query.mjs "question"');
    process.exit(1);
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY missing');
    process.exit(1);
  }

  const route = routeLocal(message);
  if (route.isGreeting) {
    console.log(
      JSON.stringify(
        {
          question: message,
          text: 'Salut ! Content de te voir. Tu cherches un moment près de chez toi, ou tu as une question sur l’app ? Je t’écoute.',
          event_ids: [],
          sources: [],
          route,
        },
        null,
        2,
      ),
    );
    return;
  }

  const pack = JSON.parse(fs.readFileSync(RAG_FILE, 'utf8'));
  const queryEmb = await embed(apiKey, message);
  const hits = pack.chunks
    .map((c) => ({ ...c, score: cosine(queryEmb, c.embedding) }))
    .filter((c) => c.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const userPrompt = JSON.stringify({
    message,
    tool_app_help: formatRag(hits),
    tool_search_events: [],
  });

  const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!chatRes.ok) throw new Error(await chatRes.text());
  const parsed = JSON.parse((await chatRes.json()).choices[0].message.content);

  console.log(
    JSON.stringify(
      {
        question: message,
        text: parsed.text,
        event_ids: parsed.event_ids || [],
        actions: parsed.actions || [],
        sources: hits.map((h) => ({ id: h.id, score: Number(h.score.toFixed(3)) })),
        route,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
