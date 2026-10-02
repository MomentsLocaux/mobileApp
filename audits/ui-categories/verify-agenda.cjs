const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/private/tmp/scrum-290-tools/node_modules/playwright-core');
(async () => {
  const server = http.createServer((req, res) => {
    const bundle = req.url === '/bundle.js';
    res.setHeader('Content-Type', bundle ? 'application/javascript' : 'text/html');
    fs.createReadStream(`/private/tmp/ui-agenda-fixture/${bundle ? 'bundle.js' : 'index.html'}`).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    console.log('Launching browser');
    browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, timeout: 20000, args: ['--disable-background-networking'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    console.log('Loading fixture');
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin);
    const open = () => page.getByRole('button', { name: 'Ouvrir filtres agenda', exact: true }).click();
    const save = () => page.getByRole('button', { name: 'Enregistrer les filtres', exact: true }).click();
    const close = () => page.getByRole('button', { name: 'Fermer', exact: true }).click();
    await open();
    assert.equal(await page.getByTestId('map-filters-temporal').count(), 0);
    await page.getByRole('button', { name: 'Arts & Culture', exact: true }).click();
    await page.getByRole('button', { name: '1 à 3 jours', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.__agendaFilters.categories), []);
    await close();
    await open();
    await save();
    assert.deepEqual(await page.evaluate(() => window.__agendaFilters.duration), []);
    await open();
    await page.getByRole('button', { name: 'Arts & Culture', exact: true }).click();
    await page.getByRole('button', { name: 'Théâtre', exact: true }).click();
    await page.getByRole('button', { name: '1 à 3 jours', exact: true }).click();
    await save();
    assert.deepEqual(await page.evaluate(() => window.__agendaFilters.categories), ['category-0']);
    assert.deepEqual(await page.evaluate(() => window.__agendaFilters.subcategories), ['theatre']);
    assert.deepEqual(await page.evaluate(() => window.__agendaFilters.duration), ['exceptional']);
    await open();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(__dirname, `agenda-filters-${width}.png`), fullPage: true });
    }
    await page.getByRole('button', { name: 'Arts & Culture', exact: true }).click();
    await save();
    assert.deepEqual(await page.evaluate(() => window.__agendaFilters.subcategories), []);
    await open();
    await page.getByRole('button', { name: 'Réinitialiser les filtres', exact: true }).click();
    await close();
    assert.deepEqual(await page.evaluate(() => window.__agendaFilters.duration), ['exceptional']);
    await open();
    await page.getByRole('button', { name: 'Réinitialiser les filtres', exact: true }).click();
    await save();
    assert.deepEqual(await page.evaluate(() => window.__agendaFilters.duration), []);
    await page.getByRole('button', { name: 'Ouvrir filtres carte', exact: true }).click();
    assert.equal(await page.getByTestId('map-filters-temporal').count(), 1, 'map retains its dates');
    assert.deepEqual(errors, []);
    console.log('PASS: agenda modal apply/cancel/reset, subcategory pruning, 320/390px, map temporal controls retained.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
