import test from 'node:test';
import assert from 'node:assert/strict';

test('catalogue cache write must finish before another request can refresh providers', async(t)=>{
  const originalFetch=globalThis.fetch, originalCaches=globalThis.caches;
  t.after(()=>{globalThis.fetch=originalFetch;globalThis.caches=originalCaches;});
  const {default:worker}=await import('../src/index.js?concurrency-check='+Date.now());
  const store=new Map();
  let release;
  const writing=new Promise(resolve=>release=resolve);
  let putStarted;
  const started=new Promise(resolve=>putStarted=resolve);
  let writes=0, searches=0;
  globalThis.caches={default:{
    match: async req=>store.get(String(req))?.clone() ?? null,
    put: async(req,res)=>{
      writes++;
      putStarted();
      await writing;
      store.set(String(req),res.clone());
    }
  }};
  globalThis.fetch=async input=>{
    const u=new URL(String(input));
    if(u.pathname.endsWith('/search')){searches++;return Response.json({items:[{id:{videoId:'AAA111AAA11'}}]});}
    if(u.pathname.endsWith('/videos')) return Response.json({items:[{
      id:'AAA111AAA11',status:{embeddable:true,privacyStatus:'public'},
      snippet:{channelId:'UC7mJ2EDXFomeDIRFu5FtEbA',title:'En vivo',channelTitle:'OLGA',liveBroadcastContent:'live'},
      liveStreamingDetails:{concurrentViewers:'100'}
    }]});
    if(u.pathname.endsWith('/channels') || u.pathname.endsWith('/playlistItems')) return Response.json({items:[]});
    throw Error('unexpected '+u);
  };
  const ctx={waitUntil:()=>{}};
  const env={YOUTUBE_API_KEY:'TEST'};
  const first=worker.fetch(new Request('https://liva.example/api/streams'),env,ctx);
  await started;
  const second=worker.fetch(new Request('https://liva.example/api/streams'),env,ctx);
  // Let both entrypoints reach the active in-flight barrier, then unblock the write.
  await Promise.resolve();
  await Promise.resolve();
  release();
  const [a,b]=await Promise.all([first,second]);
  assert.equal(a.status,200);
  assert.equal(b.status,200);
  assert.equal(searches,1);
  assert.equal(writes,1);
});
