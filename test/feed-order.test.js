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
 const out=orderLiveFeed([...youtube,...recorded],twitch);
 assert.deepEqual(out.map(x=>x.id),['yt_b','yt_a','tw_c']);
 assert.deepEqual(out,orderLiveFeed([...youtube,...recorded],twitch));
});

test('YouTube source order is deterministic and does not depend on channel-name heuristics',()=>{
 const result=orderLiveFeed([
  {source:'youtube',id:'yt_a',channel:'A',is_live:true,viewers:100000},
  {source:'youtube',id:'yt_b',channel:'B',is_live:true,viewers:200},
 ],[
  {source:'twitch',id:'tw_a',channel:'martinciriook',is_live:true,viewers:5000},
 ]);
 assert.deepEqual(result.map(s=>s.id),['yt_a','yt_b','tw_a']);
});
