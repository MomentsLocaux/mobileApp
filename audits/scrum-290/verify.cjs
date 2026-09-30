const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/private/tmp/scrum-290-tools/node_modules/playwright-core');
(async () => {
  const server = http.createServer((req, res) => {
    const bundle = req.url === '/bundle.js';
    res.setHeader('Content-Type', bundle ? 'application/javascript' : 'text/html');
    fs.createReadStream(`/private/tmp/scrum-290-fixture/${bundle ? 'bundle.js' : 'index.html'}`).pipe(res);
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
    page.on('pageerror', error => errors.push(error.message));
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin);
    const ready = page.getByTestId('Recherche disponible');
    const action = ready.getByRole('button', { name: 'Rechercher dans cette zone', exact: true });
    await action.click();
    assert.equal(await page.evaluate(() => window.__areaReview.search), 1);
    // accessibilityHint is native-only in react-native-web; checked in native QA.
    const busy = page.getByTestId('Recherche en cours').getByRole('button', { name: 'Recherche en cours dans cette zone' });
    assert.equal(await busy.getAttribute('aria-disabled'), 'true');
    assert.equal(await busy.getByRole('progressbar').count(), 1);
    await busy.click({ force: true });
    const wide = page.getByTestId('Zone trop large');
    const disabled = wide.getByRole('button', { name: 'Rechercher dans cette zone', exact: true });
    assert.equal(await disabled.getAttribute('aria-disabled'), 'true');
    await disabled.click({ force: true });
    assert.equal(await page.evaluate(() => window.__areaReview.search), 1);
    await wide.getByRole('button', { name: /^Zone trop large/ }).click();
    assert.equal(await page.evaluate(() => window.__areaReview.tighten), 1);
    assert.equal(await page.getByTestId('Aucune action').getByRole('button', { name: /Rechercher/ }).count(), 0);
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 900 });
      const box = await action.boundingBox();
      assert.ok(box.height >= 44 && box.x >= 16 && box.x + box.width <= width - 15, 'touch target inside screen');
      const taps = await page.evaluate(() => window.__areaReview.map);
      await page.mouse.click(3, box.y + box.height / 2);
      assert.equal(await page.evaluate(() => window.__areaReview.map), taps + 1, 'outside capsule remains interactive');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(__dirname, `controls-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 320, height: 900 });
    // Web approximation of 200% text scaling; native Dynamic Type still needs device QA.
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(el => {
        if (el.childNodes.length === 1 && el.firstChild.nodeType === Node.TEXT_NODE) {
          el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * 2}px`;
        }
      });
    });
    const capsule = await disabled.boundingBox();
    const warning = await wide.getByRole('button', { name: /^Zone trop large/ }).boundingBox();
    assert.ok(warning.y >= capsule.y + capsule.height + 7, 'warning flows below scaled label');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(__dirname, 'controls-320-large-text.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: 320/390/430px, scaled text, touch targets, disabled/busy states, tighten action, map hit testing.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
