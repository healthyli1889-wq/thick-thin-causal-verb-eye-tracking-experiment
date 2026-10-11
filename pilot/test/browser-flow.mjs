// Browser-only QA; synthetic tracker exists only in test request routing. Never use its data as participant evidence.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';
import pathModule from 'node:path';
const base=pathModule.resolve(import.meta.dirname,'..');
const mode=process.argv[2]||'pass';const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/src/experiment.js',route=>route.fulfill({contentType:'application/javascript',body:(mode==='preview'?"window.__qaPredictionCalls=0;const qaPredict=window.webgazer.getCurrentPrediction;window.webgazer.getCurrentPrediction=function(...args){window.__qaPredictionCalls++;return qaPredict.apply(this,args);};\n":'')+fs.readFileSync(base+'/src/experiment.js','utf8').replace('user_agent:navigator.userAgent','synthetic_test_data:true,user_agent:navigator.userAgent')}));
if(mode!=='preview')await page.route('**/vendor/webgazer.js',route=>route.fulfill({contentType:'application/javascript',body:`window.webgazer={showPredictionPoints(){},showVideo(){},showFaceOverlay(){},showFaceFeedbackBox(){},removeMouseEventListeners(){},addMouseEventListeners(){},trainingCount:0,paused:true,clearData(){this.trainingCount=0},recordScreenPosition(){this.trainingCount++},resume(){this.paused=false},pause(){this.paused=true},getCalibrationStatus(){return {paused:this.paused,face_detected:true,feature_time_ms:performance.now(),feature_age_ms:0,training_counts:[this.trainingCount]};},end(){},begin(){return ${mode==='camera-error'?"Promise.reject(new DOMException('Denied in QA','NotAllowedError'))":'Promise.resolve()'}},getTracker(){return {predictionReady:true}},predictionCalls:0,getCurrentPrediction(){this.predictionCalls++;if(${mode==='validation-error'}&&document.querySelector('.validation-point')&&this.failedPoint!==document.querySelector('.validation-point')){this.failedPoint=document.querySelector('.validation-point');return Promise.reject(new Error('Deliberate validation prediction failure'));}if(!this.paused)throw new Error('Duplicate sampling owners: background loop is active');const e=document.querySelector('.validation-point')||document.querySelector('#fixation');const r=e?.getBoundingClientRect();return Promise.resolve({x:${mode==='fail'?'9999':mode==='brown56'?'r?r.left+r.width/2:innerWidth/2+innerHeight*.22':mode==='brown75'?'r?r.left+r.width/2:innerWidth/2+innerHeight*.125':mode==='brown80'?'r?r.left+r.width/2:innerWidth/2+innerHeight*.1':'r?r.left+r.width/2:innerWidth/2'},y:r?r.top+r.height/2:innerHeight/2,t:performance.now()})}};` }));
for(const [file,global,name,data]of [['plugin-browser-check.js','jsPsychBrowserCheck','browser-check',"{browser:'chrome',mobile:false,webcam:true}"],['plugin-webgazer-init-camera.js','jsPsychWebgazerInitCamera','webgazer-init-camera','{load_time:0}']])if(!(mode==='camera-error'&&file==='plugin-webgazer-init-camera.js'))await page.route(`**/vendor/${file}`,route=>route.fulfill({contentType:'application/javascript',body:`var ${global}=class{static info={name:'${name}',parameters:{}};constructor(j){this.j=j}trial(){this.j.extensions.webgazer.initialized=${mode!=='camera-error'||file!=='plugin-browser-check.js'};this.j.finishTrial(${data})}};`}));
await page.route('**/src/config.js',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(base+'/src/config.js','utf8').replace('trainingSettleMs: 750','trainingSettleMs: 10').replace('trainingClickIntervalMs: 300','trainingClickIntervalMs: 10').replace('repetitions: 5','repetitions: 1').replace('settleMs: 1000, durationMs: 2000','settleMs: 10, durationMs: 200').replace('fixationMs: 1000, previewMs: 800, gazeMs: 3000','fixationMs: 400, previewMs: 100, gazeMs: 3000')}));
if(mode==='audio-fail')await page.addInitScript(()=>{const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return this.src.includes('verb-')?Promise.reject(new Error('Deliberate QA audio failure')):original.call(this);};});
if(mode==='preload-fail')await page.route('**/assets/audio/speech-check.wav',route=>route.fulfill({contentType:'audio/wav',body:''}));
await page.goto('http://127.0.0.1:8765/?allocation=1'+(mode==='preview'?'&mode=preview':''));let download=null,sawValidationFeedback=false,capturedScenario=false;page.on('download',d=>download=d);
const deadline=Date.now()+150000;
while(Date.now()<deadline){
 if(await page.locator('#download').count())break;
 if(errors.length)break;
 if(mode==='interrupt'){
  const partial=await page.evaluate(()=>new Promise(resolve=>{const req=indexedDB.open('causal-gaze-pilot-v2',1);req.onsuccess=()=>{const db=req.result;if(!db.objectStoreNames.contains('sessions'))return resolve(null);const q=db.transaction('sessions').objectStore('sessions').getAll();q.onsuccess=()=>{resolve(q.result[0]?.session.in_progress_trial);db.close();};};}));
  if(partial?.logical_id.endsWith('-audio')&&partial.samples.length){
   await page.goto('http://127.0.0.1:8765/recovery.html');await page.locator('button').first().waitFor();
   const saved=page.waitForEvent('download');await page.locator('button').first().click();const d=await saved;const file='/tmp/causal-gaze-interrupt.json';await d.saveAs(file);
   const recovered=JSON.parse(fs.readFileSync(file));assert.ok(recovered.session.in_progress_trial.samples.length>0);assert.equal(recovered.session.in_progress_trial.partial,true);
   assert.ok(!recovered.rows.some(r=>r.logical_id===recovered.session.in_progress_trial.logical_id));assert.equal(errors.length,0);
   console.log(JSON.stringify({mode,partial_samples:recovered.session.in_progress_trial.samples.length,completed_rows:recovered.rows.length,errors}));await browser.close();process.exit(0);
  }
 }
 if(await page.locator('#validation-gaze-dot:visible').count())sawValidationFeedback=true;
 if(mode==='preview'){if(!capturedScenario&&await page.locator('#event-video').count()){await page.screenshot({path:'/tmp/pilot-v24-scenario.png'});capturedScenario=true;}if(await page.locator('input[name=age]').count())await page.screenshot({path:'/tmp/pilot-v24-feedback.png',fullPage:true});}
 const audio=page.locator('#sound-check');if(await audio.count()){if(mode==='sound-error'){await audio.evaluate(a=>a.dispatchEvent(new Event('error')));await page.waitForTimeout(100);continue;}await audio.evaluate(a=>a.play());await page.waitForTimeout(2100);}
 for(const select of await page.locator('select').all()){const name=await select.getAttribute('name');await select.selectOption(name==='heard'?{label:'seven'}:{index:1});}
 const age=page.locator('input[name=age]');if(await age.count())await age.fill('25');
 const major=page.locator('input[name=major]');if(await major.count())await major.fill('Linguistics');
 if(await page.locator('#jspsych-html-button-response-btngroup').count())await page.waitForTimeout(150);
 const dot=page.locator('#calibration-point');if(await dot.count())await dot.click({force:true});
 else {const button=page.locator('button:visible:not([disabled]),input[type=submit]:visible:not([disabled])').first();if(await button.count())await button.click({force:true});}
 await page.waitForTimeout(40);
}
if(!download){console.log(JSON.stringify({mode,errors,body:(await page.locator('body').innerText()).slice(0,1500)}));await page.screenshot({path:`/tmp/flow-${mode}.png`});await browser.close();process.exit(1);}
const path=`/tmp/causal-gaze-${mode}.json`;await download.saveAs(path);const p=JSON.parse(fs.readFileSync(path));p.environment.synthetic_test_data=true;fs.writeFileSync(path,JSON.stringify(p,null,2));
console.log(JSON.stringify({mode,errors,complete:p.complete,stop:p.stop_reason,integrity:p.data_integrity,rows:p.trials.length,validation:p.trials.filter(r=>r.task==='validation').map(r=>({id:r.logical_id,pass:r.verdict.pass,hz:r.verdict.perPoint.map(p=>p.hz)})),gaze:p.trials.filter(r=>r.task==='audio-gaze').map(r=>({n:r.webgazer_data.length,dt:r.capture_duration_ms,origin:r.audio_timing.playing_from_gaze_origin_ms}))},null,2));
assert.equal(errors.length,0); assert.equal(p.data_integrity.pass,true);
for(const row of p.trials.filter(r=>r.task==='calibration')){assert.equal(row.click_count_pass,true);assert.equal(row.training_status.training_counts[0],row.expected_clicks);}
if(mode==='pass'||mode==='brown80'||mode==='brown75'){assert.equal(p.quality.brown_checkpoints.length,1);assert.ok(p.quality.brown_checkpoints.every(c=>c.score===(mode==='brown80'?80:mode==='brown75'?75:100)&&c.pass));assert.equal(new Set(p.trials.filter(r=>r.task==='choice').map(r=>r.probe_id)).size,8);}
// A low score must be recorded and labelled, and must NOT stop the run: one opening
// calibration and one validation, all four scenarios collected, and the payload saying plainly
// that nothing was screened.
if(mode==='fail'||mode==='brown56'){
 assert.equal(p.stop_reason,null);
 assert.equal(p.tracking_quality_gate,'recorded-not-enforced');
 assert.equal(p.quality.tracking_quality.enforced,false);
 assert.equal(p.quality.tracking_quality.recalibration_attempts_offered,0);
 assert.equal(p.quality.tracking_quality.reference_levels_met,false);
 assert.equal(p.quality.tracking_quality.reference_levels.brown_minimum_score,75);
 assert.ok(p.quality.blockers.some(b=>b.includes('recorded but not screened')));
 assert.equal(p.trials.filter(r=>r.task==='validation').length,1);
 assert.equal(p.trials.filter(r=>r.task==='calibration').length,1);
 assert.equal(p.trials.filter(r=>r.task==='video').length,4);
 for(const r of p.trials.filter(r=>r.task==='validation-gate')){assert.equal(r.gate_enforced,false);assert.equal(r.reference_thresholds_met,false);}
 if(mode==='brown56'){
  assert.ok(p.quality.brown_checkpoints.every(c=>c.score===56&&!c.pass));
  assert.equal(p.quality.tracking_quality.lowest_brown_score,56);
  assert.ok(p.quality.tracking_quality.brown_scores.every(s=>s.score===56&&!s.meets_reference));
  assert.ok(p.trials.filter(r=>r.task==='validation').every(r=>r.verdict.pass));
 }
}
else if(mode==='camera-error'){assert.equal(p.stop_reason,'camera-start-failed');assert.equal(p.trials.find(r=>r.logical_id==='camera-init').camera_error.name,'NotAllowedError');assert.equal(p.trials.filter(r=>r.task==='calibration'||r.task==='video').length,0);}
else if(mode==='sound-error'){assert.equal(p.stop_reason,'audio-check-failed');assert.equal(p.trials.filter(r=>r.task==='audio-check').length,2);assert.ok(p.trials.filter(r=>r.task==='audio-check').every(r=>r.sound_check.error&&!r.audio_check_pass));}
else if(mode==='validation-error'){assert.equal(p.stop_reason,null);assert.equal(p.quality.tracking_quality.reference_levels_met,false);assert.equal(p.trials.filter(r=>r.task==='validation').length,1);assert.ok(p.trials.filter(r=>r.task==='validation').every(r=>r.verdict.failed.includes('prediction-errors')));}
else if(mode==='preload-fail'){assert.equal(p.complete,false);assert.equal(p.stop_reason,'preload-failed');assert.equal(p.trials.filter(r=>r.task==='video').length,0);}
else if(mode==='audio-fail'){assert.equal(p.complete,false);assert.equal(p.stop_reason,'audio-play-rejected');assert.equal(p.trials.filter(r=>r.task==='choice').length,0);}
else if(mode==='preview'){assert.equal(p.mode,'preview');assert.equal(p.complete,false);assert.equal(p.flow_complete,true);assert.equal(p.gaze_enabled,false);assert.equal(p.continuous_gaze.length,0);assert.equal(await page.evaluate(()=>window.__qaPredictionCalls),0);assert.equal(p.trials.filter(r=>r.task==='video').length,4);assert.equal(p.trials.filter(r=>r.task==='choice').length,8);assert.equal(p.trials.filter(r=>r.task==='validation'||r.task==='calibration').length,0);}
else {assert.equal(p.record_integrity.pass,true);assert.equal(p.continuous_integrity.pass,true);assert.equal(p.complete,true);assert.equal(p.trials.filter(r=>r.task==='audio-gaze').length,8);assert.ok(p.trials.filter(r=>r.task==='video').every(r=>r.playback_pass&&r.webgazer_data.length>0));}
if(['pass','brown75','brown80','preview'].includes(mode)){
 const feedback=p.trials.find(r=>r.logical_id==='feedback').response;
 for(const key of ['age','major','english_background','lighting','calibration_clarity','video_naturalness','audio_difficulty','suggestions'])assert.ok(key in feedback,key);
 for(const item of p.assignment.items){const phases=p.trials.filter(r=>r.item_id===item.id);assert.deepEqual(phases.map(r=>r.task),['video','fixation','preview','audio-gaze','choice','fixation','preview','audio-gaze','choice']);assert.deepEqual(phases.filter(r=>r.task==='audio-gaze').map(r=>r.condition),item.conditions);}
 if(mode!=='preview'){
  assert.equal(sawValidationFeedback,true);assert.equal(await page.locator('#validation-gaze-dot').count(),0);
  assert.equal(p.continuous_segments.length,4);assert.ok(p.continuous_segments.every(s=>s.end_performance_ms>s.start_performance_ms));
  for(const r of p.trials.filter(r=>r.task==='choice')){assert.ok(r.webgazer_data.length>0,r.logical_id);assert.ok(p.continuous_gaze.some(x=>x.logical_id===r.logical_id));}
  assert.ok(p.continuous_gaze.every((x,i,a)=>i===0||x.prediction_request_performance_ms>a[i-1].prediction_request_performance_ms));
 }
}
const feedbackRow=p.trials.find(r=>r.logical_id==='feedback');
for(const [key,seen] of Object.entries(feedbackRow.feedback_exposure))if(!seen)assert.equal(feedbackRow.response[key],null);
assert.equal(p.material_status,'user-confirmed-geometric-silent-and-isolated-phrases');
await page.goto('http://127.0.0.1:8765/recovery.html');await page.locator('button').first().waitFor();const recoveredDownload=page.waitForEvent('download');await page.locator('button').first().click();const recoveredFile='/tmp/causal-gaze-recovered-'+mode+'.json';await (await recoveredDownload).saveAs(recoveredFile);const recovered=JSON.parse(fs.readFileSync(recoveredFile));assert.equal(recovered.rows.length,p.trials.length);assert.equal(recovered.session_id,p.session_id);console.log('Recovery download verified:',recovered.rows.length,'rows');await browser.close();
