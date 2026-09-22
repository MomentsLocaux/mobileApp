const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/private/tmp/avatar-builder-tools/node_modules/playwright-core');
const fixture = '/private/tmp/ui-relief-components';
async function checkRowGeometry(page) {
 const rows = page.locator('[data-testid^="map-event-row-"]');
 for (let i = 0; i < Math.min(await rows.count(), 6); i++) {
  const row = rows.nth(i);
  const image = await row.getByRole('button', { name: /^Voir / }).boundingBox();
  const body = await row.getByTestId('event-card-body').boundingBox();
  assert.ok(Math.abs(image.width - image.height) < 1, 'square cover');
  assert.ok(Math.abs(body.y - image.y) < 1 && Math.abs(body.height - image.height) < 1, 'body matches cover height');
  for (const element of [row.getByRole('button', { name: /^Détails/ }), row.getByTestId('event-card-social'), row.getByTestId('event-card-actions')]) {
   const box = await element.boundingBox();
   assert.ok(box.y >= image.y - 1 && box.y + box.height <= image.y + image.height + 1, 'content within cover height');
   assert.ok(box.x + box.width <= body.x + body.width + 1, 'content within row width');
  }
  const share = await row.getByRole('button', { name: /^Partager / }).boundingBox();
  assert.ok(share.x + share.width <= body.x + body.width + 1, 'share stays within row');
  assert.equal(await row.getByRole('img', { name: /Arts|Nature|Gastronomie/ }).count(), 1, 'category icon is labelled');
 }
}
(async () => {
 const server = http.createServer((req, res) => {
  const bundle = req.url === '/bundle.js';
  res.setHeader('Content-Type', bundle ? 'application/javascript' : 'text/html');
  fs.createReadStream(path.join(fixture, bundle ? 'bundle.js' : 'index.html')).pipe(res);
 });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 let browser;
 try {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--disable-background-networking','--disable-component-update'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.route('**/*', route => route.request().url().startsWith(origin) || route.request().url().startsWith('data:') ? route.continue() : route.abort());
  await page.goto(origin);
  await page.getByText('Les moments à découvrir', { exact: true }).waitFor();
  await page.waitForTimeout(700);
  assert.deepEqual(await page.evaluate(() => window.__uiReview.colors), ['#8B5CF6','#22C55E','#F97316']);
  // Home card chrome: mint wash + 1px grey ring around the whole event.
  assert.ok(await page.locator('[data-testid^="map-event-row-"]').first().evaluate((el) => {
    const style = getComputedStyle(el);
    return style.backgroundColor === 'rgb(232, 245, 233)' && style.borderTopColor === 'rgb(213, 230, 218)' && style.borderTopWidth === '1px';
  }));
  await page.evaluate(() => document.fonts.ready);
  const spotlight = page.getByTestId('map-event-spotlight-event-0');
  const spotlightImage = await spotlight.getByRole('button', { name: 'Voir Les soirées du jardin partagé', exact: true }).boundingBox();
  const spotlightTitle = await spotlight.getByRole('button', { name: 'Détails : Les soirées du jardin partagé', exact: true }).boundingBox();
  assert.ok(Math.abs(spotlightImage.height - spotlightImage.width) < 1);
  assert.ok(spotlightTitle.y >= spotlightImage.y + spotlightImage.height);
  await page.screenshot({ path: path.join(__dirname, 'components-sheet-390.png') });
  const like = page.getByRole('button', { name: 'Aimer Les soirées du jardin partagé, 24 j’aime', exact: true });
  await like.first().click();
  await page.waitForFunction(() => window.__uiReview.likes.includes('event-0'));
  assert.equal(await page.evaluate(() => window.__uiReview.calls), 1);
  await page.getByRole('button', { name: 'Voir tous les événements', exact: true }).click();
  await page.getByRole('button', { name: 'Ne plus aimer Les soirées du jardin partagé, 25 j’aime', exact: true }).last().click();
  await page.waitForFunction(() => !window.__uiReview.likes.includes('event-0'));
  await page.evaluate(() => window.__uiReview.setFail(true));
  await like.last().click(); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__uiReview.likes.length), 0);
  assert.ok(await like.last().count());
  await page.evaluate(() => window.__uiReview.setFail(false));
  await page.getByRole('button', { name: 'Nouveautés', exact: true }).click();
  await page.waitForFunction(() => window.__uiReview.sortBy === 'created');
  await page.getByRole('button', { name: 'Voir tous les événements', exact: true }).click();
  await page.getByRole('button', { name: 'Les + proches', exact: true }).click();
  await page.waitForFunction(() => window.__uiReview.sortBy === 'distance');
  await page.evaluate(() => window.__uiReview.sort('date'));
  await page.getByRole('button', { name: 'Voir tous les événements', exact: true }).click();
  await page.getByText('Samedi 26 septembre 2026', { exact: true }).waitFor();
  await checkRowGeometry(page);
  await page.screenshot({ path: path.join(__dirname, 'components-list-390.png') });
  await page.evaluate(() => window.__uiReview.sort('triage'));
  assert.equal(await page.getByRole('button', { name: 'Inviter un ami', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Revenir à la carte', exact: true }).click();
  await page.waitForFunction(() => window.__uiReview.snap === 0);
  await page.getByRole('button', { name: 'Afficher les événements', exact: true }).click();
  await page.waitForFunction(() => window.__uiReview.snap === 1);
  await page.evaluate(() => window.__uiReview.sort('created', 'asc'));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__uiReview.select('event-100'));
  try { await page.getByRole('button', { name: 'Détails : Moment du quartier 101', exact: true }).click({ timeout: 15000 }); }
  catch (error) {
    await page.screenshot({ path: path.join(__dirname, 'components-scroll-failure.png') });
    console.log(await page.evaluate(() => ({ state: window.__uiReview, rows: [...document.querySelectorAll('[aria-label^="Détails"]')].map(e => e.getAttribute('aria-label')), scrolls: [...document.querySelectorAll('*')].filter(e => e.scrollTop > 0).map(e => ({top:e.scrollTop,height:e.scrollHeight,client:e.clientHeight})) })));
    throw error;
  }
  assert.equal(await page.evaluate(() => window.__uiReview.notice), 'detail:event-100');
  await page.evaluate(() => window.__uiReview.home());
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole('button', { name: 'Voir tous les événements', exact: true }).click();
  const row = page.getByTestId('map-event-row-event-0');
  const rowImage = await row.getByRole('button', { name: 'Voir Les soirées du jardin partagé', exact: true }).boundingBox();
  const rowTitle = await row.getByRole('button', { name: 'Détails : Les soirées du jardin partagé', exact: true }).boundingBox();
  assert.equal(Math.round(rowImage.width), 124);
  assert.equal(Math.round(rowImage.height), 124);
  assert.ok(rowTitle.x >= rowImage.x + rowImage.width);
  assert.ok(rowTitle.y < rowImage.y + 10);
  await page.evaluate(() => window.__uiReview.sort('date'));
  await page.getByRole('button', { name: 'Voir tous les événements', exact: true }).click();
  await page.getByRole('button', { name: 'Aimer Moment du quartier 3, 12345 j’aime', exact: true }).waitFor();
  await checkRowGeometry(page);
  await page.screenshot({ path: path.join(__dirname, 'components-list-320.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: 'Fiche et icônes', exact: true }).click();
  await page.getByRole('button', { name: 'Afficher le détail des horaires', exact: true }).click();
  await page.getByRole('button', { name: 'Masquer le détail des horaires', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Aimer et enregistrer', exact: true }).click();
  await page.getByRole('button', { name: 'Retirer des favoris', exact: true }).waitFor();
  await page.screenshot({ path: path.join(__dirname, 'components-detail-320.png') });
  // Keep the user's HTML proposal aligned with the production layout.
  await page.unroute('**/*');
  await page.route('**/*', route => /^(file:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
  for (const width of [390, 320]) {
   await page.setViewportSize({ width, height: 1000 });
   await page.goto('file://' + path.join(__dirname, 'bottom-sheet-proposal.html'));
   await page.evaluate(() => document.fonts.ready);
   await page.getByRole('button', { name: 'Voir tout', exact: true }).click();
   const boxes = await page.locator('.event-row').evaluateAll(rows => rows.map(row => {
    const image = row.querySelector('.thumb').getBoundingClientRect();
    const content = row.querySelector('.row-content').getBoundingClientRect();
    const actions = row.querySelector('.social-actions').getBoundingClientRect();
    const share = row.querySelector('[data-share]').getBoundingClientRect();
    return { square: Math.abs(image.width-image.height)<1, aligned: Math.abs(image.top-content.top)<1 && Math.abs(image.bottom-content.bottom)<1, contained: actions.top>=image.top && actions.bottom<=image.bottom+1 && share.right<=content.right+1 };
   }));
   assert.ok(boxes.every(box => box.square && box.aligned && box.contained), JSON.stringify({ width, boxes }));
   await page.locator('[data-like="concert"]').last().click();
   assert.equal(await page.locator('[data-like="concert"][aria-pressed="true"]').count(), 2);
   await page.locator('[data-share="concert"]').last().click();
   await page.getByRole('heading', { name: 'Partager ce moment' }).waitFor();
   await page.getByRole('button', { name: 'Fermer', exact: true }).click();
   await page.screenshot({ path: path.join(__dirname, `bottom-sheet-list-${width}.png`) });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: actual components, home card chrome, synced like/unlike, failed like, 3 sorts/date headers, no invitation, image geometry, peek/full, event 101 scrolling, small viewport, detail toggles/heart, reduced motion; no network/user data.');
 } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
