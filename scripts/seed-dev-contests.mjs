/**
 * One-off DEV seed: 5 seasonal contests + cover uploads to contest-media.
 * Usage: node --env-file=.env scripts/seed-dev-contests.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!url.includes('prymkgkafaovhzopslea')) {
  console.error('Refusing to seed: expected DEV project prymkgkafaovhzopslea');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ASSETS =
  '/Users/rrauyer/.cursor/projects/Users-rrauyer-MomentsLocaux-Moderation-WebConsole/assets';

const RULES = (theme) => `## Règlement — ${theme}

1. **Participation** : une photo originale par compte, prise pour ce concours.
2. **Droit à l’image** : en participant, vous confirmez disposer des droits sur la photo et autorisez Moments Locaux à l’afficher dans l’app.
3. **Votes** : 1 vote par utilisateur jusqu’à la clôture des votes (modifiable).
4. **Podium** : le classement communautaire (votes) est indicatif ; le podium officiel est décidé par le jury.
5. **Modération** : toute participation hors thème, offensante ou non conforme peut être refusée.
6. **Géo** : la localisation éventuelle est affichée en zone floue uniquement (pas d’épingle précise).
`;

const contests = [
  {
    id: randomUUID(),
    slug: 'halloween-deco-2026',
    title: 'Halloween : la plus belle déco',
    theme: 'Halloween',
    coverFile: `${ASSETS}/contest-cover-halloween.png`,
    description:
      'Citrouilles, lumières et frissons : partagez la plus belle déco d’Halloween de votre quartier. Ambiance cosy ou terrifiante, à vous de jouer.',
    reward: '1er : panier gourmand + badge Halloween · 2e/3e : badges exclusifs + Lumo bonus',
    status: 'open',
    geo_grid_meters: 500,
    start_at: '2026-07-15T08:00:00.000Z',
    end_at: '2026-10-31T21:00:00.000Z',
    voting_ends_at: '2026-11-03T21:00:00.000Z',
  },
  {
    id: randomUUID(),
    slug: 'noel-balcons-lumineux-2026',
    title: 'Noël : balcons & vitrines lumineux',
    theme: 'Noël',
    coverFile: `${ASSETS}/contest-cover-noel.png`,
    description:
      'Guirlandes, sapins et magie hivernale : immortalisez votre plus belle déco de Noël vue de l’extérieur. Soft lights only — on veut du rêve, pas d’éblouissement.',
    reward: '1er : coffret chocolats artisanaux + badge Étoile · 2e/3e : stickers + Lumo',
    status: 'scheduled',
    geo_grid_meters: 400,
    start_at: '2026-11-20T08:00:00.000Z',
    end_at: '2026-12-26T21:00:00.000Z',
    voting_ends_at: '2026-12-30T21:00:00.000Z',
  },
  {
    id: randomUUID(),
    slug: 'ete-balcons-fleuris-2026',
    title: 'Été : balcons fleuris',
    theme: 'Été',
    coverFile: `${ASSETS}/contest-cover-ete.png`,
    description:
      'Géraniums, tomates cerises et oasis urbaines : montrez le balcon ou la terrasse la plus fleurie de votre ville. Couleurs saturées bienvenues.',
    reward: '1er : kit jardinage urbain + badge Botaniste · 2e/3e : Lumo + badge',
    status: 'open',
    geo_grid_meters: 500,
    start_at: '2026-06-01T08:00:00.000Z',
    end_at: '2026-08-31T21:00:00.000Z',
    voting_ends_at: '2026-09-07T21:00:00.000Z',
  },
  {
    id: randomUUID(),
    slug: 'paques-tables-printemps-2026',
    title: 'Pâques : tables & nids de printemps',
    theme: 'Pâques',
    coverFile: `${ASSETS}/contest-cover-paques.png`,
    description:
      'Pastels, fleurs et œufs décorés : capturez votre plus belle table ou composition printanière. Dedans ou dehors, tant que ça respire le renouveau.',
    reward: '1er : panier de saison + badge Printemps · 2e/3e : Lumo',
    status: 'voting_closed',
    geo_grid_meters: 600,
    start_at: '2026-03-15T08:00:00.000Z',
    end_at: '2026-04-12T21:00:00.000Z',
    voting_ends_at: '2026-04-20T21:00:00.000Z',
  },
  {
    id: randomUUID(),
    slug: 'fete-musique-scenes-locales-2026',
    title: 'Fête de la musique : scènes locales',
    theme: 'Autre',
    coverFile: `${ASSETS}/contest-cover-musique.png`,
    description:
      'Un accord, une rue, une ambiance : photographiez les plus beaux moments musicaux de votre commune. Instruments, scènes improvisées, public enchanté.',
    reward: '1er : places concert partenaire + badge Scène · 2e/3e : Lumo + badge',
    status: 'open',
    geo_grid_meters: 750,
    start_at: '2026-06-10T08:00:00.000Z',
    end_at: '2026-06-22T21:00:00.000Z',
    voting_ends_at: '2026-06-29T21:00:00.000Z',
  },
];

async function uploadCover(contestId, filePath) {
  const bytes = readFileSync(filePath);
  const path = `covers/${contestId}/cover.png`;
  const { error } = await supabase.storage.from('contest-media').upload(path, bytes, {
    contentType: 'image/png',
    upsert: true,
  });
  if (error) throw new Error(`Upload ${path}: ${error.message}`);
  const { data } = supabase.storage.from('contest-media').getPublicUrl(path);
  return data.publicUrl;
}

async function main() {
  const rows = [];

  for (const c of contests) {
    console.log(`→ ${c.slug}`);
    const cover_url = await uploadCover(c.id, c.coverFile);
    rows.push({
      id: c.id,
      title: c.title,
      description: c.description,
      theme: c.theme,
      slug: c.slug,
      cover_url,
      rules_md: RULES(c.theme),
      legal_version: 'v1',
      start_at: c.start_at,
      end_at: c.end_at,
      voting_ends_at: c.voting_ends_at,
      geo_grid_meters: c.geo_grid_meters,
      status: c.status,
      reward: c.reward,
      entry_fee: 0,
      reward_pool: 0,
      reward_lumo: 0,
    });
  }

  const { data, error } = await supabase.from('contests').upsert(rows, { onConflict: 'id' }).select('id, title, slug, status, cover_url');
  if (error) throw error;

  console.log('\nSeeded contests:');
  for (const row of data) {
    console.log(`- [${row.status}] ${row.title} (${row.slug})`);
    console.log(`  ${row.cover_url}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
