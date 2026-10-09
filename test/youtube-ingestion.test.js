import test from 'node:test';
import assert from 'node:assert/strict';

test('YouTube one discovery query with bulk details, verified LIVE, and coalescing', async(t)=>{
  const old=globalThis.fetch; t.after(()=>globalThis.fetch=old);
  let searches=0,details=0;
  globalThis.fetch=async(url)=>{
    const parsed=new URL(String(url));
    if(parsed.pathname.endsWith('/search')){
      searches++;
      assert.equal(parsed.searchParams.get('eventType'),'live');
      assert.equal(parsed.searchParams.get('regionCode'),'AR');
      return Response.json({items:[
        {id:{videoId:'AAA111AAA11'}},{id:{videoId:'BBB222BBB22'}}
      ]});
    }
    if(parsed.pathname.endsWith('/videos')){
      details++;
      return Response.json({items:[
        {id:'AAA111AAA11',status:{embeddable:true,privacyStatus:'public'},snippet:{channelId:'UC7mJ2EDXFomeDIRFu5FtEbA',title:'Actual',channelTitle:'OLGA',liveBroadcastContent:'live'},liveStreamingDetails:{actualStartTime:'2026-10-09T12:00:00Z',concurrentViewers:'1500'}},
        {id:'BBB222BBB22',status:{embeddable:true,privacyStatus:'public'},snippet:{channelId:'UC7mJ2EDXFomeDIRFu5FtEbA',title:'Finished',channelTitle:'TN',liveBroadcastContent:'none'},liveStreamingDetails:{actualStartTime:'2026-10-09T11:00:00Z',actualEndTime:'2026-10-09T11:59:00Z'}}
      ]});
    }
    throw Error('unexpected '+url);
  };
  const {fetchYouTubeStreams}=await import('../src/youtube.js?quota-contract-v1');
  const [one,two]=await Promise.all([fetchYouTubeStreams({YOUTUBE_API_KEY:'TEST'}),fetchYouTubeStreams({YOUTUBE_API_KEY:'TEST'})]);
  assert.equal(searches,1);
  assert.equal(details,1);
  assert.equal(one.length,1);
  assert.equal(one[0].channel,'OLGA');
  assert.deepEqual(one,two);
});
test('YouTube fails cleanly on upstream API errors (no fabricated feeds)', async(t)=>{
  const old=globalThis.fetch; t.after(()=>globalThis.fetch=old);
  globalThis.fetch=async()=>new Response('quotaExceeded',{status:403});
  const {fetchYouTubeStreams}=await import('../src/youtube.js?quota-contract-v2');
  const data=await fetchYouTubeStreams({YOUTUBE_API_KEY:'TEST'});
  assert.deepEqual(data,[]);
});

test('YouTube search and video verification use one finite abort deadline',async t=>{
  const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);
  const signals=[];
  globalThis.fetch=async(url, options={})=>{
    signals.push(options.signal);
    if(String(url).includes('/search')) return Response.json({items:[{id:{videoId:'AAA111AAA11'}}]});
    if(String(url).includes('/videos')) return Response.json({items:[{
      id:'AAA111AAA11',status:{embeddable:true,privacyStatus:'public'},
      snippet:{channelId:'UC7mJ2EDXFomeDIRFu5FtEbA',title:'Live',channelTitle:'OLGA',liveBroadcastContent:'live'},
      liveStreamingDetails:{concurrentViewers:'100'}
    }]});
    throw Error('Unexpected provider URL');
  };
  const {fetchYouTubeStreams}=await import('../src/youtube.js?deadline-check');
  await fetchYouTubeStreams({YOUTUBE_API_KEY:'TEST'});
  assert.equal(signals.length,2);
  assert.ok(signals[0] instanceof AbortSignal);
  assert.equal(signals[0],signals[1]);
});

test('YouTube accepts only verified Argentine channel IDs, rejects foreign broadcasts and channel-name spoofing',async t=>{
  const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);
  const seen=[];
  globalThis.fetch=async url=>{
    const u=new URL(String(url));seen.push(u);
    if(u.pathname.endsWith('/search')) return Response.json({items:[
      {id:{videoId:'AAA111AAA11'}},{id:{videoId:'BBB222BBB22'}},
      {id:{videoId:'CCC333CCC33'}},{id:{videoId:'DDD444DDD44'}}
    ]});
    if(u.pathname.endsWith('/videos')) return Response.json({items:[
      {id:'AAA111AAA11',status:{embeddable:true,privacyStatus:'public'},
       snippet:{channelId:'UC7mJ2EDXFomeDIRFu5FtEbA',channelTitle:'OLGA',title:'Programación OLGA',liveBroadcastContent:'live'},
       liveStreamingDetails:{actualStartTime:'2026-10-09T12:00:00Z',concurrentViewers:'1200'}},
      {id:'BBB222BBB22',status:{embeddable:true,privacyStatus:'public'},
       snippet:{channelId:'UCNOTREALLYARGENTINAAAAAA',channelTitle:'OLGA',title:'Imitación',liveBroadcastContent:'live'},
       liveStreamingDetails:{actualStartTime:'2026-10-09T12:00:00Z',concurrentViewers:'99999'}},
      {id:'CCC333CCC33',status:{embeddable:true,privacyStatus:'public'},
       snippet:{channelId:'UC6pJGaMdx5Ter_8zYbLoRgA',channelTitle:'BLENDER',title:'Blender real',liveBroadcastContent:'live'},
       liveStreamingDetails:{actualStartTime:'2026-10-09T12:00:00Z',concurrentViewers:'400'}},
      {id:'DDD444DDD44',status:{embeddable:true,privacyStatus:'public'},
       snippet:{channelId:'UCTHaNTsP7hsVgBxARZTuajw',channelTitle:'LUZU TV',title:'Archivado',liveBroadcastContent:'none'},
       liveStreamingDetails:{actualStartTime:'2026-10-01T12:00:00Z',actualEndTime:'2026-10-01T13:00:00Z'}}
    ]});
    throw Error('unexpected '+url);
  };
  const {fetchYouTubeStreams}=await import('../src/youtube.js?curated-ids-contract');
  const out=await fetchYouTubeStreams({YOUTUBE_API_KEY:'TEST'});
  assert.deepEqual(out.map(s=>s.id),['yt_AAA111AAA11','yt_CCC333CCC33']);
  assert.equal(out[0].channel,'OLGA');
  assert.equal(seen.filter(x=>x.pathname.endsWith('/search')).length,1);
  assert.equal(seen.filter(x=>x.pathname.endsWith('/videos')).length,1);
  const query=seen.find(x=>x.pathname.endsWith('/search')).searchParams.get('q');
  assert.ok(query.includes('OLGA'));
  assert.ok(query.includes('LUZU'));
  assert.ok(query.includes('BLENDER'));
  assert.ok(query.includes('|'));
});
