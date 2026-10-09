/**
 * Official Pluto TV destination. Direct stitched HLS URLs must not be
 * distributed by LiVa without a written authorization for that use.
 * Preserve the Pluto Hub entry point and link viewers to Pluto itself.
 */
export async function fetchPlutoChannels() {
  return [{
    source: 'pluto',
    id: 'pluto_official',
    channel: 'Pluto TV',
    title: 'Explorá los canales desde el sitio oficial',
    external_url: 'https://pluto.tv/',
    fallback: true,
    is_live: null,
  }];
}
