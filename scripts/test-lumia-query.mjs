#!/usr/bin/env node
/**
 * Simulate Lumia reply (same RAG + LLM as Edge Function, no auth/events DB).
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
  let dot = 0, na = 0, nb = 0;
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

  const pack = JSON.parse(fs.readFileSync(RAG_FILE, 'utf8'));
  const queryEmb = await embed(apiKey, message);
  const hits = pack.chunks
    .map((c) => ({ ...c, score: cosine(queryEmb, c.embedding) }))
    .filter((c) => c.score >= 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const systemPrompt = `Tu es Lumia, assistante de Moments Locaux (France). Tutoiement, ton clair.
Tu réponds UNIQUEMENT à partir des extraits documentaires et/ou events fournis. N'invente rien.
Partenaire/Diffuseur/pro : distinguer Pass IRL vs Diffuseur orga ; si tarifs/contrat absents → hello@moments-locaux.com.
JSON STRICT: {"text":"...","event_ids":[]}`;

  const userPrompt = JSON.stringify({
    message,
    documentary_excerpts: formatRag(hits),
    events: [],
  });

  const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!chatRes.ok) throw new Error(await chatRes.text());
  const parsed = JSON.parse((await chatRes.json()).choices[0].message.content);

  console.log(JSON.stringify({
    question: message,
    text: parsed.text,
    event_ids: parsed.event_ids || [],
    sources: hits.map((h) => ({ id: h.id, score: Number(h.score.toFixed(3)) })),
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
