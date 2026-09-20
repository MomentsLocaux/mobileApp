// Run from the repository root. Tooling: esbuild + playwright-core (can live outside the repo).
// NODE_PATH=/private/tmp/avatar-builder-tools/node_modules node audits/map-category-markers/verify.cjs
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');
const { chromium } = require('playwright-core');
const esbuild = require('esbuild');
const root = process.cwd();
const out = path.join(root, 'audits/map-category-markers');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'map-markers-review-'));
const env = require('dotenv').parse(fs.readFileSync(path.join(root, '.env')));
const colors = { 'arts-culture':'#7c3aed', 'marches-artisanat':'#0ea5e9', 'fetes-animations':'#f97316', 'famille-enfants':'#16a34a', 'gastronomie-saveurs':'#facc15', 'nature-bienetre':'#22c55e', 'ateliers-apprentissage':'#6366f1', 'sport-loisirs':'#f43f5e', 'vie-locale':'#0ea5e9', 'insolite-ephemere':'#a855f7' };
const labels = ['Arts & Culture','Marchés & Artisanat','Fêtes & Animations','Famille & Enfants','Gastronomie & Saveurs','Nature & Bien-être','Ateliers & Apprentissage','Sport & Loisirs','Vie locale & Citoyenne','Insolite & Éphémère'];
const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/mapbox.css"><style>
@font-face{font-family:Jakarta;src:url('/font.ttf')}*{box-sizing:border-box}body{margin:0;background:#F4FBF6;color:#1A3329;font-family:Jakarta,Arial,sans-serif}header{height:112px;padding:18px 20px 12px}small{color:#5B7A6A;font-size:10px;letter-spacing:1px}h1{font-size:22px;margin:6px 0}header p{font-size:11px;margin:0;color:#5B7A6A}#map{height:calc(100dvh - 246px);min-height:350px}footer{height:134px;padding:10px 16px}#selection{font-size:11px;text-align:center;height:26px}.legend{display:flex;justify-content:space-around;gap:8px}.legend span{font-size:10px;text-align:center;display:flex;align-items:center;flex-direction:column}.legend img{width:48px;height:48px}.sprite{width:max-content;height:max-content}#sprites{background:transparent}.mapboxgl-ctrl-attrib{font-size:9px}
</style><body><div id="sprites"></div><main hidden><header><small>MOMENTS LOCAUX · COLLECTION PILOTE</small><h1>Des sorties qui se repèrent.</h1><p>Carte Mapbox réelle · événements de démonstration</p></header><div id="map"></div><footer><div id="selection">Touchez une silhouette pour la sélectionner</div><div class="legend">${Object.entries(colors).map(([slug,color])=>`<span><img src="/assets/${slug}@3x.png" alt="">${slug.split('-')[0]}<b style="color:${color}">${color.toUpperCase()}</b></span>`).join('')}</div></footer></main><script src="/mapbox.js"></script><script src="/bundle.js"></script></body></html>`;

(async () => {
  const assetReport=[];
  for(const slug of Object.keys(colors)) for(const density of [1,2,3]) {
    const file=path.join(root,`assets/map-markers/${slug}${density===1?'':`@${density}x`}.png`);
    const bytes=fs.readFileSync(file), png=PNG.sync.read(bytes);
    assert.equal(png.width,64*density);assert.equal(png.height,64*density);
    let transparent=0,solid=0;
    for(let i=3;i<png.data.length;i+=4){if(png.data[i]===0)transparent++;if(png.data[i]>240)solid++;}
    assert.ok(transparent>png.width*png.height*.25,`${slug}: actual alpha background`);
    assert.ok(solid>png.width*png.height*.08,`${slug}: opaque subject`);
    assetReport.push({file:path.basename(file),bytes:bytes.length,width:png.width,transparent,solid});
  }
  await esbuild.build({entryPoints:[path.join(out,'review.jsx')],outfile:path.join(tmp,'bundle.js'),absWorkingDir:root,bundle:true,platform:'browser',format:'iife',alias:{'react-native':'react-native-web','@':root+'/src'},nodePaths:[root+'/node_modules'],resolveExtensions:['.web.tsx','.web.ts','.web.jsx','.web.js','.tsx','.ts','.jsx','.js','.json'],loader:{'.png':'dataurl','.ttf':'dataurl'},define:{'process.env':'{}','process.env.NODE_ENV':'"development"','process.env.EXPO_OS':'"web"','global':'globalThis','__DEV__':'true'},logLevel:'silent'});
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost').pathname;
    if(url==='/'){res.setHeader('Content-Type','text/html');return res.end(html.replace('COLLECTION PILOTE','LES 10 CATÉGORIES').replace('</style>','.legend{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.legend img{width:32px;height:32px}.legend b{display:none}.legend span{font-size:9px}footer{height:180px}#map{height:calc(100dvh - 292px)}</style>'));}
    if(url==='/collection'){res.setHeader('Content-Type','text/html');return res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><style>@font-face{font-family:Jakarta;src:url('/font.ttf')}body{margin:0;padding:28px;background:#F4FBF6;font-family:Jakarta,Arial;color:#1A3329}h1{margin:0 0 8px;font-size:26px}p{font-size:12px;color:#5B7A6A;margin-bottom:22px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}.card{background:white;border:1px solid #D4EBD8;border-radius:18px;text-align:center;padding:14px 6px}.art{width:102px;height:102px}.label{font-size:11px;min-height:32px}code{font-size:11px;color:#5B7A6A}.actual{margin-top:10px;padding-top:8px;border-top:1px solid #E8F5E9;display:flex;align-items:center;justify-content:center;gap:6px}.actual img{width:48px;height:48px}.actual small{font-size:9px;color:#5B7A6A}</style><h1>Moments Locaux · Les 10 catégories</h1><p>Une silhouette par catégorie, sa couleur d’origine et un volume précalculé. Aucun pin autour de l’illustration.</p><div class="grid">${Object.entries(colors).map(([slug,color],i)=>`<div class="card"><img class="art" src="/assets/${slug}@3x.png"><div class="label">${labels[i]}</div><code>${color.toUpperCase()}</code><div class="actual"><img src="/assets/${slug}@3x.png"><small>taille carte<br>48 points</small></div></div>`).join('')}</div></html>`);}
    if(url==='/token'){res.setHeader('Cache-Control','no-store');return res.end(env.EXPO_PUBLIC_MAPBOX_TOKEN);}
    const files={'/bundle.js':[path.join(tmp,'bundle.js'),'application/javascript'],'/mapbox.js':[root+'/node_modules/mapbox-gl/dist/mapbox-gl.js','application/javascript'],'/mapbox.css':[root+'/node_modules/mapbox-gl/dist/mapbox-gl.css','text/css'],'/font.ttf':[root+'/node_modules/@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf','font/ttf']};
    let entry=files[url];
    if(/^\/assets\/[a-z-]+(?:@[23]x)?\.png$/.test(url))entry=[root+'/assets/map-markers/'+path.basename(url),'image/png'];
    if(/^\/sprites\/[a-z-]+\.png$/.test(url))entry=[tmp+'/'+path.basename(url),'image/png'];
    if(!entry||!fs.existsSync(entry[0])){res.statusCode=404;return res.end();}
    res.setHeader('Content-Type',entry[1]);fs.createReadStream(entry[0]).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-background-networking','--disable-component-update']});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    page.setDefaultTimeout(30000);
    const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
    await page.goto(origin);await page.locator('#cluster-insolite-ephemere').waitFor();
    assert.deepEqual(await page.evaluate(()=>window.markerReview.palette),colors);
    assert.deepEqual((await page.evaluate(()=>window.markerReview.categorySlugs)).sort(),Object.keys(colors).sort());
    console.log('Rendering production legacy/cluster sprites…');
    for(const element of await page.locator('.sprite').all())await element.screenshot({path:path.join(tmp,`${await element.getAttribute('id')}.png`),omitBackground:true});
    await page.evaluate(()=>{document.getElementById('sprites').hidden=true;document.querySelector('main').hidden=false;window.markerReview.start();});
    await page.waitForFunction(()=>window.markerReview.ready,{},{timeout:90000});
    assert.equal(await page.evaluate(()=>window.markerReview.features.length),10);
    console.log('Map ready; checking selection and touch area…');
    await page.screenshot({path:out+'/map-all-categories.png'});
    const point=await page.evaluate(()=>{const r=window.markerReview;const p=r.map.project(r.features[0].geometry.coordinates);return{x:p.x,y:p.y};});
    const mapBox=await page.locator('#map').boundingBox();
    await page.mouse.click(mapBox.x+point.x,mapBox.y+point.y);
    await page.waitForFunction(()=>window.markerReview.selectedId==='g1');
    await page.screenshot({path:out+'/map-selected.png'});
    await page.mouse.click(mapBox.x+point.x,mapBox.y+point.y);
    assert.equal(await page.evaluate(()=>window.markerReview.selectedId),'g1');
    const categoryPoints=await page.evaluate(()=>window.markerReview.features.map(f=>({id:f.properties.id,...window.markerReview.map.project(f.geometry.coordinates)})));
    for(const p of categoryPoints){await page.mouse.click(mapBox.x+p.x,mapBox.y+p.y);assert.equal(await page.evaluate(()=>window.markerReview.selectedId),p.id);}
    await page.evaluate(()=>window.markerReview.select(null));
    // Outside the visible cloche silhouette, still inside the source hitbox.
    await page.mouse.click(mapBox.x+point.x+24,mapBox.y+point.y);
    assert.equal(await page.evaluate(()=>window.markerReview.selectedId),'g1');
    await page.evaluate(()=>window.markerReview.reset());
    await page.evaluate(()=>window.markerReview.setBaseline(true));
    await page.screenshot({path:out+'/map-before.png'});
    await page.evaluate(()=>window.markerReview.setBaseline(false));
    const report={assets:assetReport,initialReadyMs:await page.evaluate(()=>window.markerReview.initialReadyMs),dense:[]};
    for(const baseline of [true,false,true,false]){
      console.log('Dense fixture:',baseline?'legacy':'pilot');
      await page.evaluate(()=>window.markerReview.dense());await page.evaluate(b=>window.markerReview.setBaseline(b),baseline);
      const counts=await page.evaluate(()=>({features:window.markerReview.features.length,layers:window.markerReview.map.getStyle().layers.filter(l=>l.id.startsWith('events-source')||l.id==='selected-event').length}));
      assert.equal(counts.features,1500);assert.equal(counts.layers,34);
      report.dense.push({baseline,...counts,...await page.evaluate(()=>window.markerReview.panZoom())});
    }
    await page.screenshot({path:out+'/map-dense-1500.png'});
    await page.evaluate(()=>window.markerReview.changeZone());
    assert.equal(await page.evaluate(()=>window.markerReview.features.length),10);
    await page.evaluate(()=>window.markerReview.fallback());
    assert.equal(await page.evaluate(()=>window.markerReview.selectedId),'unknown');
    await page.evaluate(()=>window.markerReview.regroup());
    await page.screenshot({path:out+'/map-cluster.png'});
    const cluster=await page.evaluate(()=>{const f=window.markerReview.map.queryRenderedFeatures({layers:['events-source-category-marker-gastronomie-saveurs-clusters']})[0];return {properties:f.properties,coordinates:f.geometry.coordinates};});
    assert.equal(cluster.properties.point_count,36);
    const oldZoom=await page.evaluate(()=>window.markerReview.map.getZoom());
    const cp=await page.evaluate(c=>window.markerReview.map.project(c),cluster.coordinates);
    await page.mouse.click(mapBox.x+cp.x,mapBox.y+cp.y);
    await page.waitForFunction(z=>window.markerReview.map.getZoom()>z+0.2,oldZoom);
    assert.deepEqual(pageErrors,[]);assert.deepEqual(await page.evaluate(()=>window.markerReview.errors),[]);
    const gallery=await browser.newPage({viewport:{width:860,height:630},deviceScaleFactor:2});
    await gallery.goto(origin+'/collection');await gallery.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));await gallery.screenshot({path:out+'/collection.png',fullPage:true});await gallery.close();
    const satellite=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});satellite.setDefaultTimeout(30000);
    satellite.on('pageerror',e=>pageErrors.push(e.message));
    await satellite.goto(origin+'/?satellite=1');await satellite.waitForFunction(()=>window.markerReview);
    await satellite.evaluate(()=>{document.getElementById('sprites').hidden=true;document.querySelector('main').hidden=false;window.markerReview.start();});
    await satellite.waitForFunction(()=>window.markerReview.ready,{},{timeout:90000});
    await satellite.screenshot({path:out+'/map-satellite.png'});
    assert.deepEqual(await satellite.evaluate(()=>window.markerReview.errors),[]);assert.deepEqual(pageErrors,[]);await satellite.close();
    report.checks=['30 PNG alpha + density sizes','exhaustive 10-category palette registry','10-event map rendering','tap on each of 10 categories + selected tap','48px source hitbox','stable 34 layers / 1500 events','zone update','unknown category fallback + selection','36-point cluster count + expansion','satellite map rendering','no browser runtime / Mapbox errors'];
    report.environment='Mapbox GL JS 2.15.0 / headless Chrome / 390x844 @3x. Review fixture; not a native iOS/Android performance certification.';
    fs.writeFileSync(out+'/verification.json',JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
