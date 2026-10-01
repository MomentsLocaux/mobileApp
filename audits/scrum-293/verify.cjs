const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/private/tmp/scrum-290-tools/node_modules/playwright-core');
(async () => {
  const server = http.createServer((req, res) => {
    const bundle = req.url === '/bundle.js';
    res.setHeader('Content-Type', bundle ? 'application/javascript' : 'text/html');
    fs.createReadStream(`/private/tmp/scrum-293-fixture/${bundle ? 'bundle.js' : 'index.html'}`).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, timeout: 20000 });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin);
    const client = await page.context().newCDPSession(page);
    async function drag(x, y, dx, dy) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 12; i++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 12, y: y + dy * i / 12 }] });
        await page.waitForTimeout(20);
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(500);
    }
    async function reveal(id) {
      const box = await page.getByTestId(`row-${id}`).boundingBox();
      await drag(box.x + box.width - 30, box.y + 30, -140, 0);
    }
    const remove = id => page.getByRole('button', { name: `Retirer Moment ${id + 1} des favoris`, exact: true });
    await page.getByRole('button', { name: 'Ouvrir Moment 1', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__swipeReview.opened), 1);
    assert.equal(await remove(0).count(), 0, 'hidden action absent from accessibility tree');
    // A vertical drag starting on a row must scroll, not open or activate its actions.
    await drag(220, 400, 3, -170);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('*')].some(el => el.scrollTop > 50)), 'vertical scroll survives');
    assert.equal(await remove(0).count(), 0);
    await page.evaluate(() => document.querySelectorAll('*').forEach(el => { if (el.scrollTop) el.scrollTop = 0; }));
    await page.waitForTimeout(300);
    await reveal(0);
    await remove(0).waitFor();
    assert.equal(await page.evaluate(() => window.__swipeReview.calls), 0, 'swipe alone never removes');
    assert.equal(await page.evaluate(() => window.__swipeReview.opened), 1, 'swipe never opens details');
    await reveal(1);
    await remove(1).waitFor();
    assert.equal(await remove(0).count(), 0, 'only one row open');
    await page.getByRole('button', { name: 'Changer de jour' }).click();
    assert.equal(await remove(1).count(), 0, 'context change closes row');
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(300);
      await reveal(0);
      const box = await remove(0).boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44 && box.x + box.width <= width);
      assert.ok(await remove(0).evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + 4, r.y + r.height / 2)); }), 'whole action revealed, not covered by row');
      await page.screenshot({ path: path.join(__dirname, `swipe-${width}.png`) });
      await page.getByRole('button', { name: 'Changer de jour' }).click();
    }
    await reveal(0);
    await remove(0).click();
    assert.equal(await remove(0).getAttribute('aria-disabled'), 'true');
    await remove(0).click({ force: true });
    assert.equal(await page.evaluate(() => window.__swipeReview.calls), 1);
    await page.screenshot({ path: path.join(__dirname, 'swipe-pending.png') });
    await page.evaluate(() => window.__swipeReview.finish(true));
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByTestId('row-0').count(), 1, 'failed removal keeps row');
    await remove(0).click();
    assert.equal(await page.evaluate(() => window.__swipeReview.calls), 2, 'retry possible');
    await page.evaluate(() => window.__swipeReview.finish(false));
    await page.getByTestId('row-0').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Retirer avec le cœur 2' }).click();
    assert.equal(await page.evaluate(() => window.__swipeReview.calls), 3, 'equivalent action without swiping');
    assert.deepEqual(errors, []);
    console.log('PASS: real touch gestures, vertical scroll, reveal only, one row, context close, navigation, disabled pending, retry and heart alternative.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
