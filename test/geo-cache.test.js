import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { FRONTEND_HTML } from '../src/frontend.js';
import worker from '../src/index.js';

test('inline frontend JavaScript parses correctly', () => {
  const scripts = [...FRONTEND_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0][1]));
});

test('shared feed never exposes viewer geolocation and is publicly cacheable', async () => {
  const store = new Map();
  globalThis.caches = {default:{
    match:async key => store.get(String(key)) || null,
    put:async (key,resp) => {store.set(String(key),resp.clone());}
  }};
  const promises = [];
  const ctx = {waitUntil:p => promises.push(p)};
  const req = new Request('https://liva.example/api/streams');
  const first = await worker.fetch(Object.assign(req,{cf:{city:'Santa Fe',regionCode:'S',country:'AR'}}),{},ctx);
  await Promise.all(promises);
  const firstPayload = await first.json();
  assert.equal(Object.hasOwn(firstPayload,'geo'),false);
  assert.equal(firstPayload.streams.some(s => String(s.id).startsWith('geo_')), false);
  assert.match(first.headers.get('cache-control'),/public, max-age=300/);
  const req2 = new Request('https://liva.example/api/streams');
  const second = await worker.fetch(Object.assign(req2,{cf:{city:'Córdoba',regionCode:'X',country:'AR'}}),{},ctx);
  assert.deepEqual((await second.json()).streams,firstPayload.streams);
  assert.equal(store.size,1);
  const req3 = new Request('https://liva.example/api/streams');
  const third = await worker.fetch(Object.assign(req3,{cf:{city:'Córdoba',regionCode:'X',country:'AR'}}),{},ctx);
  assert.deepEqual((await third.json()).streams,firstPayload.streams);
  assert.equal(store.size,1);
});
