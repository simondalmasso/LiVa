/**
 * LiVa Frontend — embedded as a template string.
 *
 * Features implemented client-side:
 *   #1 One official player at a time
 *   #2 Gestures and navigation outside the player controls
 *   #5 Shorta recorded content isolated in a manual-only Grabados section
 *   #8 Pluto TV official destination instead of direct HLS
 */

import { UTILITY_CSS } from './utilities.js';
import { CHANNELS } from './channels.js';

export const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#0a0a0a" />
<title>LiVa — Zapping sin latencia</title>
<style>
${UTILITY_CSS}
  html, body { background:#000; color:#fff; margin:0; height:100%; overflow:hidden; overscroll-behavior:none; -webkit-tap-highlight-color:transparent; color-scheme:dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; }
  .iframe-pool { position:relative; z-index:2; width:min(92vw, calc((100dvh - 210px)*16/9)); aspect-ratio:16/9; flex:none; background:#080808; border-radius:8px; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,.45); }
  .iframe-pool iframe { display:block; width:100%; height:100%; border:0; }
  .snap-poster { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:0; filter:blur(22px) brightness(.48); transform:scale(1.08); opacity:.8; }
  .theatre-mode .iframe-pool { width:min(100%, calc((100dvh - 210px)*16/9)); border-radius:0; }
  .theatre-mode .snap-poster { opacity:.18; }
  @media (max-width:355px) {
    .iframe-pool, .theatre-mode .iframe-pool { width:min(100%, calc((100dvh - 210px)*4/3)); aspect-ratio:4/3; }
  }
  @media (min-width:768px) { .iframe-pool { width:min(92vw, calc((100dvh - 210px)*16/9)); } }
  @media (max-height:500px) and (orientation:landscape) {
    .snap-item { padding:56px 0 44px !important; }
    .iframe-pool, .theatre-mode .iframe-pool { width:min(100%, calc((100dvh - 100px)*16/9)); aspect-ratio:16/9; }
  }
  .player-fallback { z-index:2; position:relative; max-width:360px; padding:18px; background:#151515; border-radius:12px; text-align:center; color:#fff; }
  .player-fallback a { color:#fff; text-decoration:underline; display:block; padding-top:12px; }
  #stream-open { pointer-events:auto; display:inline-block; margin-top:10px; font-size:12px; color:#fff; text-decoration:underline; text-underline-offset:3px; }
  .pluto-card { color:inherit; text-decoration:none; display:block; }
  .pluto-card:focus-visible, .manual-media-link:focus-visible, button:focus-visible, .player-fallback a:focus-visible { outline:3px solid #8ab4f8; outline-offset:3px; }
  .manual-media-link { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:20px; padding:18px; background:#161616; border:1px solid #303030; border-radius:12px; color:#fff; text-decoration:none; }
  .manual-media-link:hover { background:#222; }
  .official-publishers { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; max-width:360px; padding:6px 16px; }
  .official-publishers a { display:inline-flex; align-items:center; min-height:44px; padding:0 12px; border-radius:999px; border:1px solid #303030; background:#191919; text-decoration:none; color:white; font-size:12px; }
  .official-publishers a:focus-visible { outline:3px solid #8ab4f8; outline-offset:2px; }
  .badge-pill {
    display:inline-flex; align-items:center; gap:4px;
    padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600;
    backdrop-filter: blur(8px); background: rgba(0,0,0,.55);
  }
  .nav-tab { transition: background-color .2s, color .2s; padding-inline:10px; min-height:44px; white-space:nowrap; cursor:pointer; }
  #top-nav { padding-top:max(8px, env(safe-area-inset-top)); }
  #category-tabs { gap:3px; }
  #zap-controls { right:max(12px, env(safe-area-inset-right)); bottom:calc(78px + env(safe-area-inset-bottom)); gap:10px; }
  #zap-controls button { min-width:48px; min-height:48px; flex:none; touch-action:manipulation; }
  #view-mode { font-size:11px; font-weight:700; }
  #stream-info { bottom:calc(12px + env(safe-area-inset-bottom)); right:84px; overflow-wrap:anywhere; }
  #stream-open { min-height:44px; display:inline-flex; align-items:center; }
  @media (max-width:350px) {
    #top-nav { padding-left:8px; padding-right:8px; }
    #top-nav h1 { font-size:20px; }
    #category-tabs .nav-tab { padding-inline:8px; font-size:11px; }
    #stream-info { right:82px; }
  }
  .nav-tab.active { background:#fff; color:#000; }
  .nav-tab:not(.active) { background:rgba(255,255,255,.08); color:#aaa; }
  .snap-container { scroll-snap-type: y mandatory; height:100vh; height:100dvh; overflow-y:auto; overscroll-behavior-y:contain; scrollbar-width:none; touch-action:pan-y; }
  .snap-container::-webkit-scrollbar { display:none; }
  .snap-item { scroll-snap-align:start; height:100dvh; position:relative; box-sizing:border-box; display:flex; align-items:center; justify-content:center; padding:70px 0 140px; overflow:hidden; }
  .pluto-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:10px; }
  .pluto-card { aspect-ratio: 16/9; background:#1a1a1a; border-radius:8px; overflow:hidden; cursor:pointer; position:relative; }
  .pluto-card img { width:100%; height:100%; object-fit:cover; }
  .pluto-card .pluto-label { position:absolute; bottom:0; left:0; right:0; padding:8px; background:linear-gradient(to top, rgba(0,0,0,.8), transparent); font-size:12px; }
  .loading-spinner { width:32px; height:32px; border:3px solid rgba(255,255,255,.1); border-top-color:#fff; border-radius:50%; animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .pulse-dot { width:8px; height:8px; background:#ff3b3b; border-radius:50%; animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  @media (max-height:700px) and (orientation:portrait) {
    .snap-item { align-items:flex-start; padding-top:90px; padding-bottom:0; }
    #stream-info { bottom:calc(80px + env(safe-area-inset-bottom)); right:12px; }
    #stream-title { display:block; font-size:13px; line-height:18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    #stream-open { min-height:44px; font-size:11px; }
    #catalogue-age { display:none; }
    #zap-controls { bottom:calc(12px + env(safe-area-inset-bottom)); flex-direction:row; gap:9px; }
  }
  @media (max-height:500px) and (orientation:landscape) {
    .snap-item { padding:84px 0 24px !important; }
    .iframe-pool, .theatre-mode .iframe-pool { width:min(100%, calc((100dvh - 110px)*16/9)); aspect-ratio:16/9; }
    #stream-info { left:8px; right:auto; width:70px; bottom:8px; }
    #stream-title, #catalogue-age, #stream-info .badge-pill, #stream-info .pulse-dot { display:none; }
    #stream-channel { font-size:10px; line-height:13px; margin-top:3px; max-height:40px; overflow:hidden; }
    #stream-live-label { font-size:10px; }
    #stream-open { font-size:10px; min-height:38px; overflow-wrap:anywhere; }
    #zap-controls { right:8px; bottom:8px; gap:4px; flex-direction:column; }
  }
</style>
</head>
<body class="select-none">

<!-- =================== TOP NAV =================== -->
<div id="top-nav" class="fixed top-0 inset-x-0 z-[60] px-4 pt-3 pb-2 bg-gradient-to-b from-black/80 to-transparent">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <h1 class="text-2xl font-black tracking-tight">LiVa</h1>
    </div>
    <div id="category-tabs" class="flex gap-1 p-1 rounded-full bg-black/40 backdrop-blur">
      <button id="tab-feed" type="button" class="nav-tab active px-4 py-1.5 rounded-full text-xs font-semibold">En vivo</button>
      <button id="tab-pluto" type="button" class="nav-tab px-4 py-1.5 rounded-full text-xs font-semibold">Pluto</button>
      <button id="tab-grabados" type="button" class="nav-tab px-4 py-1.5 rounded-full text-xs font-semibold">Grabados</button>
    </div>
  </div>
</div>

<!-- =================== FEED VIEW (Zapping vertical infinito) =================== -->
<div id="view-feed" class="snap-container">
  <!-- Snap items injected by JS -->
</div>

<!-- =================== PLUTO HUB VIEW =================== -->
<div id="view-pluto" class="hidden fixed inset-0 z-10 overflow-y-auto pt-20 pb-8 px-4">
  <div class="max-w-5xl mx-auto">
    <div class="mb-4">
      <h2 class="text-xl font-bold">Pluto TV Hub</h2>
      <p class="text-xs text-white/50">Explorá Pluto TV en su sitio oficial.</p>
    </div>
    <div id="pluto-grid" class="pluto-grid">
      <div class="col-span-full flex justify-center py-10"><div class="loading-spinner"></div></div>
    </div>
  </div>
</div>

<!-- =================== GRABADOS — manual-only, no embeds or fetch =================== -->
<section id="view-grabados" aria-label="Videos grabados" class="hidden fixed inset-0 z-10 overflow-y-auto pt-20 pb-8 px-4">
  <div class="max-w-5xl mx-auto">
    <h2 class="text-xl font-bold">Grabados</h2>
    <p class="text-sm text-white/60 mt-1">Contenido a demanda. No forma parte de las transmisiones en vivo.</p>
    <a id="shorta-manual-link" href="https://www.youtube.com/@hacela.shorta" target="_blank" rel="noopener noreferrer" class="manual-media-link">
      <span class="font-bold">Shorta</span>
      <span class="text-xs text-white/60">Abrir en YouTube ↗</span>
    </a>
    <p class="text-xs text-white/50 mt-3">No hay reproducción automática ni consultas para explorar esta sección.</p>
  </div>
</section>

<!-- =================== ZAP CONTROLS (right side) =================== -->
<div id="zap-controls" class="fixed right-3 bottom-24 z-[55] flex flex-col gap-3 items-center">
  <button id="view-mode" type="button" aria-label="Expandir video a 16:9" aria-pressed="false" class="w-12 h-12 rounded-full bg-white/10 backdrop-blur active:bg-white/30">16:9</button>
  <button id="zap-up" aria-label="Canal anterior" class="w-12 h-12 rounded-full bg-white/10 backdrop-blur active:bg-white/30 text-xl">▲</button>
  <button id="zap-down" aria-label="Canal siguiente" class="w-12 h-12 rounded-full bg-white/10 backdrop-blur active:bg-white/30 text-xl">▼</button>
</div>

<!-- =================== STREAM INFO OVERLAY =================== -->
<div id="stream-info" class="fixed left-3 bottom-6 right-20 z-[55] pointer-events-none">
  <div class="flex items-center gap-2 mb-1">
    <div class="pulse-dot"></div>
    <span id="stream-live-label" class="text-xs font-bold uppercase tracking-wider text-red-500">EN VIVO</span>
    <span id="stream-source" class="badge-pill"></span>
    <span id="stream-badge" class="badge-pill" style="background:rgba(255,180,0,.85); color:#000;"></span>
  </div>
  <h3 id="stream-title" class="text-base font-bold leading-tight line-clamp-2"></h3>
  <p id="stream-channel" class="text-xs text-white/70 mt-1"></p>
  <p id="catalogue-age" class="text-xs text-white/50 mt-1"></p>
  <a id="stream-open" target="_blank" rel="noopener noreferrer" aria-label="Abrir canal en la plataforma original">Abrir original ↗</a>
</div>

<script>
// =====================================================
// LiVa Frontend Engine v4.1
// =====================================================

const OFFICIAL_PUBLISHERS = ${JSON.stringify(CHANNELS.map(({name,handle})=>({name,href:'https://www.youtube.com/@'+handle+'/live'})))};

const State = {
  streams: [],
  currentIndex: 0,
  isLoading: false,
  catalogueTime: 0,
};

const feedView = document.getElementById('view-feed');
const streamInfo = document.getElementById('stream-info');
const streamTitle = document.getElementById('stream-title');
const streamChannel = document.getElementById('stream-channel');
const streamSource = document.getElementById('stream-source');
const streamBadge = document.getElementById('stream-badge');

// =====================================================
// Single visible official player. Never preload playing iframes.
// =====================================================
function allowedEmbedUrl(stream) {
  try {
    const url = new URL(stream.embed_url);
    if (url.protocol !== 'https:') return null;
    if (stream.source === 'youtube' &&
        url.hostname === 'www.youtube.com' && url.pathname.startsWith('/embed/') && /^[A-Za-z0-9_-]{11}$/.test(url.pathname.slice(7))) {
      // Only the visible player is instantiated, always muted for browser autoplay.
      url.searchParams.set('autoplay','1');
      url.searchParams.set('mute','1');
      url.searchParams.set('playsinline','1');
      url.searchParams.set('controls','1');
      return url.href;
    }
    if (stream.source === 'twitch' && url.hostname === 'player.twitch.tv' && url.pathname === '/') {
      url.searchParams.set('parent', location.hostname);
      url.searchParams.set('muted', 'true');
      return url.href;
    }
  } catch (_) {}
  return null;
}
function officialStreamUrl(stream) {
  if (stream.source === 'twitch' && /^[a-zA-Z0-9_]{2,25}$/.test(stream.channel || '')) {
    return 'https://www.twitch.tv/' + stream.channel.toLowerCase();
  }
  if (stream.source === 'youtube' &&
      /^yt_[A-Za-z0-9_-]{11}$/.test(stream.id || '')) {
    return 'https://www.youtube.com/watch?v=' + encodeURIComponent(stream.id.slice(3));
  }
  return stream.source === 'twitch' ? 'https://www.twitch.tv/' : 'https://www.youtube.com/';
}
function fallbackPlayer(snap, stream, description) {
  const panel = document.createElement('div');
  panel.className = 'player-fallback';
  const p = document.createElement('p');
  p.textContent = description;
  const link = document.createElement('a');
  link.href = officialStreamUrl(stream);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Ver en ' + (stream.source === 'twitch' ? 'Twitch' : 'YouTube');
  panel.append(p, link);
  snap.appendChild(panel);
}
function stopActivePlayer() {
  document.querySelectorAll('.iframe-pool iframe').forEach(frame => {
    frame.src = 'about:blank';
    frame.remove();
  });
  document.querySelectorAll('.iframe-pool, .player-fallback').forEach(element => element.remove());
}
function startActivePlayer(idx) {
  if (document.visibilityState !== 'visible') return;
  const stream = State.streams[idx];
  const snap = feedView.children[idx];
  if (!stream || !snap) return;
  const url = allowedEmbedUrl(stream);
  if (!url) {
    fallbackPlayer(snap, stream, 'Este contenido no está disponible para insertar.');
    return;
  }
  if (stream.source === 'twitch' && snap.clientWidth < 400) {
    fallbackPlayer(snap, stream, 'Twitch requiere un reproductor de al menos 400 px de ancho.');
    return;
  }
  const holder = document.createElement('div');
  holder.className = 'iframe-pool';
  snap.appendChild(holder);
  const bounds = holder.getBoundingClientRect();
  if ((stream.source === 'twitch' && (bounds.width < 400 || bounds.height < 300)) ||
      (stream.source !== 'twitch' && (bounds.width < 200 || bounds.height < 200))) {
    holder.remove();
    fallbackPlayer(snap, stream, 'El reproductor no cabe en esta pantalla.');
    return;
  }
  const frame = document.createElement('iframe');
  frame.title = 'En vivo: ' + (stream.channel || 'Canal');
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.allowFullscreen = true;
  frame.src = url;
  holder.appendChild(frame);
}

// =====================================================
// RENDER FEED
// =====================================================
function renderFeed() {
  snapObserver.disconnect();
  stopActivePlayer();
  feedView.replaceChildren();
  feedView.scrollTop = 0;
  State.streams.forEach((stream, idx) => {
    const snap = document.createElement('div');
    snap.className = 'snap-item';
    snap.dataset.idx = idx;

    // Allowlisted poster images load lazily; never prefetch every stream's artwork.
    if (stream.thumbnail) {
      try {
        const thumb = new URL(stream.thumbnail);
        if (thumb.protocol === 'https:' &&
            ['i.ytimg.com', 'static-cdn.jtvnw.net'].includes(thumb.hostname)) {
          const poster = document.createElement('img');
          poster.className = 'snap-poster';
          poster.src = thumb.href;
          poster.alt = '';
          poster.loading = 'lazy';
          poster.decoding = 'async';
          poster.referrerPolicy = 'no-referrer';
          snap.appendChild(poster);
        }
      } catch (_) {}
    }
    // Dark overlay for readability of stream-info
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0';
    overlay.style.background = 'linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.2) 40%, rgba(0,0,0,0) 70%)';
    snap.appendChild(overlay);

    feedView.appendChild(snap);
  });

  feedView.scrollTop = 0;
  State.currentIndex = -1;
  onSnapActivate(0);
}

// =====================================================
// SCROLL HANDLING — manage pool slot visibility
// =====================================================
const snapObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.intersectionRatio >= 0.6 && feedView.contains(entry.target)) {
      const idx = parseInt(entry.target.dataset.idx, 10);
      onSnapActivate(idx);
    }
  });
}, { threshold: [0, 0.25, 0.5, 0.6, 0.85, 1], root: feedView });

function onSnapActivate(idx) {
  if (feedView.classList.contains('hidden') || document.visibilityState !== 'visible') return;
  if (idx < 0 || idx >= State.streams.length) return;
  if (idx === State.currentIndex && document.querySelector('.iframe-pool iframe')) return;
  stopActivePlayer();
  State.currentIndex = idx;
  startActivePlayer(idx);
  updateStreamInfo(idx);
}

function updateCatalogueAge(timestamp) {
  const label = document.getElementById('catalogue-age');
  const updatedAt = Number(timestamp);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
    label.textContent = 'Verificación no disponible';
    return;
  }
  const minutes = Math.max(0, Math.floor((Date.now() - updatedAt) / 60000));
  label.textContent = minutes >= 20
    ? 'Verificado hace ' + minutes + ' min · puede haber finalizado'
    : 'Verificado hace ' + minutes + ' min';
}
function updateStreamInfo(idx) {
  updateCatalogueAge(State.catalogueTime);
  const s = State.streams[idx];
  if (!s) return;
  streamTitle.textContent = s.title || '';
  streamChannel.textContent = s.channel || '';
  document.getElementById('stream-open').href = officialStreamUrl(s);
  document.getElementById('stream-live-label').textContent = s.is_live === true ? 'EN VIVO' : 'GRABADO';
  document.querySelector('.pulse-dot').style.display = s.is_live === true ? '' : 'none';
  streamSource.textContent = (s.source || '').toUpperCase();
  streamSource.style.display = s.source ? '' : 'none';

  if (s.badge) {
    streamBadge.textContent = s.badge;
    streamBadge.style.display = '';
  } else {
    streamBadge.style.display = 'none';
  }
}

// =====================================================
// NAVIGATION — zap up/down buttons + scroll
// =====================================================
function snapToIndex(idx) {
  const target = feedView.children[idx];
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
document.getElementById('zap-up').addEventListener('click', () => {
  if (State.currentIndex > 0) snapToIndex(State.currentIndex - 1);
});
document.getElementById('zap-down').addEventListener('click', () => {
  if (State.currentIndex < State.streams.length - 1) snapToIndex(State.currentIndex + 1);
});

// Touch zapping is bound only to areas OUTSIDE official embedded players.
// Never overlay, obscure or intercept provider controls.
let swipeStart = null;
feedView.addEventListener('touchstart', event => {
  const target = event.target;
  if (target.closest?.('iframe, .iframe-pool, button, a')) {
    swipeStart = null;
    return;
  }
  if (event.touches.length !== 1 || feedView.classList.contains('hidden')) return;
  swipeStart = { y: event.touches[0].clientY, index: State.currentIndex };
}, { passive: true });
feedView.addEventListener('touchend', event => {
  if (!swipeStart || event.changedTouches.length !== 1) return;
  const delta = event.changedTouches[0].clientY - swipeStart.y;
  const index = swipeStart.index;
  swipeStart = null;
  if (Math.abs(delta) < 72) return;
  const next = Math.min(State.streams.length - 1, Math.max(0, index + (delta < 0 ? 1 : -1)));
  if (next !== index) snapToIndex(next);
}, { passive: true });
feedView.addEventListener('touchcancel', () => { swipeStart = null; }, { passive: true });

// Mobile-first canvas mode: official player stays 16:9 and is never reloaded.
document.getElementById('view-mode').addEventListener('click', () => {
  const expanded = feedView.classList.toggle('theatre-mode');
  const button = document.getElementById('view-mode');
  button.textContent = expanded ? '9:16' : '16:9';
  button.setAttribute('aria-pressed', String(expanded));
  button.setAttribute('aria-label', expanded ? 'Volver a la vista vertical' : 'Expandir video a 16:9');
});

// Keyboard support
document.addEventListener('keydown', (e) => {
  if (feedView.classList.contains('hidden')) return;
  if (e.key === 'ArrowDown' || e.key === 'j') {
    if (State.currentIndex < State.streams.length - 1) snapToIndex(State.currentIndex + 1);
  } else if (e.key === 'ArrowUp' || e.key === 'k') {
    if (State.currentIndex > 0) snapToIndex(State.currentIndex - 1);
  }
});

// =====================================================
// FETCH STREAMS FROM WORKER
// =====================================================
function appendOfficialPublishers(panel) {
  const title = document.createElement('p');
  title.textContent = 'Abrir canales oficiales manualmente (estado LIVE no confirmado)';
  title.className = 'text-xs text-white/60 mt-3';
  const directory = document.createElement('div');
  directory.id = 'official-publishers';
  directory.className = 'official-publishers';
  for (const publisher of OFFICIAL_PUBLISHERS) {
    const link = document.createElement('a');
    link.href = publisher.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = publisher.name + ' ↗';
    directory.appendChild(link);
  }
  panel.append(title, directory);
}

async function loadFeed() {
  if (State.isLoading) return;
  State.isLoading = true;
  try {
    const resp = await fetch('/api/streams', {signal: AbortSignal.timeout(10000)});
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error);
    State.streams = (Array.isArray(data.streams) ? data.streams : []).filter(item =>
      item && item.is_live === true && (item.source === 'youtube' || item.source === 'twitch'));
    State.catalogueTime = Number(data.generated_at) || 0;
    if (State.streams.length === 0) {
      stopActivePlayer();
      feedView.replaceChildren();
      const panel = document.createElement('div');
      panel.className = 'flex flex-col items-center justify-center h-screen text-white/60 text-sm gap-2';
      const msg = document.createElement('p');
      msg.textContent = 'No se encontraron transmisiones verificadas ahora.';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Reintentar';
      button.className = 'mt-3 px-4 py-2 bg-white/10 rounded-full text-xs';
      button.addEventListener('click', loadFeed);
      panel.append(msg, button);
      appendOfficialPublishers(panel);
      feedView.appendChild(panel);
      document.getElementById('stream-info').style.display = 'none';
      document.getElementById('zap-controls').style.display = 'none';
      return;
    }
    const isLiveVisible = !feedView.classList.contains('hidden');
    document.getElementById('stream-info').style.display = isLiveVisible ? '' : 'none';
    document.getElementById('zap-controls').style.display = isLiveVisible ? '' : 'none';
    renderFeed();
    // Observe all snaps
    Array.from(feedView.children).forEach(c => snapObserver.observe(c));
  } catch (e) {
    stopActivePlayer();
    feedView.replaceChildren();
    const panel = document.createElement('div');
    panel.className = 'flex flex-col items-center justify-center h-screen text-white/60 text-sm gap-2';
    const msg = document.createElement('p');
    msg.textContent = 'Error al cargar el feed.';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Reintentar';
    button.className = 'mt-3 px-4 py-2 bg-white/10 rounded-full text-xs';
    button.addEventListener('click', loadFeed);
    panel.append(msg, button);
    appendOfficialPublishers(panel);
    feedView.appendChild(panel);
    document.getElementById('stream-info').style.display = 'none';
    document.getElementById('zap-controls').style.display = 'none';
  } finally {
    State.isLoading = false;
  }
}

// =====================================================
// PLUTO TV HUB (Feature #8)
// =====================================================
async function loadPluto() {
  const grid = document.getElementById('pluto-grid');
  try {
    const resp = await fetch('/api/pluto');
    if (!resp.ok) throw new Error('Pluto no disponible');
    const data = await resp.json();
    if (!data.ok) throw new Error('Pluto no disponible');
    grid.replaceChildren();
    (data.channels || []).forEach(ch => {
      const url = new URL(ch.external_url);
      if (url.protocol !== 'https:' || !['pluto.tv','www.pluto.tv'].includes(url.hostname)) return;
      const card = document.createElement('a');
      card.className = 'pluto-card';
      card.href = url.href;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.style.padding = '20px';
      const channelLabel = document.createElement('div');
      channelLabel.textContent = ch.channel || 'Pluto TV';
      channelLabel.className = 'font-semibold text-sm';
      const title = document.createElement('div');
      title.textContent = ch.title || 'Abrir sitio oficial';
      title.className = 'text-xs text-white/60';
      card.append(channelLabel, title);
      grid.appendChild(card);
    });
    if (!grid.children.length) throw new Error('No se encontró un enlace oficial.');
  } catch (e) {
    grid.replaceChildren();
    const msg = document.createElement('p');
    msg.textContent = 'No se pudo cargar el directorio de Pluto TV.';
    grid.appendChild(msg);
  }
}

// =====================================================
// CATEGORIES: live feed, Pluto and manual recorded content.
// Any non-live category destroys the live player immediately.
// =====================================================
const tabIds = ['feed', 'pluto', 'grabados'];
function activateTab(selected) {
  for (const id of tabIds) {
    const active = id === selected;
    document.getElementById('tab-' + id).classList.toggle('active', active);
    document.getElementById('tab-' + id).setAttribute('aria-pressed', String(active));
    document.getElementById('view-' + id).classList.toggle('hidden', !active);
  }
  const isLive = selected === 'feed';
  document.getElementById('zap-controls').style.display = isLive && State.streams.length > 0 ? '' : 'none';
  document.getElementById('stream-info').style.display = isLive && State.streams.length > 0 ? '' : 'none';
  if (!isLive) {
    stopActivePlayer();
  } else if (State.streams.length > 0) {
    onSnapActivate(Math.max(0, State.currentIndex));
  }
  if (selected === 'pluto' && !document.getElementById('pluto-grid').dataset.loaded) {
    document.getElementById('pluto-grid').dataset.loaded = '1';
    loadPluto();
  }
}
for (const id of tabIds) {
  document.getElementById('tab-' + id).addEventListener('click', () => activateTab(id));
}
activateTab('feed');

// Never keep a hidden livestream playing while another tab/app is foregrounded.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    stopActivePlayer();
  } else if (document.getElementById('view-feed').classList.contains('hidden') === false) {
    onSnapActivate(Math.max(0, State.currentIndex));
  }
});

// =====================================================
// BOOT
// =====================================================
loadFeed();
</script>
</body>
</html>`;
