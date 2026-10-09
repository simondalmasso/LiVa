/**
 * Twitch Helix client. One token cache per Worker isolate, provided by index.js.
 * Uses the official app-token form POST; no credentials in URL/logs.
 */
const HELIX_BASE = 'https://api.twitch.tv/helix';
// Explicit Argentine streamer registry. No global top-streams browsing.
const TARGET_STREAMERS = ['martinciriook', 'coscu', 'momo'];
const TARGET_LOGINS = new Set(TARGET_STREAMERS);

export async function ensureTwitchToken(env, cache, signal = AbortSignal.timeout(8000)) {
  if (cache.token && cache.expiresAt > Date.now() + 60_000) return cache.token;
  if (cache.pending) return cache.pending;
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    throw new Error('Twitch credentials not configured');
  }
  const pending = (async () => {
    const resp = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      signal,
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }).toString()
    });
    if (!resp.ok) throw new Error('Twitch OAuth returned ' + resp.status);
    const data = await resp.json();
    if (!data.access_token || !Number.isFinite(Number(data.expires_in))) {
      throw new Error('Twitch OAuth returned invalid token metadata');
    }
    cache.token = data.access_token;
    cache.expiresAt = Date.now() + Number(data.expires_in) * 1000;
    return cache.token;
  })();
  cache.pending = pending;
  try { return await pending; }
  finally { if (cache.pending === pending) cache.pending = null; }
}

async function helixStreams(env, cache, retry = true, signal = AbortSignal.timeout(8000)) {
  const token = await ensureTwitchToken(env, cache, signal);
  const url = new URL(HELIX_BASE + '/streams');
  for (const login of TARGET_STREAMERS) url.searchParams.append('user_login', login);
  url.searchParams.set('first','100');
  const resp = await fetch(url, {
    signal,
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      'Authorization': 'Bearer ' + token
    }
  });
  if (resp.status === 401 && retry) {
    if (cache.token === token) { cache.token = null; cache.expiresAt = 0; }
    return helixStreams(env, cache, false, signal);
  }
  if (!resp.ok) throw new Error('Twitch Helix returned ' + resp.status);
  const data = await resp.json();
  return Array.isArray(data.data) ? data.data : [];
}

export async function fetchTwitchStreams(env, tokenCache) {
  const rows = await helixStreams(env, tokenCache, true, AbortSignal.timeout(8000));
  const seen = new Set();
  return rows.filter(s => {
    if (!s.id || !TARGET_LOGINS.has(String(s.user_login || '').toLowerCase())
        || s.type !== 'live' || seen.has(s.id)) return false;
    seen.add(s.id); return true;
  }).map(s => ({
    source: 'twitch',
    id: 'tw_' + s.id,
    channel: s.user_name,
    title: s.title || '',
    game: s.game_name,
    viewers: Number(s.viewer_count) || 0,
    embed_url: 'https://player.twitch.tv/?channel=' + encodeURIComponent(s.user_login) +
      '&parent=liva.simondalmasso44.workers.dev&muted=true&autoplay=true',
    thumbnail: s.thumbnail_url?.replace('{width}', '640').replace('{height}', '360'),
    is_live: true
  }));
}
