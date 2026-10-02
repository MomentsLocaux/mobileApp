const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/private/tmp/scrum-290-tools/node_modules/playwright-core');
(async () => {
  const server = http.createServer((req, res) => {
    const bundle = req.url === '/bundle.js';
    res.setHeader('Content-Type', bundle ? 'application/javascript' : 'text/html');
    fs.createReadStream(`/private/tmp/ui-categories-fixture/${bundle ? 'bundle.js' : 'index.html'}`).pipe(res);
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
    const first = page.getByRole('button', { name: 'Arts & Culture', exact: true });
    await first.click();
    // RN Web does not forward accessibilityState; native selected announcement needs device QA.
    assert.deepEqual(await page.evaluate(() => window.__selection.categories), ['category-0']);
    await page.getByRole('button', { name: 'Tout sélectionner', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__selection.categories.length), 10);
    await page.getByRole('button', { name: 'Tout désélectionner', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.__selection.categories), []);
    await page.getByRole('button', { name: '1 à 3 jours', exact: true }).click();
    await page.getByRole('button', { name: '15 jours et +', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.__selection.duration), ['exceptional', 'long']);
    await page.getByRole('button', { name: '1 à 3 jours', exact: true }).click();
    await page.getByRole('button', { name: '15 jours et +', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.__selection.duration), []);
    await first.click();
    for (const variant of ['feed', 'row', 'spotlight']) {
      const card = page.getByTestId(`map-event-${variant}-${variant}`);
      await card.getByRole('button', { name: 'Voir Marché des artisans', exact: true }).click();
    }
    assert.equal(await page.evaluate(() => window.__opened), 3, 'outline does not intercept photo taps');
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 900 });
      for (const button of await page.getByTestId('categories').getByRole('button').all()) {
        const box = await button.boundingBox();
        assert.ok(box.height >= 44 && box.x >= 15 && box.x + box.width <= width - 15, 'touch target inside screen');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(__dirname, `selectors-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 320, height: 900 });
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(el => {
        if (el.childNodes.length === 1 && el.firstChild.nodeType === Node.TEXT_NODE) {
          const computed = getComputedStyle(el);
          const fontSize = parseFloat(computed.fontSize);
          const lineHeight = parseFloat(computed.lineHeight);
          el.style.fontSize = `${fontSize * 2}px`;
          if (Number.isFinite(lineHeight)) el.style.lineHeight = `${lineHeight * 2}px`;
        }
      });
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(__dirname, 'selectors-320-large-text.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: category selection / all / clear; duration multi-selection / clear; 320/390/430px; large text; 44px touch targets.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
