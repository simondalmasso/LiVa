import test from 'node:test';
import assert from 'node:assert/strict';
import { FRONTEND_HTML } from '../src/frontend.js';
import worker from '../src/index.js';

test('Pluto is a static official destination without a Worker endpoint', async () => {
  const response = await worker.fetch(new Request('https://liva.example/api/pluto'), {}, {});
  assert.equal(response.status, 404);
  assert.match(FRONTEND_HTML, /id="pluto-official-link"/);
  assert.match(FRONTEND_HTML, /href="https:\/\/pluto\.tv\//);
  assert.doesNotMatch(FRONTEND_HTML, /fetch\(['"]\/api\/pluto/);
  assert.doesNotMatch(FRONTEND_HTML, /new Hls\(|hls\.js/i);
});
test('frontend never injects provider-controlled strings as HTML', () => {
  assert.doesNotMatch(FRONTEND_HTML, /innerHTML\s*=/);
  assert.doesNotMatch(FRONTEND_HTML, /\x24\x7be\.message\x7d/);
  assert.match(FRONTEND_HTML, /id="pluto-official-link"/);
});
test('player cannot be hidden behind touch shields or inactive autoplay', () => {
  assert.doesNotMatch(FRONTEND_HTML, /bounce-shield|pointer-events:\s*none;\s*}\s*\.iframe-pool/);
  assert.match(FRONTEND_HTML, /stopActivePlayer\(/);
  assert.match(FRONTEND_HTML, /startActivePlayer\(/);
  assert.doesNotMatch(FRONTEND_HTML, /for \(let i = 0; i < 3; i\+\+\)/);
});
test('player only accepts official YouTube and Twitch origins', () => {
  assert.match(FRONTEND_HTML, /www\.youtube\.com/);
  assert.match(FRONTEND_HTML, /player\.twitch\.tv/);
  assert.match(FRONTEND_HTML, /URL\(stream\.embed_url\)/);
});

import { buildYouTubeEmbedUrl } from '../src/youtube.js';
test('YouTube iframe preserves official fullscreen and keyboard controls', () => {
  const u = new URL(buildYouTubeEmbedUrl('123456789AB'));
  assert.equal(u.searchParams.get('controls'), '1');
  for (const key of ['fs','disablekb','showinfo','modestbranding']) {
    assert.equal(u.searchParams.has(key), false, key + ' should not suppress player features');
  }
});

test('UI has no Tailwind CDN and ships critical layout CSS locally', () => {
  assert.doesNotMatch(FRONTEND_HTML, /cdn\.tailwindcss\.com/);
  assert.match(FRONTEND_HTML, /\[class~="flex"\]\{display:flex\}/);
  assert.match(FRONTEND_HTML, /\[class~="hidden"\]\{display:none!important\}/);
});

test('mobile allows pinch zoom for accessibility',()=>{
  assert.doesNotMatch(FRONTEND_HTML,/user-scalable=no|maximum-scale=1\.0/);
});

test('video iframe URL is assigned only AFTER visible playback geometry is validated', () => {
  const start=FRONTEND_HTML.indexOf('function startActivePlayer');
  const end=FRONTEND_HTML.indexOf('function renderFeed',start);
  const fn=FRONTEND_HTML.slice(start,end);
  assert.ok(fn.indexOf('const bounds = holder.getBoundingClientRect()') >= 0);
  assert.ok(fn.indexOf('frame.src = url') > fn.indexOf('const bounds = holder.getBoundingClientRect()'));
});

test('feed marks age of catalogue so stale livestreams are not represented as verified now', async()=>{
  const {FRONTEND_HTML}=await import('../src/frontend.js');
  assert.match(FRONTEND_HTML,/id="catalogue-age"/);
  assert.match(FRONTEND_HTML,/function updateCatalogueAge\(/);
  assert.match(FRONTEND_HTML,/data\.generated_at/);
});
test('empty feed offers a manual retry without automatic polling',async()=>{
  const {FRONTEND_HTML}=await import('../src/frontend.js');
  assert.match(FRONTEND_HTML,/No se encontraron transmisiones verificadas/);
  assert.match(FRONTEND_HTML,/Reintentar/);
  assert.doesNotMatch(FRONTEND_HTML,/setInterval\s*\(/);
});
