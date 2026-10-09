import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchTwitchStreams, ensureTwitchToken } from '../src/twitch.js';

test('Twitch uses one app token, form body for credentials, and queries curated active channels directly', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch=original; });
  const requests=[];
  globalThis.fetch=async (url,options={})=>{
    requests.push({url:String(url),options});
    if(String(url).includes('/oauth2/token')) return Response.json({access_token:'TEST_TOKEN',expires_in:3600});
    if(String(url).includes('/helix/streams')) return Response.json({data:[{
      id:'123',user_name:'martinciriook',user_login:'martinciriook',type:'live',title:'En vivo',
      viewer_count:500,thumbnail_url:'https://static-cdn.jtvnw.net/live_user_{width}x{height}.jpg'
    }]});
    throw new Error('unexpected endpoint '+url);
  };
  const cache={token:null,expiresAt:0};
  const result=await fetchTwitchStreams({TWITCH_CLIENT_ID:'APPID',TWITCH_CLIENT_SECRET:'SECRET'},cache);
  assert.equal(requests.filter(r=>r.url.includes('/oauth2/token')).length,1);
  assert.equal(requests.filter(r=>r.url.includes('/helix/streams')).length,1);
  assert.equal(result[0].channel,'martinciriook');
  const oauth=requests.find(r=>r.url.includes('/oauth2/token'));
  assert.equal(new URL(oauth.url).search,'');
  assert.equal(new URLSearchParams(oauth.options.body).get('client_secret'),'SECRET');
  assert.ok(requests.find(r=>r.url.includes('user_login=martinciriook')));
});
test('Twitch retries once after 401 and never loops', async (t) => {
  const original=globalThis.fetch; t.after(()=>globalThis.fetch=original);
  let tokens=0, streams=0;
  globalThis.fetch=async (url) => {
    if(String(url).includes('/oauth2/token')) {
      tokens++; return Response.json({access_token:'TOKEN_'+tokens,expires_in:3600});
    }
    streams++;
    if(streams===1) return new Response('invalid',{status:401});
    return Response.json({data:[]});
  };
  const result=await fetchTwitchStreams({TWITCH_CLIENT_ID:'a',TWITCH_CLIENT_SECRET:'b'},{token:null,expiresAt:0});
  assert.deepEqual(result,[]);
  assert.equal(tokens,2);
  assert.equal(streams,2);
});
test('Twitch coalesces concurrent token requests within one isolate', async(t)=>{
  const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;await new Promise(resolve=>setTimeout(resolve,10));
    return Response.json({access_token:'SHARED',expires_in:3600});
  };
  const cache={token:null,expiresAt:0};
  const env={TWITCH_CLIENT_ID:'a',TWITCH_CLIENT_SECRET:'b'};
  const tokens=await Promise.all(Array.from({length:6},()=>ensureTwitchToken(env,cache)));
  assert.deepEqual(tokens,Array(6).fill('SHARED'));
  assert.equal(calls,1);
});

test('Twitch token exchange and Helix lookup share one finite abort deadline',async t=>{
  const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);
  const signals=[];
  globalThis.fetch=async(url,options={})=>{
    signals.push(options.signal);
    if(String(url).includes('/oauth2/token')) return Response.json({access_token:'TEST',expires_in:3600});
    if(String(url).includes('/helix/streams')) return Response.json({data:[]});
    throw Error('Unexpected provider URL');
  };
  await fetchTwitchStreams({TWITCH_CLIENT_ID:'a',TWITCH_CLIENT_SECRET:'b'},{token:null,expiresAt:0});
  assert.equal(signals.length,2);
  assert.ok(signals[0] instanceof AbortSignal);
  assert.equal(signals[0],signals[1]);
});

test('Twitch excludes unrelated foreign channels even if a response contains them',async t=>{
  const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);
  let requested=[];
  globalThis.fetch=async(url)=>{
    const u=new URL(String(url));
    if(u.pathname.endsWith('/oauth2/token')) return Response.json({access_token:'VALID',expires_in:3600});
    if(u.pathname.endsWith('/helix/streams')){
      requested=u.searchParams.getAll('user_login');
      return Response.json({data:[
        {id:'live-1',user_login:'martinciriook',user_name:'Martín Cirio',type:'live',title:'Streaming de hoy',viewer_count:400},
        {id:'live-2',user_login:'monstercat',user_name:'Monstercat',type:'live',title:'Music 24/7',viewer_count:20000},
        {id:'live-3',user_login:'coscu',user_name:'Coscu',type:'live',title:'En vivo',viewer_count:350},
        {id:'live-4',user_login:'momo',user_name:'Momo',type:'',title:'Offline',viewer_count:10}
      ]});
    }
    throw Error('unexpected '+url);
  };
  const streams=await fetchTwitchStreams({TWITCH_CLIENT_ID:'a',TWITCH_CLIENT_SECRET:'b'},{token:null,expiresAt:0});
  assert.deepEqual(streams.map(s=>s.id),['tw_live-1','tw_live-3']);
  assert.deepEqual(requested.sort(),['martinciriook','coscu','momo'].sort());
});
