/**
 * Deterministic live-only ordering.
 * YouTube ingestion validates the exact curated publisher IDs; this layer only
 * normalizes source eligibility, removes duplicates and orders the feed.
 */
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
  const priority = item => item.source === 'youtube' ? 0 : 1;
  unique.sort((a, b) =>
    priority(a) - priority(b)
    || (Number(b.viewers) || 0) - (Number(a.viewers) || 0)
    || String(a.id).localeCompare(String(b.id))
  );
  return unique;
}
