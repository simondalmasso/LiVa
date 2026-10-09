import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

// Provider calls must occur only when the shared per-POP catalogue is stale.
// No KV bindings, Cron scheduler or per-swipe refresh are used.
test('zero KV: 30 visitors share one edge cache refresh, no per-visit provider fetch', async (t) => {
  const originalFetch = globalThis.fetch, originalCaches = globalThis.caches;
  t.after(() => { globalThis.fetch = originalFetch; globalThis.caches = originalCaches; });
  const storage = new Map(), pending=[];
  let ytSearch = 0, ytDetails = 0, shortaLookups = 0;
  globalThis.caches = {default: {
    match:async req=>storage.get(req.url || String(req))?.clone() ?? null,
    put:async(req,res)=>{storage.set(req.url || String(req),res.clone());},
  }};
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/search')) {
      ytSearch++;
      return Response.json({items:[{id:{videoId:'AAA111AAA11'}}]});
    }
    if (url.pathname.endsWith('/videos')) {
      ytDetails++;
      return Response.json({items:[{id:'AAA111AAA11',
        status:{embeddable:true,privacyStatus:'public'},
        snippet:{channelId:'UC7mJ2EDXFomeDIRFu5FtEbA',title:'OLGA LIVE',channelTitle:'OLGA',liveBroadcastContent:'live'},
        liveStreamingDetails:{actualStartTime:'2026-10-09T12:00:00Z',concurrentViewers:'1700'}}]});
    }
    if (url.pathname.endsWith('/channels') || url.pathname.endsWith('/playlistItems')) {shortaLookups++;return Response.json({items:[]});}
    throw Error('Unexpected source: '+url);
  };
  const env = {YOUTUBE_API_KEY:'TEST', get CATALOG_KV(){throw Error('KV must never be used');}};
  const ctx = {waitUntil: p=>pending.push(p)};
  for (let i=0;i<30;i++) {
    const cf = {country:'AR',city:i%2?'Rosario':'Santa Fe',regionCode:'S'};
    const req = Object.assign(new Request('https://liva.example/api/streams'),{cf});
    const res = await worker.fetch(req,env,ctx);
    assert.equal(res.status,200);
    const result = await res.json();
    assert.equal(Object.hasOwn(result,'geo'),false);
    assert.equal(result.streams[0].channel,'OLGA');
    assert.equal(result.streams.every(s=>s.is_live===true),true);
  }
  await Promise.all(pending);
  assert.equal(ytSearch,1);
  assert.equal(ytDetails,1);
  assert.equal(shortaLookups,0);
  assert.equal(storage.size,1);
  assert.ok([...storage.keys()][0].includes('/__liva/catalogue/argentina-verified-v1'));
  const stored = [...storage.values()][0];
  assert.match(stored.headers.get('cache-control'),/max-age=3600/);
});
test('swipes do not invoke Worker routes or KV; frontend references API only from initial load', async()=>{
  const {FRONTEND_HTML}=await import('../src/frontend.js');
  const calls=[...FRONTEND_HTML.matchAll(/fetch\('\/api\/streams'\s*(?:,|\))/g)];
  assert.equal(calls.length,1);
  assert.doesNotMatch(FRONTEND_HTML,/setInterval\s*\(/);
  assert.doesNotMatch(FRONTEND_HTML,/CATALOG_KV|navigator\.sendBeacon/);
});

test('reject expensive non-GET requests and canonicalize arbitrary query parameters before provider lookup', async t => {
  const oldFetch=globalThis.fetch, oldCaches=globalThis.caches;
  t.after(()=>{globalThis.fetch=oldFetch;globalThis.caches=oldCaches;});
  let upstream=0;
  globalThis.fetch=async()=>{upstream++;throw Error('upstream must not be reached');};
  globalThis.caches={default:{
    match:async()=>null,
    put:async()=>{}
  }};
  const post=await worker.fetch(new Request('https://liva.example/api/streams', {method:'POST'}),{}, {});
  assert.equal(post.status,405);
  const malformed=await worker.fetch(new Request('https://liva.example/api/streams?rnd=bad'),{},{});
  assert.equal(malformed.status,308);
  assert.equal(malformed.headers.get('location'),'https://liva.example/api/streams');
  const head=await worker.fetch(new Request('https://liva.example/api/streams',{method:'HEAD'}),{},{});
  assert.equal(head.status,405);
  assert.equal(upstream,0);
});
