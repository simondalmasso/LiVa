/**
 * LiVa Cloudflare Worker — locally audited release candidate.
 * Single visible official player, cached public catalogue, zero KV.
 * Rights review and live audiovisual validation remain release gates.
 */

import { FRONTEND_HTML } from './frontend.js';
import { fetchTwitchStreams } from './twitch.js';
import { fetchYouTubeStreams } from './youtube.js';
import { fetchPlutoChannels } from './pluto.js';
import { orderLiveFeed } from './aggregator.js';

const RESPONSE_SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

let contentSecurityPolicyPromise = null;
function getContentSecurityPolicy() {
  if (!contentSecurityPolicyPromise) {
    contentSecurityPolicyPromise = (async () => {
      const start = FRONTEND_HTML.indexOf('<script>');
      const end = FRONTEND_HTML.indexOf('</script>', start);
      if (start < 0 || end < 0) throw new Error('Missing first-party inline script');
      const bytes = new TextEncoder().encode(FRONTEND_HTML.slice(start + 8, end));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = btoa(String.fromCharCode(...new Uint8Array(digest)));
      return [
        "default-src 'none'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'sha256-" + hash + "'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self'",
        "img-src 'self' data: https://i.ytimg.com https://static-cdn.jtvnw.net",
        "frame-src https://www.youtube.com https://player.twitch.tv",
        "upgrade-insecure-requests"
      ].join('; ');
    })();
  }
  return contentSecurityPolicyPromise;
}

// In-memory token cache (per-isolate)
let twitchTokenCache = { token: null, expiresAt: 0 };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cf = request.cf || {};

    // --- Routing ---
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(FRONTEND_HTML, {
        headers: { ...RESPONSE_SECURITY_HEADERS, 'content-security-policy': await getContentSecurityPolicy(), 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public, max-age=300' },
      });
    }

    if (url.pathname === '/api/streams') {
      if (request.method !== 'GET') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: { ...RESPONSE_SECURITY_HEADERS, 'allow': 'GET', 'cache-control': 'no-store' },
        });
      }
      if (url.search) {
        return Response.redirect(new URL('/api/streams', url).toString(), 308);
      }
      return handleStreams(request, env);
    }

    if (url.pathname === '/api/pluto') {
      return handlePluto(env);
    }

    if (url.pathname === '/api/health') {
      return jsonResponse({
        ok: true,
        version: env.PROJECT_VERSION || 'unversioned',
        time: new Date().toISOString(),
        cf: { city: cf.city, regionCode: cf.regionCode, country: cf.country },
      });
    }

    return new Response('Not Found', { status: 404, headers: RESPONSE_SECURITY_HEADERS });
  },
};

// ---------------- /api/streams ----------------
// Public catalogue without personal geo metadata; query variants redirect.
let catalogueInFlight = null;
async function loadCatalogue(cacheKey, env) {
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    try { return await cached.json(); } catch (_) { /* rebuild corrupt entry */ }
  }
  if (catalogueInFlight) return catalogueInFlight;
  const pending = (async () => {
    const [twitchResult, youtubeResult] = await Promise.allSettled([
      fetchTwitchStreams(env, twitchTokenCache),
      fetchYouTubeStreams(env),
    ]);
    const twitch = twitchResult.status === 'fulfilled' ? twitchResult.value : [];
    const youtube = youtubeResult.status === 'fulfilled' ? youtubeResult.value : [];
    const streams = orderLiveFeed(youtube, twitch);
    const catalogue = { generated_at: Date.now(), streams };
    const ttl = streams.length ? 3600 : 300;
    const response = new Response(JSON.stringify(catalogue), {
      headers: { 'content-type': 'application/json;charset=utf-8',
                 'cache-control': `public, max-age=${ttl}, s-maxage=${ttl}` },
    });
    // Do not release the single-flight guard until this cache write finishes.
    // Otherwise a second request can miss cache and duplicate provider calls.
    try { await cache.put(cacheKey, response.clone()); } catch (_) { /* serve fresh data anyway */ }
    return catalogue;
  })();
  catalogueInFlight = pending;
  try { return await pending; }
  finally { if (catalogueInFlight === pending) catalogueInFlight = null; }
}

async function handleStreams(request, env) {
  try {
    const catalogUrl = new URL('/__liva/catalogue/argentina-verified-v1', request.url);
    const catalogue = await loadCatalogue(new Request(catalogUrl), env);
    const streams = catalogue.streams;
    const payload = {
      ok: true,
      generated_at: catalogue.generated_at,
      count: streams.length,
      streams,
    };
    return new Response(JSON.stringify(payload), {
      headers: {
        ...RESPONSE_SECURITY_HEADERS,
        'content-type': 'application/json;charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  } catch (_) {
    return jsonResponse({ ok: false, error: 'catalog_unavailable' }, 503);
  }
}

// ---------------- /api/pluto ----------------
async function handlePluto(env) {
  try {
    const channels = await fetchPlutoChannels(env);
    return jsonResponse({
      ok: true,
      count: channels.length,
      channels,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message || err) }, 500);
  }
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...RESPONSE_SECURITY_HEADERS, 'content-type': 'application/json;charset=utf-8', 'cache-control': 'no-store' },
  });
}
