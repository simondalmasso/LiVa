import { test, expect, chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { FRONTEND_HTML } from '../src/frontend.js';
import worker from '../src/index.js';

let server, url;
const streams = [
  {source:'youtube',id:'yt_123456789AB',channel:'OLGA',title:'Programa en vivo',is_live:true,embed_url:'https://www.youtube.com/embed/123456789AB?autoplay=1&mute=1'},
  {source:'twitch',id:'tw_1',channel:'martinciriook',title:'Directo',is_live:true,embed_url:'https://player.twitch.tv/?channel=martinciriook&parent=liva.simondalmasso44.workers.dev&muted=true'},
  {source:'youtube',id:'yt_ZYX98765432',channel:'BLENDER',title:'BLENDER en vivo',is_live:true,embed_url:'https://www.youtube.com/embed/ZYX98765432?autoplay=1&mute=1'}
];

test.beforeAll(async () => {
  const home = await worker.fetch(new Request('https://liva.example/'), {}, {});
  const csp = home.headers.get('content-security-policy');
  server = createServer((req,res) => {
    res.setHeader('Content-Type', req.url.startsWith('/api/') ? 'application/json' : 'text/html; charset=utf-8');
    if(req.url === '/api/streams') return res.end(JSON.stringify({ok:true,streams,generated_at:Date.now()-45*60*1000}));
    if(req.url === '/api/pluto') return res.end(JSON.stringify({ok:true,channels:[{
      channel:'<img src=x onerror=alert(1)>',title:'Abrir oficialmente',
      external_url:'https://pluto.tv/'
    }]}));
    if(req.url === '/') { res.setHeader('Content-Security-Policy', csp); return res.end(FRONTEND_HTML); }
    res.statusCode=404;res.end('Not Found');
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  url='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async () => {await new Promise(resolve=>server.close(resolve));});

async function launch(width,height) {
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width,height}});
  let feedCalls=0;
  await page.route('**/*',route=>{
    if (route.request().url() === url + '/api/streams') feedCalls++;
    if(route.request().url().startsWith(url)) return route.continue();
    return route.abort();
  });
  await page.goto(url,{waitUntil:'domcontentloaded'});
  return {browser,page,getFeedCalls:()=>feedCalls};
}
test('mobile 390: active player is single, next Twitch uses legal fallback and Pluto label is escaped',async()=>{
  const {browser,page}=await launch(390,844);
  try {
    await expect(page.locator('#stream-channel')).toHaveText('OLGA');
    await page.screenshot({path:'test-results/liva-390.png'});
    const bounds = await page.locator('#stream-open').boundingBox();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    await expect(page.locator('#stream-open')).toHaveAttribute('href','https://www.youtube.com/watch?v=123456789AB');
    await expect(page.locator('iframe')).toHaveCount(1);
    await page.locator('#zap-down').click();
    await expect(page.locator('#stream-channel')).toHaveText('martinciriook');
    await expect(page.locator('#stream-open')).toHaveAttribute('href','https://www.twitch.tv/martinciriook');
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('.player-fallback a')).toHaveAttribute('href','https://www.twitch.tv/martinciriook');
    await page.locator('#zap-down').click();
    await expect(page.locator('#stream-channel')).toHaveText('BLENDER');
    await expect(page.locator('#stream-open')).toHaveAttribute('href','https://www.youtube.com/watch?v=ZYX98765432');
    await expect(page.locator('#stream-live-label')).toHaveText('EN VIVO');
    await page.locator('#tab-pluto').click();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#pluto-grid a')).toHaveCount(1);
    await expect(page.locator('#view-pluto a[href="https://www.youtube.com/@hacela.shorta"]')).toHaveCount(0);
    await expect(page.locator('#pluto-grid a')).toHaveAttribute('href','https://pluto.tv/');
    await expect(page.locator('#pluto-grid img')).toHaveCount(0);
    await expect(page.locator('#pluto-grid a')).toContainText('<img src=x onerror=alert(1)>');
    await page.locator('#tab-feed').click();
    await expect(page.locator('#stream-channel')).toHaveText('BLENDER');
    await expect(page.locator('#stream-open')).toHaveAttribute('href','https://www.youtube.com/watch?v=ZYX98765432');
    await expect(page.locator('iframe')).toHaveCount(1);
  } finally {await browser.close();}
});
test('desktop-ish 600: switching destroys previous player and Twitch respects min dimensions',async()=>{
  const {browser,page}=await launch(600,932);
  try {
    await expect(page.locator('iframe')).toHaveCount(1);
    await page.locator('#zap-down').click();
    await expect(page.locator('#stream-channel')).toHaveText('martinciriook');
    await expect(page.locator('#stream-open')).toHaveAttribute('href','https://www.twitch.tv/martinciriook');
    await expect(page.locator('iframe')).toHaveCount(1);
    expect(new URL(await page.locator('iframe').getAttribute('src')).searchParams.get('parent')).toBe('127.0.0.1');
    const box=await page.locator('iframe').boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(400);
    expect(box.height).toBeGreaterThanOrEqual(300);
    await page.locator('#zap-up').click();
    await expect(page.locator('#stream-channel')).toHaveText('OLGA');
    await page.screenshot({path:'test-results/liva-600.png'});
    const bounds = await page.locator('#stream-open').boundingBox();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(932);
    await expect(page.locator('#stream-open')).toHaveAttribute('href','https://www.youtube.com/watch?v=123456789AB');
    await expect(page.locator('iframe')).toHaveCount(1);
  } finally {await browser.close();}
});

test('YouTube direct playback is muted autoplay only when visible; stops in background and requires no new feed fetches on swipe',async()=>{
  const {browser,page,getFeedCalls}=await launch(390,844);
  try {
    await expect(page.locator('iframe')).toHaveCount(1);
    const initialSrc=await page.locator('iframe').getAttribute('src');
    const parsed=new URL(initialSrc);
    expect(parsed.hostname).toBe('www.youtube.com');
    expect(parsed.searchParams.get('autoplay')).toBe('1');
    expect(parsed.searchParams.get('mute')).toBe('1');
    expect(parsed.searchParams.get('playsinline')).toBe('1');
    expect(parsed.searchParams.get('controls')).toBe('1');
    await page.evaluate(()=>{
      Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.evaluate(()=>{
      Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('iframe')).toHaveCount(1);
    expect(getFeedCalls()).toBe(1);
    await page.locator('#zap-down').click();
    await expect(page.locator('#stream-channel')).toHaveText('martinciriook');
    await page.locator('#zap-down').click();
    await expect(page.locator('#stream-channel')).toHaveText('BLENDER');
    await page.locator('#zap-up').click();
    await expect(page.locator('#stream-channel')).toHaveText('martinciriook');
    await page.locator('#zap-up').click();
    await expect(page.locator('#stream-channel')).toHaveText('OLGA');
    expect(interceptedRequests).toBe(1);
  }finally{await browser.close();}
});

test('stale catalogue is labelled, and an empty catalogue shows a manual retry without ghost iframes', async()=>{
  const {browser,page}=await launch(390,844);
  try {
    await expect(page.locator('#catalogue-age')).toContainText('puede haber finalizado');
    await page.route('**/api/streams', route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({ok:true,generated_at:Date.now(),streams:[]})
    }));
    await page.reload();
    await expect(page.getByText('No se encontraron transmisiones verificadas ahora.')).toBeVisible();
    await expect(page.getByRole('button',{name:'Reintentar'})).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#stream-info')).toBeHidden();
  }finally{await browser.close();}
});
test('provider outage shows explicit retry and removes all player iframes',async()=>{
  const {browser,page}=await launch(390,844);
  try{
    await page.route('**/api/streams',route=>route.fulfill({
      status:503,contentType:'application/json',
      body:JSON.stringify({ok:false,error:'provider_unavailable'})
    }));
    await page.reload();
    await expect(page.getByText('Error al cargar el feed.')).toBeVisible();
    await expect(page.getByRole('button',{name:'Reintentar'})).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
  }finally{await browser.close();}
});

test('multiple rapid Retry clicks start only one HTTP feed request', async()=>{
  const {browser,page}=await launch(390,844);
  try {
    await page.route('**/api/streams', route=>route.fulfill({
      status:503,contentType:'application/json',
      body:JSON.stringify({ok:false,error:'unavailable'})
    }));
    await page.reload();
    await expect(page.getByRole('button',{name:'Reintentar'})).toBeVisible();
    let attempts=0;
    await page.unroute('**/api/streams');
    await page.route('**/api/streams',async route=>{
      attempts++;
      await new Promise(resolve=>setTimeout(resolve,300));
      await route.fulfill({
        status:503,contentType:'application/json',
        body:JSON.stringify({ok:false,error:'unavailable'})
      });
    });
    await page.getByRole('button',{name:'Reintentar'}).evaluate(btn=>{
      btn.click(); btn.click(); btn.click();
    });
    await expect.poll(()=>attempts).toBe(1);
    await page.waitForTimeout(400);
    expect(attempts).toBe(1);
  }finally{await browser.close();}
});

test('Shorta appears ONLY in the separate Grabados tab, manually opened with no embeds or extra API requests',async()=>{
  const {browser,page,getFeedCalls}=await launch(390,844);
  try {
    await expect(page.locator('#stream-channel')).toHaveText('OLGA');
    await expect(page.locator('#tab-grabados')).toBeVisible();
    await expect(page.locator('#view-pluto a[href*="shorta"]')).toHaveCount(0);
    await expect(page.locator('#view-feed')).not.toContainText('Shorta');
    const count=getFeedCalls();
    await page.locator('#tab-grabados').click();
    await expect(page.locator('#view-grabados')).toBeVisible();
    await expect(page.locator('#view-feed')).toBeHidden();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#shorta-manual-link')).toHaveAttribute('href','https://www.youtube.com/@hacela.shorta');
    await expect(page.locator('#shorta-manual-link')).toHaveAttribute('target','_blank');
    expect(getFeedCalls()).toBe(count);
    await page.locator('#tab-pluto').click();
    await expect(page.locator('#view-grabados')).toBeHidden();
    await expect(page.locator('#view-pluto')).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.locator('#tab-feed').click();
    await expect(page.locator('iframe')).toHaveCount(1);
    expect(getFeedCalls()).toBe(count);
  }finally{await browser.close();}
});

test('delayed catalogue request cannot autoplay underneath the manually selected Grabados category', async()=>{
  const {browser,page}=await launch(390,844);
  try{
    await page.route('**/api/streams',async route=>{
      await new Promise(resolve=>setTimeout(resolve,400));
      await route.fulfill({
        status:200,contentType:'application/json',
        body:JSON.stringify({ok:true,generated_at:Date.now(),streams})
      });
    });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#tab-grabados').click();
    await expect(page.locator('#view-grabados')).toBeVisible();
    await page.waitForTimeout(550);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#stream-info')).toBeHidden();
    await page.locator('#tab-feed').click();
    await expect(page.locator('iframe')).toHaveCount(1);
  }finally{await browser.close();}
});

test('an old cache containing recorded Shorta cannot insert it into the live feed',async()=>{
  const {browser,page}=await launch(390,844);
  try{
    await page.route('**/api/streams',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({ok:true,generated_at:Date.now(),streams:[
        {...streams[0]},
        {source:'shorta',id:'shorta_ABCDEFGHIJK',channel:'Shorta',title:'Grabado',is_live:false,embed_url:'https://www.youtube.com/embed/ABCDEFGHIJK'},
        {...streams[2]}
      ]})
    }));
    await page.reload();
    await expect(page.locator('#stream-channel')).toHaveText('OLGA');
    expect(await page.locator('.snap-item').count()).toBe(2);
    await page.locator('#zap-down').click();
    await expect(page.locator('#stream-channel')).toHaveText('BLENDER');
    await expect(page.locator('iframe')).toHaveCount(1);
    await expect(page.locator('#view-feed')).not.toContainText('Shorta');
  }finally{await browser.close();}
});

