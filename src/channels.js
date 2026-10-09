/**
 * Curated Argentine YouTube publisher channel IDs.
 * Verified by official YouTube channel pages and independent channel indexes.
 * This is a publisher list, not a grant of audiovisual redistribution rights.
 */
export const CHANNELS = Object.freeze([
  { id: 'UC7mJ2EDXFomeDIRFu5FtEbA', name: 'OLGA', handle: 'olgaenvivo_' },
  { id: 'UCTHaNTsP7hsVgBxARZTuajw', name: 'LUZU TV', handle: 'luzutv' },
  { id: 'UC6pJGaMdx5Ter_8zYbLoRgA', name: 'BLENDER', handle: 'estoesblender' },
  { id: 'UCj6PcyLvpnIRT_2W_mwa9Aw', name: 'TN', handle: 'todonoticias' },
  { id: 'UCT7KFGv6s2a-rh2Jq8ZdM1g', name: 'Crónica TV', handle: 'cronicatv' },
]);
export const CHANNEL_BY_ID = new Map(CHANNELS.map(channel => [channel.id, channel]));
