const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('/private/tmp/scrum-290-tools/node_modules/playwright-core');
(async()=>{
 const server=http.createServer((req,res)=>{const file=req.url.startsWith('/bundle.js')?'bundle.js':'index.html';res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');fs.createReadStream('/private/tmp/onboarding-001-review/'+file).pipe(res)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-background-networking','--disable-component-update']});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.route('**/*',route=>route.request().url().startsWith(origin)||route.request().url().startsWith('data:')?route.continue():route.abort());
  const button=name=>page.getByRole('button',{name,exact:true});
  const next=()=>button('Continuer').click();
  async function shot(name){await page.waitForTimeout(350);await page.screenshot({path:path.join(__dirname,name+'.png')})}
  async function frame(){
   const box=await page.getByTestId('onboarding-footer').boundingBox();
   const viewport=page.viewportSize();
   assert.ok(box.y>=0&&box.y+box.height<=viewport.height+1,'footer stays inside viewport');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
   const before=box.y;
   await page.getByTestId('onboarding-content').evaluate(el=>{el.scrollTop=el.scrollHeight});
   assert.equal((await page.getByTestId('onboarding-footer').boundingBox()).y,before,'footer does not scroll with content');
   await page.getByTestId('onboarding-content').evaluate(el=>{el.scrollTop=0});
  }
  await page.goto(origin);await button('Commencer').waitFor();await page.evaluate(()=>document.fonts.ready);
  await frame();await shot('01-welcome-390');
  await button('Commencer').click();
  const name=page.getByRole('textbox',{name:"Nom d'affichage"});
  assert.equal(await button('Continuer').getAttribute('aria-disabled'),'true');
  await name.fill('Camille');await shot('02-identity-390');await next();
  const location=page.getByRole('textbox',{name:'Rechercher une ville ou un quartier'});
  await frame();await shot('03-location-empty-390');await location.fill('zzz');await page.getByText('Aucun lieu trouvé. Essaie une autre orthographe.').waitFor();
  await location.fill('Nyons');await button('Choisir Nyons, Drôme, France').click();await shot('03-location-selected-390');
  await button('Modifier le lieu sélectionné').click();assert.equal(await location.inputValue(),'');
  await location.fill('Nyons');await button('Choisir Nyons, Drôme, France').click();await next();
  await page.getByText('On te prévient au bon moment').waitFor();await frame();await shot('04-permissions-390');
  await button('Ajuster les alertes').click();await button('50 km').click();await button('Une fois par jour').click();await button('Replier les réglages').click();
  await page.getByText('Autour de toi, à 50 km').waitFor();await next();
  await page.getByText('Qu’est-ce qui t’attire ?').waitFor();await frame();await shot('05-themes-390');
  const category=page.getByRole('checkbox',{name:/^Catégorie/}).first();await category.click();assert.equal(await category.isChecked(),true);
  await page.getByRole('button',{name:"Revenir à l'étape précédente",exact:true}).click();await page.getByText('Autour de toi, à 50 km').waitFor();await next();assert.equal(await category.isChecked(),true);
  await page.setViewportSize({width:320,height:568});await frame();await shot('05-themes-320');
  await button('Passer cette étape').click();await page.getByText('Choisis un portrait').waitFor();await frame();await shot('06-avatar-320');
  await page.setViewportSize({width:390,height:844});await shot('06-avatar-390');
  await page.getByTestId('onboarding-content').evaluate(el=>{el.scrollTop=el.scrollHeight});
  assert.equal(await button('Choisir une photo de profil').count(),1);
  await page.getByTestId('onboarding-content').evaluate(el=>{el.scrollTop=0});
  await button('Continuer sans portrait').click();
  await page.waitForFunction(()=>window.review.routes.includes('/(tabs)'));
  assert.equal(await page.evaluate(()=>window.review.profiles.at(-1).avatar_url),null);
  assert.equal(await page.evaluate(()=>window.review.profiles.at(-1).display_name),'Camille');
  assert.deepEqual(await page.evaluate(()=>window.review.preferences.at(-1).preferred_category_slugs),[]);
  assert.equal(await page.evaluate(()=>window.review.place.city),'Nyons');
  assert.equal(await page.evaluate(()=>window.review.preferences.find(p=>p.notify_radius_km).notify_radius_km),50);
  await page.goto(origin+'?replay=1');await button("Quitter l'onboarding").click();assert.deepEqual(await page.evaluate(()=>window.review.routes),['back']);
  assert.deepEqual(errors,[]);
  console.log('PASS: six screens, 320/390 widths, fixed footer, name validation, location empty/edit/select, adjustable permissions, selection retained on back, themes skip, final portrait skip saves and navigates, replay close. Native permissions and keyboard require device validation.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1});
