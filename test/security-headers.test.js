import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('homepage and health responses return minimum security headers', async () => {
  for (const path of ['/', '/api/health']) {
    const response = await worker.fetch(new Request('https://liva.example' + path), {}, {});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.equal(response.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
    assert.equal(response.headers.get('x-frame-options'),'DENY');
    assert.equal(response.headers.get('strict-transport-security'),'max-age=31536000');
  }
});

import { createHash } from 'node:crypto';
import { FRONTEND_HTML } from '../src/frontend.js';
test('Content Security Policy pins the exact inline script hash and official embed hosts', async()=>{
  const res=await worker.fetch(new Request('https://liva.example/'),{},{});
  const csp=res.headers.get('content-security-policy') || '';
  const code=[...FRONTEND_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)][0]?.[1];
  assert.ok(code);
  const hash=createHash('sha256').update(code,'utf8').digest('base64');
  assert.ok(csp.includes("'sha256-" + hash + "'"));
  assert.match(csp,/frame-src https:\/\/www\.youtube\.com https:\/\/player\.twitch\.tv/);
  assert.match(csp,/object-src 'none'/);
  assert.doesNotMatch(csp,/script-src[^;]*'unsafe-inline'/);
});

test('health endpoint reports the deployed PROJECT_VERSION binding',async()=>{
  const res=await worker.fetch(new Request('https://liva.example/api/health'),{
    PROJECT_VERSION:'4.2.0-LIVE-ARGENTINA'
  },{});
  assert.equal(res.status,200);
  const health=await res.json();
  assert.equal(health.version,'4.2.0-LIVE-ARGENTINA');
});
