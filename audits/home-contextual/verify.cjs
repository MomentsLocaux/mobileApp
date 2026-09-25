const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/private/tmp/avatar-builder-tools/node_modules/playwright-core');
(async()=>{
 const server=http.createServer((req,res)=>{const bundle=req.url==='/bundle.js';res.setHeader('Content-Type',bundle?'application/javascript':'text/html');fs.createReadStream(path.join('/private/tmp/home-contextual-review',bundle?'bundle.js':'index.html')).pipe(res)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try {
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox','--disable-background-networking','--disable-component-update']});
  const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Europe/Paris',reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  const origin=`http://127.0.0.1:${server.address().port}`;
  await page.clock.setFixedTime(new Date('2026-09-25T15:30:00Z'));
  await page.route('**/*',r=>r.request().url().startsWith(origin)||r.request().url().startsWith('data:')?r.continue():r.abort());
  await page.goto(origin);
  await page.getByText('Concert au bord de l’eau',{exact:true}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(__dirname,'home-390.png')});
  const cards=page.locator('[data-testid^="home-event-"]');
  assert.equal(await cards.count(),3);
  assert.equal(await page.evaluate(()=>window.review.requests.length),1);
  await page.getByRole('radio',{name:'Demain',exact:true}).click();
  await page.waitForFunction(()=>window.review.feed.slot==='tomorrow');
  assert.equal(await cards.count(),1); // Saved next moment is not duplicated.
  await page.getByRole('radio',{name:'Ce soir',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.review.requests.length),1,'segments are local');
  await page.getByRole('button',{name:'Voir les 3 moments sur la carte',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>({when:window.review.stores.filters.getState().when,status:window.review.stores.filters.getState().status,focus:window.review.stores.transfer.getState().homeTransfer.focus})),{when:{preset:'tonight',includePast:false},status:'all',focus:{latitude:49.36,longitude:6.16,radiusKm:20}});
  await page.getByRole('button',{name:'Ouvrir l’agenda à la date de ce moment'}).click();
  assert.equal(await page.evaluate(()=>window.review.routes.at(-1).params.day),'2026-09-26');
  await page.getByRole('button',{name:'Rechercher un moment ou un lieu sur la carte'}).click();
  assert.equal(await page.evaluate(()=>window.review.stores.transfer.getState().homeTransfer.openSearch),true);
  await page.evaluate(()=>{const e=window.review.feed.rankedEvents[0];window.review.feed.toggleHeart(e);window.review.feed.toggleHeart(e)});
  await page.waitForFunction(()=>window.review.feed.pendingHearts.size===0);
  assert.equal(await page.evaluate(()=>window.review.likes),1,'concurrent like is ignored');
  const before=await page.evaluate(()=>window.review.requests.length);
  await page.evaluate(()=>{window.review.failLike=true;const e=window.review.feed.rankedEvents[0];window.review.failedId=e.id;window.review.feed.toggleHeart(e)});
  await page.waitForFunction(()=>window.review.alert);
  assert.equal(await page.evaluate(()=>window.review.feed.isHearted(window.review.failedId)),false);
  assert.equal(await page.evaluate(()=>window.review.requests.length),before,'likes do not refetch the pool');
  await page.evaluate(()=>window.review.update({profile:null}));
  await page.waitForFunction(()=>window.review.feed.nextEvent===null&&window.review.feed.socialSignal===null);
  await page.evaluate(()=>window.review.feed.toggleHeart(window.review.feed.rankedEvents[0]));
  await page.getByText('Connecte-toi pour enregistrer un moment',{exact:true}).waitFor();
  await page.goto(origin+'?scenario=cache');
  await page.waitForFunction(()=>window.review.feed?.rankedEvents.length>0);
  assert.equal(await page.evaluate(()=>window.review.feed.poolLoading),true,'snapshot appears before response');
  assert.equal(await page.getByRole('progressbar').count(),0,'no mask on cached cards');
  await page.waitForFunction(()=>!window.review.feed.poolLoading);
  await page.evaluate(()=>{window.review.fail=true;window.review.feed.retry()});
  await page.waitForFunction(()=>window.review.feed.poolError!==null);
  assert.equal(await cards.count(),3,'offline refresh keeps cached content');
  await page.screenshot({path:path.join(__dirname,'home-cache-offline.png')});
  // Start a slow request for A, then move to B. A must not overwrite B's results or snapshot.
  await page.evaluate(()=>{window.review.fail=false;window.review.delay=700;window.review.feed.retry()});
  await page.evaluate(()=>{window.review.events=[{...window.review.events[1],id:'zone-b',latitude:48.85,longitude:2.35,city:'Paris'}];window.review.delay=20;window.review.stores.filters.getState().setPlace({center:{latitude:48.85,longitude:2.35},radiusKm:20,label:'Paris'})});
  await page.waitForFunction(()=>window.review.feed.poolEvents[0]?.id==='zone-b');
  await page.waitForTimeout(800);
  assert.deepEqual(await page.evaluate(()=>window.review.stores.snapshots.getState().home.eventIds),['zone-b']);
  for (const scenario of ['guest','empty','offline','no-location','images']) {
    await page.goto(origin+'?scenario='+scenario);
    await page.waitForFunction(()=>window.review.feed&&!window.review.feed.poolLoading);
    if(scenario==='guest') {
      assert.equal(await page.getByText('Ton prochain moment',{exact:true}).count(),0);
      assert.equal(await page.getByText('Connecte-toi pour enregistrer un moment',{exact:true}).count(),0);
    }
    if(scenario==='empty')await page.getByText('Rien de prévu autour de toi ce soir',{exact:true}).waitFor();
    if(scenario==='offline')await page.getByRole('button',{name:'Réessayer',exact:true}).waitFor();
    if(scenario==='no-location')await page.getByRole('button',{name:'Rechercher un lieu',exact:true}).waitFor();
    if(scenario==='images'){await page.waitForTimeout(250);assert.equal(await cards.count(),3);assert.equal(await page.getByTestId('home-event-market').locator('[style*="broken.jpg"]').count(),0)}
    await page.screenshot({path:path.join(__dirname,`home-${scenario}.png`)});
  }
  await page.goto(origin);
  await page.getByText('Concert au bord de l’eau',{exact:true}).waitFor();
  for(const width of [320,390,430]){
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const geometry=await page.evaluate(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.scrollHeight>e.clientHeight+20&&getComputedStyle(e).overflowY==='auto');return el?{height:el.scrollHeight,visible:el.clientHeight}:null});
    assert.ok(geometry&&geometry.height<geometry.visible*2,`short home at ${width}: ${JSON.stringify(geometry)}`);
    await page.screenshot({path:path.join(__dirname,`home-${width}.png`)});
    await page.evaluate(()=>{for(const el of document.querySelectorAll('*'))if(getComputedStyle(el).overflowY==='auto')el.scrollTop=el.scrollHeight});
    await page.screenshot({path:path.join(__dirname,`home-${width}-bottom.png`)});
    await page.evaluate(()=>{for(const el of document.querySelectorAll('*'))if(getComputedStyle(el).overflowY==='auto')el.scrollTop=0});
  }
  fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({date:'2026-09-25',runtime:'Chrome / React Native Web — real HomeScreen, useHomeFeed, stores, glyphs; synthetic services; static tab chrome',widths:[320,390,430],checks:['3 cards maximum','local segment changes','evening map transfer','agenda date transfer','map search launcher','duplicate like guard','failed like','guest private data hidden','snapshot before response','offline cache preserved','late zone response ignored','empty/offline/no-location','valid and broken cover','no horizontal page overflow','less than 2 screen heights'],pageErrors:errors},null,2)+'\n');
  assert.deepEqual(errors,[]);
 } finally {await browser?.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
