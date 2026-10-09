/**
 * Live-only deterministic catalogue ordering.
 * Channel names are an editorial hint, NOT verified broadcaster identities.
 * Exact YouTube channel IDs must be verified separately before identity claims.
 */
const ARGENTINE_CHANNEL_NAMES = new Set([
  'olga', 'luzu', 'luzu tv', 'blender',
  'tn', 'tn todo noticias', 'todo noticias',
  'cronica', 'cronica tv', 'a24', 'c5n',
  'telefe noticias', 'canal 26', 'gelatina'
]);

function normalizedName(name) {
  return String(name || '').toLocaleLowerCase('es-AR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function isArgentineNameMatch(name) {
  return ARGENTINE_CHANNEL_NAMES.has(normalizedName(name));
}

export function orderLiveFeed(youtubeStreams = [], twitchStreams = []) {
  const live = [...youtubeStreams, ...twitchStreams].filter(stream =>
    stream && stream.is_live === true
    && (stream.source === 'youtube' || stream.source === 'twitch')
    && typeof stream.id === 'string' && stream.id.length > 0
  );
  const seen = new Set();
  const unique = live.filter(stream => {
    const key = stream.source + ':' + stream.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const priority = item => item.source === 'youtube'
    ? (isArgentineNameMatch(item.channel) ? 0 : 1) : 2;
  unique.sort((a, b) =>
    priority(a) - priority(b)
    || (Number(b.viewers) || 0) - (Number(a.viewers) || 0)
    || String(a.id).localeCompare(String(b.id))
  );
  return unique;
}
