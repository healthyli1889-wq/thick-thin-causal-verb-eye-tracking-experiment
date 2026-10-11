import test from 'node:test';import assert from 'node:assert/strict';
import {observeVideo} from '../src/media.js';
class Video extends EventTarget {
  currentTime=0;duration=4;readyState=4;paused=true;
  play(){this.paused=false;queueMicrotask(()=>this.dispatchEvent(new Event('playing')));return Promise.resolve();}
  pause(){this.paused=true;}
  getVideoPlaybackQuality(){return {droppedVideoFrames:2,totalVideoFrames:96};}
}
test('ended completes once and retains counters; no padding timer',async()=>{
 const v=new Video();let done=0;
 const result=new Promise(resolve=>observeVideo(v,{timeoutMs:1000,onDone:log=>{done++;resolve(log);}}));
 await new Promise(r=>setTimeout(r,5));v.currentTime=4;v.dispatchEvent(new Event('ended'));
 const log=await result;v.dispatchEvent(new Event('ended'));
 assert.equal(done,1);assert.equal(log.finish_reason,'ended');assert.equal(log.dropped_frames,2);assert.equal(log.final_media_time_s,4);assert.ok(log.wall_playback_ms<100);
});
test('play rejection is explicit failure, not an elapsed successful video',async()=>{
 const v=new Video();v.play=()=>Promise.reject(new Error('autoplay denied'));
 const log=await new Promise(resolve=>observeVideo(v,{onDone:resolve}));
 assert.equal(log.finish_reason,'play-rejected');assert.equal(log.error.message,'autoplay denied');assert.equal(log.ended_ms,null);
});
test('a stalled video ends on watchdog and is marked failed',async()=>{
 const log=await new Promise(resolve=>observeVideo(new Video(),{timeoutMs:10,onDone:resolve}));
 assert.equal(log.finish_reason,'timeout');assert.equal(log.timeout,true);assert.equal(log.ended_ms,null);
});