test('category buttons remain usable on narrow mobile viewport',async()=>{
  const {browser,page}=await launch(320,720);
  try{
    for(const tab of ['feed','pluto','grabados']){
      const el=page.locator('#tab-'+tab);
      const bounds=await el.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x+bounds.width).toBeLessThanOrEqual(320);
      await el.click();
      await expect(page.locator('#view-'+tab)).toBeVisible();
    }
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.locator('#tab-feed').click();
    await expect(page.locator('iframe')).toHaveCount(1);
  }finally{await browser.close();}
});

test('stream posters are browser-lazy images rather than eagerly loaded background images',async()=>{
  const {browser,page}=await launch(390,844);
  try{
    await page.route('**/api/streams',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({ok:true,generated_at:Date.now(),
        streams:streams.map((stream,i)=>({...stream,
          thumbnail:i===1?'https://static-cdn.jtvnw.net/previews-ttv/live_user-a-640x360.jpg':
            'https://i.ytimg.com/vi/AAA111AAA11/mqdefault.jpg'
        }))})
    }));
    await page.reload();
    await expect(page.locator('.snap-item')).toHaveCount(3);
    await expect(page.locator('.snap-item img.snap-poster')).toHaveCount(3);
    const properties=await page.locator('.snap-item img.snap-poster').evaluateAll(imgs=>
      imgs.map(img=>({loading:img.loading,decoding:img.decoding})));
    for(const item of properties){
      expect(item.loading).toBe('lazy');
      expect(item.decoding).toBe('async');
    }
    const backgrounds=await page.locator('.snap-item').evaluateAll(items=>
      items.map(el=>el.style.backgroundImage));
    expect(backgrounds.every(bg=>!bg)).toBe(true);
  }finally{await browser.close();}
});

