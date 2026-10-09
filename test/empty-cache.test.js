import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('empty catalogue has short negative-cache TTL, not one hour',async t=>{
  const oldFetch=globalThis.fetch,oldCache=globalThis.caches;
  t.after(()=>{globalThis.fetch=oldFetch;globalThis.caches=oldCache;});
  let cached;
  globalThis.caches={default:{
    match:async()=>null,
    put:async(_key,response)=>{cached=response.clone();}
  }};
  globalThis.fetch=async()=>{throw new Error('provider unreachable')};
  const response=await worker.fetch(new Request('https://liva.example/api/streams'),{}, {});
  assert.equal(response.status,200);
  const json=await response.json();
  assert.deepEqual(json.streams,[]);
  assert.match(cached.headers.get('cache-control'),/max-age=300/);
  assert.doesNotMatch(cached.headers.get('cache-control'),/max-age=3600/);
});
