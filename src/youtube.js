/**
 * YouTube live discovery: one search.list query per catalogue refresh.
 * NOTE: Workers Cache API is per datacenter; this isolate cache alone does
 * not guarantee a global daily search.list budget across Cloudflare PoPs.
 */
import { CHANNEL_BY_ID } from './channels.js';

const DISCOVERY_TTL_MS = 60 * 60 * 1000;
let cached = { expiresAt: 0, streams: [] };
let inFlight = null;

async function discover(apiKey) {
  const signal = AbortSignal.timeout(8000);
  const search = new URL('https://www.googleapis.com/youtube/v3/search');
  search.searchParams.set('part', 'snippet');
  search.searchParams.set('q', 'OLGA|LUZU TV|BLENDER|Todo Noticias|Crónica TV');
  search.searchParams.set('type', 'video');
  search.searchParams.set('eventType', 'live');
  search.searchParams.set('regionCode', 'AR');
  search.searchParams.set('relevanceLanguage', 'es');
  search.searchParams.set('order', 'relevance');
  search.searchParams.set('maxResults', '50');
  search.searchParams.set('key', apiKey);
  const res = await fetch(search, {signal});
  if (!res.ok) throw new Error('YouTube live discovery unavailable');
  const found = await res.json();
  const ids = [...new Set((found.items || [])
    .map(item => item.id?.videoId).filter(id => /^[\w-]{11}$/.test(id)))];
  if (!ids.length) return [];
  const details = new URL('https://www.googleapis.com/youtube/v3/videos');
  details.searchParams.set('part', 'snippet,status,liveStreamingDetails');
  details.searchParams.set('id', ids.join(','));
  details.searchParams.set('key', apiKey);
  const videoResp = await fetch(details, {signal});
  if (!videoResp.ok) throw new Error('YouTube video verification unavailable');
  const data = await videoResp.json();
  return (data.items || [])
    .filter(v => CHANNEL_BY_ID.has(v.snippet?.channelId)
      && v.status?.embeddable === true
      && v.status?.privacyStatus === 'public'
      && v.snippet?.liveBroadcastContent === 'live'
      && v.liveStreamingDetails
      && !v.liveStreamingDetails.actualEndTime)
    .map(v => ({
      source:'youtube', id:'yt_' + v.id,
      channel:CHANNEL_BY_ID.get(v.snippet.channelId).name,
      channel_id: v.snippet.channelId,
      title:v.snippet.title || '',
      viewers:Number(v.liveStreamingDetails.concurrentViewers) || 0,
      embed_url:buildYouTubeEmbedUrl(v.id),
      thumbnail:v.snippet.thumbnails?.medium?.url,
      is_live:true
    }));
}

export async function fetchYouTubeStreams(env) {
  if (!env.YOUTUBE_API_KEY) return [];
  if (Date.now() < cached.expiresAt) return cached.streams;
  if (inFlight) return inFlight;
  const pending = (async () => {
    try {
      const streams = await discover(env.YOUTUBE_API_KEY);
      cached = { streams, expiresAt: Date.now() + DISCOVERY_TTL_MS };
      return streams;
    } catch (_) {
      // Avoid provider hammering while quota or network is unavailable.
      cached = { streams: [], expiresAt: Date.now() + 120_000 };
      return [];
    }
  })();
  inFlight = pending;
  try { return await pending; }
  finally { if (inFlight === pending) inFlight = null; }
}

/** Official YouTube embeds retain native controls, keyboard, branding, fullscreen. */
export function buildYouTubeEmbedUrl(videoId) {
  const params = new URLSearchParams({
    autoplay: '1', mute: '1', playsinline: '1', controls: '1'
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}