test('catalogue refresh from a scrolled feed resets to the first visible live, with no hidden player',async()=>{
  const {browser,page}=await launch(390,844);
  try{
    await expect(page.locator('#stream-channel')).toHaveText('OLGA');
    await page.locator('#zap-down').click();
    await expect(page.locator('#stream-channel')).toHaveText('martinciriook');
    await page.evaluate(()=>{document.getElementById('view-feed').scrollTop=900;});
    await page.evaluate(()=>loadFeed());
    await expect(page.locator('#stream-channel')).toHaveText('OLGA');
    const scroll=await page.locator('#view-feed').evaluate(el=>el.scrollTop);
    expect(scroll).toBeLessThan(10);
    await expect(page.locator('iframe')).toHaveCount(1);
  }finally{await browser.close();}
});

test('portrait mobile embeds 16:9 at 390/430 without deforming, keeps 200px minimum frame height',async()=>{
  for (const [width,height] of [[390,844],[430,932]]) {
    const {browser,page}=await launch(width,height);
    try{
      await expect(page.locator('iframe')).toHaveCount(1);
      const bounds=await page.locator('iframe').boundingBox();
      expect(bounds.width).toBeLessThanOrEqual(width+1);
      expect(bounds.height).toBeGreaterThanOrEqual(200);
      expect(bounds.width/bounds.height).toBeGreaterThan(1.72);
      expect(bounds.width/bounds.height).toBeLessThan(1.84);
    }finally{await browser.close();}
  }
});
test('mobile portrait/theatre mode toggle never reloads existing YouTube iframe',async()=>{
  const {browser,page,getFeedCalls}=await launch(390,844);
  try{
    await expect(page.locator('iframe')).toHaveCount(1);
    await expect(page.locator('#view-mode')).toBeVisible();
    const beforeSrc=await page.locator('iframe').getAttribute('src');
    const iframeHandle=await page.locator('iframe').elementHandle();
    const calls=getFeedCalls();
    await page.locator('#view-mode').click();
    await expect(page.locator('#view-feed')).toHaveClass(/theatre-mode/);
    expect(await iframeHandle.evaluate(node=>node.isConnected)).toBe(true);
    expect(await page.locator('iframe').getAttribute('src')).toBe(beforeSrc);
    await page.locator('#view-mode').click();
    await expect(page.locator('#view-feed')).not.toHaveClass(/theatre-mode/);
    expect(getFeedCalls()).toBe(calls);
  }finally{await browser.close();}
});
test('all mobile controls stay within 320px and clear 44px minimum touch targets',async()=>{
  const {browser,page}=await launch(320,720);
  try{
    await expect(page.locator('#stream-channel')).toHaveText('OLGA');
    for (const selector of ['#tab-feed','#tab-pluto','#tab-grabados','#zap-up','#zap-down','#view-mode']) {
      const box=await page.locator(selector).boundingBox();
      expect(box).toBeTruthy();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(321);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const link=await page.locator('#stream-open').boundingBox();
    expect(link.y+link.height).toBeLessThanOrEqual(720);
  }finally{await browser.close();}
});

test('real mobile touch swipe outside the official iframe advances one live channel',async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  try{
    await page.route('**/*',route=>route.request().url().startsWith(url) ? route.continue() : route.abort());
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await expect(page.locator('#stream-channel')).toHaveText('OLGA');
    const session=await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:188,y:590}]});
    for(let y=540;y>=150;y-=40){
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:188,y}]});
      await new Promise(resolve=>setTimeout(resolve,12));
    }
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(page.locator('#stream-channel')).toHaveText('martinciriook',{timeout:4000});
    await expect(page.locator('iframe')).toHaveCount(0);
  }finally{await browser.close();}
});

