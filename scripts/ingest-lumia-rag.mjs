#!/usr/bin/env node
/**
 * Ingest Lumia documentary base → embeddings for Edge Function RAG.
 *
 * Reads:  content/lumia/docs/*.md
 * Writes: supabase/functions/lumia-chat/rag-chunks.json
 *
 * Requires OPENAI_API_KEY in env or .env
 *
 * Usage: node scripts/ingest-lumia-rag.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'content/lumia/docs');
const OUT_FILE = path.join(ROOT, 'supabase/functions/lumia-chat/rag-chunks.json');
const MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const CHUNK_CHARS = 700;
const CHUNK_OVERLAP = 100;

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) {
    return { meta: {}, body: raw.trim() };
  }
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return { meta: {}, body: raw.trim() };
  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const meta = {};
  for (const line of fm.split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body };
}

function chunkText(text, size, overlap) {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (cleaned.length <= size) return [cleaned];
  const chunks = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + size, cleaned.length);
    if (end < cleaned.length) {
      const slice = cleaned.slice(start, end);
      const lastBreak = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' '));
      if (lastBreak > size * 0.4) end = start + lastBreak + 1;
    }
    const piece = cleaned.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

async function embedBatch(apiKey, inputs) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, input: inputs }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings ${res.status}: ${err.slice(0, 400)}`);
  }
  const json = await res.json();
  return json.data.sort((a, b) => a.index - b.index).map((row) => row.embedding);
}

async function main() {
  loadEnvFile();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY missing');
    process.exit(1);
  }

  const files = fs
    .readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  if (!files.length) {
    console.error('No markdown docs in', DOCS_DIR);
    process.exit(1);
  }

  /** @type {{ id: string, doc_id: string, title: string, category: string, content: string }[]} */
  const pending = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(DOCS_DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const docId = meta.id || file.replace(/\.md$/, '');
    const title = meta.title || docId;
    const category = meta.category || 'general';
    const parts = chunkText(body, CHUNK_CHARS, CHUNK_OVERLAP);
    parts.forEach((content, idx) => {
      pending.push({
        id: `${docId}#${idx}`,
        doc_id: docId,
        title,
        category,
        content: `# ${title}\n\n${content}`,
      });
    });
  }

  console.log(`Embedding ${pending.length} chunks with ${MODEL}…`);
  const embeddings = [];
  const BATCH = 32;
  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    const vectors = await embedBatch(
      apiKey,
      slice.map((c) => c.content),
    );
    embeddings.push(...vectors);
  }

  const payload = {
    version: 1,
    model: MODEL,
    generated_at: new Date().toISOString(),
    source_dir: 'content/lumia/docs',
    chunks: pending.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
    })),
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload));
  console.log(`Wrote ${payload.chunks.length} chunks → ${path.relative(ROOT, OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
