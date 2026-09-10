/**
 * SEC-003 — refuse denylist secrets in the Expo public bundle.
 * Safe to import from app.config.ts (Node) and to run as `node scripts/check-client-secrets.mjs`.
 *
 * Never prints secret values.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN_KEY_RE = /(SERVICE|SECRET|PRIVATE|OPENAI|WEBHOOK|DOWNLOAD)/i;
const PUBLIC_PREFIXES = ['EXPO_PUBLIC_', 'NEXT_PUBLIC_', 'VITE_'];

const FORBIDDEN_SOURCE_RE =
  /\b(SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|SUBSCRIPTION_WEBHOOK_SECRET|MAPBOX_SECRET|RNMAPBOX_MAPS_DOWNLOAD_TOKEN|MAPBOX_DOWNLOADS_TOKEN)\b/;

function looksLikeOpenAiSecret(value) {
  return /^sk-[A-Za-z0-9_-]{10,}$/.test(value.trim());
}

function looksLikeMapboxSecret(value) {
  return /^sk\.[A-Za-z0-9._-]{10,}$/.test(value.trim());
}

function looksLikeServiceRoleJwt(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('eyJ')) return false;
  const payload = trimmed.split('.')[1];
  if (!payload) return false;
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8',
    );
    return /"role"\s*:\s*"service_role"/.test(json);
  } catch {
    return false;
  }
}

function isPublicEnvKey(key) {
  return PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function findPublicSecretProblems(env) {
  const problems = [];

  for (const [key, raw] of Object.entries(env)) {
    if (typeof raw !== 'string' || !raw) continue;
    if (!isPublicEnvKey(key)) continue;

    if (FORBIDDEN_KEY_RE.test(key)) {
      problems.push(`public env key name looks like a secret: ${key}`);
    }
    if (looksLikeOpenAiSecret(raw) || looksLikeMapboxSecret(raw) || looksLikeServiceRoleJwt(raw)) {
      problems.push(`public env value for ${key} matches a denylist secret shape`);
    }
  }

  return problems;
}

export function assertNoPublicSecrets(env = process.env) {
  const problems = findPublicSecretProblems(env);
  if (problems.length > 0) {
    throw new Error(`Refusing to build with public secrets:\n- ${problems.join('\n- ')}`);
  }
}

function walkSourceFiles(root, acc = []) {
  if (!fs.existsSync(root)) return acc;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, acc);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) continue;
    acc.push(full);
  }
  return acc;
}

function scanSourceTree(repoRoot) {
  const problems = [];
  const roots = ['app', 'src'].map((dir) => path.join(repoRoot, dir));
  const extraFiles = ['app.config.ts', 'eas.json'].map((file) => path.join(repoRoot, file));
  const files = [...roots.flatMap((dir) => walkSourceFiles(dir)), ...extraFiles.filter(fs.existsSync)];

  for (const file of files) {
    const rel = path.relative(repoRoot, file);
    const text = fs.readFileSync(file, 'utf8');
    if (rel === 'app.config.ts' && text.includes('assertNoPublicSecrets')) continue;
    if (FORBIDDEN_SOURCE_RE.test(text) && /(EXPO_PUBLIC_|extra\s*:)/.test(text)) {
      problems.push(`${rel} references a denylist secret next to public config`);
    }
  }
  return problems;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const problems = [...findPublicSecretProblems(process.env), ...scanSourceTree(repoRoot)];
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('SEC-003: no public denylist secrets detected.');
}