test('compact 320x568 portrait keeps official iframe unobstructed by navigation and metadata',async()=>{
  const {browser,page}=await launch(320,568);
  try{
    await expect(page.locator('#stream-channel')).toHaveText('OLGA');
    const frame=await page.locator('iframe').boundingBox();
    const meta=await page.locator('#stream-info').boundingBox();
    const originalLink=await page.locator('#stream-open').boundingBox();
    expect(originalLink.height).toBeGreaterThanOrEqual(44);
    const controls=await page.locator('#zap-controls').boundingBox();
    const header=await page.locator('#top-nav').boundingBox();
    expect(frame).toBeTruthy();
    expect(frame.y).toBeGreaterThanOrEqual(header.y+header.height-1);
    expect(frame.y+frame.height).toBeLessThanOrEqual(meta.y+1);
    expect(frame.y+frame.height).toBeLessThanOrEqual(controls.y+1);
    expect(meta.y+meta.height).toBeLessThanOrEqual(controls.y+1);
    await expect(page.locator('iframe')).toHaveCount(1);
  }finally{await browser.close();}
});

test('568x320 landscape leaves the official player unobstructed by metadata or action controls',async()=>{
  const {browser,page}=await launch(568,320);
  try{
    await expect(page.locator('iframe')).toHaveCount(1);
    const frame=await page.locator('iframe').boundingBox();
    const info=await page.locator('#stream-info').boundingBox();
    const rail=await page.locator('#zap-controls').boundingBox();
    const header=await page.locator('#top-nav').boundingBox();
    const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*
      Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
    expect(frame.width).toBeGreaterThanOrEqual(200);
    expect(frame.height).toBeGreaterThanOrEqual(200);
    expect(overlap(frame,rail)).toBe(0);
    expect(overlap(frame,info)).toBe(0);
    expect(frame.y).toBeGreaterThanOrEqual(header.y+header.height-1);
  }finally{await browser.close();}
});

test('when no Argentine lives are verified, manual official publisher links replace blank feed without new requests',async()=>{
  const {browser,page}=await launch(390,844);
  let interceptedRequests=0;
  try{
    await page.route('**/api/streams',route=>{
      interceptedRequests++;
      return route.fulfill({
        status:200,contentType:'application/json',
        body:JSON.stringify({ok:true,generated_at:Date.now(),streams:[]})
      });
    });
    await page.reload();
    await expect(page.locator('#official-publishers a')).toHaveCount(5);
    await expect(page.locator('#official-publishers')).toContainText('OLGA');
    await expect(page.locator('#official-publishers')).toContainText('BLENDER');
    await expect(page.locator('#official-publishers')).toContainText('LUZU');
    await expect(page.locator('#official-publishers')).toContainText('TN');
    await expect(page.locator('#official-publishers')).toContainText('Crónica');
    await expect(page.locator('#official-publishers a').first()).toHaveAttribute('href',/youtube\.com\/\@/);
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(interceptedRequests).toBe(1);
  }finally{await browser.close();}
});
