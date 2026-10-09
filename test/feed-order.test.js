import test from 'node:test';
import assert from 'node:assert/strict';
import { orderLiveFeed } from '../src/aggregator.js';

test('live YouTube first, then Twitch; recorded VOD excluded and duplicates removed',()=>{
 const youtube=[
  {source:'youtube',id:'yt_a',channel:'A',is_live:true,viewers:20},
  {source:'youtube',id:'yt_b',channel:'B',is_live:true,viewers:100}
 ];
 const twitch=[
  {source:'twitch',id:'tw_c',is_live:true,viewers:5000},
  {source:'youtube',id:'yt_a',is_live:true,viewers:20},
  {source:'twitch',id:'tw_invalid',is_live:false,viewers:10000}
 ];
 const recorded=[{source:'shorta',id:'shorta_x',is_live:false}];
 const out=orderLiveFeed(youtube,twitch,recorded);
 assert.deepEqual(out.map(x=>x.id),['yt_b','yt_a','tw_c']);
 assert.deepEqual(out,orderLiveFeed(youtube,twitch,recorded));
});

test('editorial public channel-name matches rank first without extra API calls',()=>{
 const result=orderLiveFeed([
  {source:'youtube',id:'yt_other',channel:'Otro canal',is_live:true,viewers:100000},
  {source:'youtube',id:'yt_olga',channel:'OLGA',is_live:true,viewers:120},
  {source:'youtube',id:'yt_blender',channel:'BLENDER',is_live:true,viewers:180},
 ],[],[]);
 assert.deepEqual(result.map(s=>s.id),['yt_blender','yt_olga','yt_other']);
});
