// Browser-only QA; synthetic tracker exists only in test request routing. Never use its data as participant evidence.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8765/preview.html');
const videos=[];
for(const item of ['path-break','car-bend','painting-crack','juice-split']){
 await page.selectOption('#item',item);await page.evaluate(()=>window.lastPlayback=null);await page.click('#play');
 await page.waitForFunction(()=>window.lastPlayback?.finish_reason==='ended',null,{timeout:10000});
 videos.push({item,...await page.evaluate(()=>({duration:window.lastPlayback.media_duration_s,wall_ms:window.lastPlayback.wall_playback_ms,frames:window.lastPlayback.frames.length,dropped:window.lastPlayback.dropped_frames}))});
}
await page.click('#tableau');await page.screenshot({path:'/tmp/causal-gaze-preview.png',fullPage:true});
await page.goto('http://127.0.0.1:8765/?allocation=1');await page.getByRole('heading',{name:'Pilot Sessions'}).waitFor();
assert.equal(errors.length,0);assert.equal(videos.length,4);assert.ok(videos.every(v=>v.duration===4&&v.wall_ms>=3900&&v.wall_ms<4400));
console.log(JSON.stringify({videos,errors,welcome:await page.locator('h1').innerText()},null,2));await browser.close();
