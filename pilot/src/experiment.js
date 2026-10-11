import {makeAssignment} from './assignment.js';
import {brownMeasurement,brownPass} from './brown-measurement.js';
import {CONFIG} from './config.js';
import {showValidationFeedback} from './gaze-feedback.js';
import {ITEMS,geometry,stageHtml} from './stimuli.js';
import {evaluateValidation,coaching,estimateDrift} from './quality.js';
import {analyzeTrial} from './analysis.js';
import {rectOf,observeVideo,observeAudio} from './media.js';
import {createJournal,makePayload,download} from './storage.js';

const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
const params=new URLSearchParams(location.search);
const researcherPreview=params.get('mode')==='preview';
if(researcherPreview){const badge=document.createElement('aside');badge.id='preview-banner';badge.textContent='Researcher preview — no camera or gaze recording';document.body.append(badge);}
const assignment=makeAssignment(Number(params.get('allocation')),ITEMS);
const layout=assignment.layout;
const itemOrder=assignment.items.map(a=>ITEMS.find(i=>i.id===a.id));
const session={id:crypto.randomUUID(),ledger:[],interactions:[],requiredIds:[],stopReason:null,
  initialValidationPass:false,finalValidationPass:null,latestValidation:null,latestDrift:null,latestBrown:null,
  assignment,material_status:'user-confirmed-geometric-silent-and-isolated-phrases',mode:researcherPreview?'preview':'study',continuous_gaze:[],continuous_segments:[],
  environment:{user_agent:navigator.userAgent,language:navigator.language,device_pixel_ratio:devicePixelRatio,
    screen:{width:screen.width,height:screen.height},viewport:{width:innerWidth,height:innerHeight},
    time_origin_ms:performance.timeOrigin,started_at:new Date().toISOString()},manifest:null};
let rows=[],capture=null,audioContext=null,continuous=null;
function checkpointCapture(){
  if(capture)session.in_progress_trial={logical_id:session.activeTrial,viewport:capture.viewport,
    geometry:capture.geometry,gaze_origin_performance_ms:researcherPreview?capture.started:ext().currentTrialStart,
    samples:capture.samples,partial:true};
  return journal.checkpoint(rows);
}
setInterval(()=>{if(capture||continuous)checkpointCapture();},1000);
const journal=createJournal(session);
function stop(reason){session.stopReason ||= reason;}
function clearGazeChrome(){
  for(const id of ['validation-gaze-dot','calibration-status','webgazer-center-style','webgazer-calibrate-container','webgazer-validate-container','webgazer-init-container'])
    document.getElementById(id)?.remove();
  const gaze=document.getElementById('webgazerGazeDot'); if(gaze) gaze.style.display='none';
  const video=document.getElementById('webgazerVideoContainer'); if(video) video.style.display='none';
  document.body.style.cursor='';
  try{const extension=jsPsych.extensions?.webgazer; extension?.hidePredictions?.(); extension?.hideVideo?.(); extension?.stopMouseCalibration?.();}catch{}
}
function trackerOff(){endScenario();clearGazeChrome();if(researcherPreview)return;try{jsPsych.extensions.webgazer.stopSampleInterval();webgazer.end();}catch{} }
function markup(title,body){return `<section class="study-copy"><h1>${title}</h1>${body}</section>`;}
function ready(id,title,body,button='Continue') {return trial(id,{type:jsPsychHtmlButtonResponse,stimulus:()=>markup(title,typeof body==='function'?body():body),choices:[button]});}
function trial(id,t) {
  const start=t.on_start,finish=t.on_finish;
  return {...t,data:{...t.data,task:t.data?.task||id,logical_id:id},
    on_start:r=>{session.activeTrial=id;session.ledger.push({event:'start',id,performance_ms:performance.now()});journal.checkpoint(rows);start?.(r);},
    on_finish:r=>{try{finish?.(r);}finally{clearGazeChrome();}session.in_progress_trial=null;session.ledger.push({event:'finish',id,performance_ms:performance.now()});session.activeTrial=null;}};
}
function branch(id,test,timeline) {return {timeline,conditional_function:()=>{
  const taken=Boolean(test());session.ledger.push({event:'branch',id,taken,performance_ms:performance.now()});return taken;
}};}
function active(id,timeline){return branch(id,()=>!session.stopReason,timeline);}
const ext=()=>jsPsych.extensions.webgazer;
const gazeExtension=()=>researcherPreview?[]:[{type:jsPsychExtensionWebgazer,params:{targets:['#stage']}}];
function beginScenario(item){
  if(researcherPreview)return;
  endScenario();
  const segment={item_id:item.id,start_performance_ms:performance.now(),end_performance_ms:null};
  session.continuous_segments.push(segment);
  const unsubscribe=ext().onGazeUpdate(p=>{
    const t=p.prediction_request_performance_ms;
    if(t<segment.start_performance_ms)return;
    const event=session.ledger.findLast(e=>['start','finish'].includes(e.event)&&e.performance_ms<=t);
    session.continuous_gaze.push({sample_index:session.continuous_gaze.length,item_id:item.id,
      logical_id:event?.event==='start'?event.id:null,phase_at_receipt:session.activeTrial,
      x:p.x,y:p.y,prediction_request_performance_ms:t,callback_performance_ms:performance.now(),
      inference_duration_ms:p.inference_duration_ms,viewport_width:innerWidth,viewport_height:innerHeight});
  });
  continuous={segment,unsubscribe};ext().beginContinuousSampling();
}
function endScenario(){if(!continuous)return;continuous.segment.end_performance_ms=performance.now();
  continuous.unsubscribe();continuous=null;ext().endContinuousSampling();}


function startCapture(item,{video=null,drift=null,referents=true}={}) {
  const stage=document.querySelector('#stage');
  const geo=item&&stage?geometry(item,layout,rectOf(stage)):null;
  const c={origin:null,started:performance.now(),geometry:referents?geo:null,stage:geo?.stage,
    viewport:{width:innerWidth,height:innerHeight},drift,samples:[]};
  if(researcherPreview){c.unsubscribe=()=>{};capture=c;return c;}
  c.diagnosticsAtStart=structuredClone(ext().sampleDiagnostics||{requests:0,null_predictions:0,errors:[]});
  ext().hideVideo();ext().hidePredictions();ext().stopMouseCalibration();
  c.unsubscribe=ext().onGazeUpdate(p=>{
    if(!ext().activeTrial||p.t<0)return;
    c.samples.push({...p,callback_performance_ms:performance.now(),
      ...(video?{video_media_time_at_receipt_s:video.currentTime,video_paused_at_receipt:video.paused}:{})});
  });capture=c;return c;
}
function finishCapture(row,c) {
  c.unsubscribe();const origin=researcherPreview?c.started:ext().currentTrialStart;
  row.gaze_origin_performance_ms=origin;row.capture_duration_ms=performance.now()-origin;
  if(c.drift?.applied&&c.drift.viewport&&(c.drift.viewport.width!==c.viewport.width||c.drift.viewport.height!==c.viewport.height)){c.drift={...c.drift,applied:false,excluded:true,reasons:[...c.drift.reasons,'viewport-changed-since-fixation']};}
  row.viewport=c.viewport;row.geometry=c.geometry;row.stage_rect=c.stage;row.drift=c.drift;
  // The extension's original samples remain separately available for audit.
  row.webgazer_data_extension=row.webgazer_data;row.webgazer_data=c.samples;
  row.timestamp_semantics='prediction-request time relative to extension on_load; receipt time also stored';
  row.interruptions=session.interactions.filter(e=>e.performance_ms>=origin&&e.performance_ms<=origin+row.capture_duration_ms);
  row.gaze_sampling_enabled=!researcherPreview;row.gaze_recorded=c.samples.length>0;
  const diagnostics=ext()?.sampleDiagnostics||{};
  row.sampling_diagnostics=researcherPreview?{requests:0,null_predictions:0,errors:[],disabled:true}:{
    requests:(diagnostics.requests||0)-(c.diagnosticsAtStart?.requests||0),
    null_predictions:(diagnostics.null_predictions||0)-(c.diagnosticsAtStart?.null_predictions||0),
    errors:(diagnostics.errors||[]).slice(c.diagnosticsAtStart?.errors.length||0)};
  row.interrupted=row.interruptions.some(e=>['blur','fullscreenexit','hidden','resize'].includes(e.event));
  capture=null;
}
function calibration(attempt,checkpoint) {
  return trial(`${checkpoint}-calibration-${attempt}`,{type:jsPsychWebgazerCalibrate,
    // The eight peripheral targets are revisited once per round, reshuffled each round:
    // consecutive clicks on one target share a head pose and a single fixation, so they add
    // almost nothing to a 120-feature ridge fit, while separate visits do.
    // The centre is then trained last, five times in a row. That is not an accuracy choice; it
    // mirrors Brown's own www/js/calibration.js, which reveals Pt5 only after the other eight
    // are finished and then measures the centre immediately. brownCheck replicates that
    // measurement, so it has to replicate its training order. The consequence is that the centre
    // score is biased in the centre's favour; the five-point validation is the unbiased number.
    calibration_points:[
      ...Array.from({length:CONFIG.calibration.repetitions},
        ()=>shuffle(CONFIG.calibration.points.filter(([x,y])=>x!==50||y!==50))).flat(),
      ...Array.from({length:CONFIG.calibration.repetitions},()=>[50,50])],
    repetitions_per_point:1,
    randomize_calibration_order:false,calibration_mode:'click',
    time_to_saccade:CONFIG.calibration.trainingSettleMs,minimum_click_interval:CONFIG.calibration.trainingClickIntervalMs,maximum_feature_age:CONFIG.calibration.trainingMaximumFeatureAgeMs,
    on_start:()=>{ext().resetCalibration();ext().showPredictions();ext().stopMouseCalibration();},
    on_finish:r=>{r.clicks=r.calibration_clicks;r.expected_clicks=9*CONFIG.calibration.repetitions;r.click_count_pass=r.clicks.length===r.expected_clicks&&r.clicks.every(c=>c.accepted);},
    data:{task:'calibration',attempt,checkpoint}});
}
function validation(attempt,checkpoint) {
  let started,removeFeedback;
  return trial(`${checkpoint}-validation-${attempt}`,{type:jsPsychWebgazerValidate,
    validation_points:CONFIG.calibration.validationPoints,roi_radius:CONFIG.calibration.radiusPx,
    time_to_saccade:CONFIG.calibration.settleMs,validation_duration:CONFIG.calibration.durationMs,
    randomize_validation_order:false,show_validation_data:false,
    on_start:()=>{
      started=performance.now();
      ext().pause();ext().showPredictions();ext().hideVideo();ext().stopMouseCalibration();
      removeFeedback=showValidationFeedback(ext());
    },
    data:{task:'validation',attempt,checkpoint,gaze_feedback_visible:true,validation_context:'visible-prediction-feedback'},on_finish:r=>{
      removeFeedback?.();
      r.verdict=evaluateValidation(r,CONFIG.calibration);
      r.sampling_diagnostics=structuredClone(ext().sampleDiagnostics||{errors:[]});
      if(r.sampling_diagnostics.errors.length){r.verdict.pass=false;r.verdict.failed.push('prediction-errors');}
      r.interruptions=session.interactions.filter(e=>e.performance_ms>=started&&['blur','hidden','resize','fullscreenexit'].includes(e.event));
      if(r.interruptions.length){r.verdict.pass=false;r.verdict.failed.push('interrupted');}
      session.latestValidation=r.verdict;
      r.viewport={width:innerWidth,height:innerHeight};
      if(checkpoint==='final')session.finalValidationPass=r.verdict.pass;
    }});
}
function brownCheck(attempt,checkpoint) {
  let points,unsubscribe,started,viewport,bounds,removeFeedback;
  return trial(`${checkpoint}-brown-${attempt}`,{type:jsPsychHtmlKeyboardResponse,
    stimulus:'<div id="fixation" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);font-size:32px;color:#222">+</div>',
    choices:'NO_KEYS',trial_duration:CONFIG.calibration.brownMeasurementMs,
    data:{task:'brown-measurement',attempt,checkpoint},on_load:()=>{
      points=[];started=performance.now();viewport={width:innerWidth,height:innerHeight};
      bounds={width:Math.max(document.documentElement.clientWidth,innerWidth),height:Math.max(document.documentElement.clientHeight,innerHeight)};
      ext().pause();ext().showPredictions();ext().hideVideo();ext().stopMouseCalibration();
      removeFeedback=showValidationFeedback(ext());
      // The fork refreshes camera frames in getCurrentPrediction while paused.
      // Keep its background loop paused: only the extension owns measurement sampling.
      unsubscribe=ext().onGazeUpdate(p=>points.push({...p,prediction_request_performance_ms:p.t,t:performance.now()-started}));ext().startSampleInterval();
    },on_finish:r=>{ext().stopSampleInterval();unsubscribe();removeFeedback?.();r.raw_predictions=points;
      r.measurement=brownMeasurement(points,viewport,bounds);
      r.interruptions=session.interactions.filter(e=>e.performance_ms>=started&&['blur','hidden','resize','fullscreenexit'].includes(e.event));
      r.pass=brownPass(r.measurement,CONFIG.calibration.brownMinimumScore,r.interruptions);
      r.sampling_diagnostics=structuredClone(ext().sampleDiagnostics);
      if(r.sampling_diagnostics.errors.length)r.pass=false;
      r.threshold_policy=`score >= ${CONFIG.calibration.brownMinimumScore} is this study policy, not a Brown universal threshold`;session.latestBrown=r;
    }});
}
const trackingPass=()=>!!session.latestValidation?.pass&&!!session.latestBrown?.pass;
function calibrationSequence(checkpoint,initial=false) {
  const list=[];
  if(initial)list.push(ready('calibration-instructions','Calibration',
    '<p>A dot will appear on the screen. Look directly at it, then click it once. Wait for each new dot and look at it before you click. There are 45 dots in all; for the last five the dot stays in the centre. Keep your eyes on the target, not the moving prediction dot. Keep your head and seating position steady throughout.</p>'),calibration(1,checkpoint));
  list.push(ready(`${checkpoint}-validation-instructions`,'Check the eye tracker',
    '<p>First look at the center + for five seconds, then at each dark target dot until it disappears. The red dot shows the tracker prediction; keep looking at the dark target, not the red dot. Do not click.</p>'),brownCheck(1,checkpoint),validation(1,checkpoint));
  // Calibration and validation are measurements, not a gate. They run once, every number is
  // recorded, and nothing here stops the session. Dropping low-accuracy trials is an
  // analysis-stage decision taken from these numbers, not a collection-stage decision taken
  // here, so there are no recalibration retries and no score comparison that can halt the flow.
  list.push(trial(`${checkpoint}-gate`,{type:jsPsychHtmlButtonResponse,
    stimulus:()=>{
      const score=session.latestBrown?.measurement.score;
      const error=session.latestBrown?.measurement.diagnostics?.mean_error_px;
      const accuracy=session.latestValidation?.accuracy;
      const reference=CONFIG.calibration.brownMinimumScore;
      const px=n=>Number.isFinite(n)?`${Math.round(n)} px`:'unavailable';
      return markup('Eye tracker measured',
        `<p>Five-point accuracy: <strong>${px(accuracy?.mean_offset_px)}</strong> `
        +`(mean distance of the average gaze from each target). `
        +`Precision: ${px(accuracy?.mean_precision_rms_px)} (spread around the gaze cloud).</p>`
        +`<p>Centre measurement: <strong>${score ?? 'unavailable'}%</strong>`
        +`${Number.isFinite(error)?` (mean ${Math.round(error)} px from the centre)`:''}. `
        +`Five-point reference: ${session.latestValidation?.pass?'every target met the reference criteria':'not every target met the reference criteria'}.</p>`
        +`<p>For reference only, this study records ${reference}% as its comparison level; `
        +`${Number.isFinite(score)&&score>=reference?'this measurement is at or above it':'this measurement is below it'}. `
        +`The session continues either way and both numbers are saved with your data.</p>`
        // Only worth showing when it names something actionable; on a pass it just repeats
        // the closing sentence below.
        +`<p>${session.latestValidation&&!session.latestValidation.pass?coaching(session.latestValidation)+' ':''}`
        +`Keep the same seating position and lighting from here on.</p>`);
    },
    choices:['Continue'],on_start:()=>{
      if(initial)session.initialValidationPass=trackingPass();
      if(checkpoint==='final')session.finalValidationPass=trackingPass();
    },
    on_finish:r=>{r.gate_enforced=false;r.reference_thresholds_met=trackingPass();
      r.brown_score=session.latestBrown?.measurement.score??null;
      r.validation_pass=session.latestValidation?.pass??null;
      r.accuracy_mean_offset_px=session.latestValidation?.accuracy?.mean_offset_px??null;
      r.precision_rms_px=session.latestValidation?.accuracy?.mean_precision_rms_px??null;
      r.policy='measured-and-recorded; no score stops the session';},
    data:{task:'validation-gate',checkpoint}}));return list.map((step,i)=>active(`${checkpoint}-calibration-step-${i}`,[step]));
}
function fixation(item,id) {
  let c,target,limit;
  return trial(id,{type:jsPsychHtmlKeyboardResponse,
    stimulus:`<div id="stage" class="stimulus-stage fixation-stage"><span id="fixation">X</span></div>`,
    choices:'NO_KEYS',trial_duration:CONFIG.timing.fixationMs,extensions:gazeExtension(),
    data:{task:'fixation',item_id:item.id,layout},on_load:()=>{
      c=startCapture(item);const r=rectOf(document.querySelector('#fixation'));target={x:r.left+r.width/2,y:r.top+r.height/2};limit=c.geometry.separationPx/2;
    },on_finish:r=>{finishCapture(r,c);r.drift=estimateDrift(r.webgazer_data,target,r.capture_duration_ms,CONFIG.drift,limit);r.drift.viewport=r.viewport;if(r.interrupted||r.sampling_diagnostics.errors?.length){r.drift.applied=false;r.drift.excluded=true;r.drift.reasons.push('interrupted-or-failed-fixation');}session.latestDrift=r.drift;}});
}
function videoTrial(item,id) {
  let c,playback,watch;
  return trial(id,{type:jsPsychHtmlKeyboardResponse,stimulus:`<div class="scenario-label">Scenario ${assignment.items.find(a=>a.id===item.id).position} of 4</div>${stageHtml(item,layout,true)}`,choices:'NO_KEYS',extensions:gazeExtension(),
    data:{task:'video',item_id:item.id,layout,video_file:item.video,expected_duration_ms:item.durationMs,fps:item.fps},
    on_load:()=>{beginScenario(item);const v=document.querySelector('#event-video');c=startCapture(item,{video:v,referents:false});
      // Defer play until the extension has established its own time origin.
      queueMicrotask(()=>{watch=observeVideo(v,{timeoutMs:CONFIG.timing.videoTimeoutMs,onDone:log=>{playback=log;jsPsych.finishTrial();}});});},
    on_finish:r=>{finishCapture(r,c);r.video_timing=playback||watch?.log;
      const log=r.video_timing;
      log.playing_from_gaze_origin_ms=log.first_playing_ms===null?null:log.first_playing_ms-r.gaze_origin_performance_ms;
      log.ended_from_gaze_origin_ms=log.ended_ms===null?null:log.ended_ms-r.gaze_origin_performance_ms;
      r.playback_pass=log.finish_reason==='ended'&&Number.isFinite(log.media_duration_s)&&Math.abs(log.media_duration_s*1000-item.durationMs)<1;
      r.playback_flags=[...(log.events.some(e=>['waiting','stalled'].includes(e.event)&&e.performance_ms>log.first_playing_ms)?['buffering']:[]),
        ...(log.dropped_frames>0?['dropped-frames']:[]),...(Math.abs((log.wall_playback_ms||0)-item.durationMs)>1000/item.fps?['wall-time-outside-one-frame']:[])];
      r.analysis=analyzeTrial(r,CONFIG.analysis);if(!r.playback_pass)stop(`video-${log.finish_reason}`);
    }});
}
function preview(item,id) {let c;return trial(id,{type:jsPsychHtmlKeyboardResponse,stimulus:stageHtml(item,layout),choices:'NO_KEYS',
  trial_duration:CONFIG.timing.previewMs,extensions:gazeExtension(),data:{task:'preview',item_id:item.id,layout},
  on_load:()=>{c=startCapture(item,{drift:session.latestDrift});},on_finish:r=>{finishCapture(r,c);r.analysis=analyzeTrial(r,CONFIG.analysis);}});}
function audioTrial(item,condition,probe,id) {
  let c,a,observer,timer,watchdog,timing,ended=false;
  const asset=item.audio[condition];
  return trial(id,{type:jsPsychHtmlKeyboardResponse,stimulus:stageHtml(item,layout),choices:'NO_KEYS',extensions:gazeExtension(),
    data:{task:'audio-gaze',item_id:item.id,condition,probe_index:probe,layout,audio_file:asset.file,
      spoken_text:asset.spoken,word_onset_ms:asset.wordOnsetMs,word_onset_verified:asset.onsetVerified,
      word_onsets_ms:asset.wordOnsetsMs,word_onset_source:asset.wordOnsetSource,
      audio_provenance:asset.provenance,delivery_modality:'isolated-verb-phrase'},
    on_load:()=>{
      c=startCapture(item,{drift:session.latestDrift});a=new Audio(asset.file);
      timing={play_request_performance_ms:null,first_playing_performance_ms:null,error:null,
        acoustic_onset_verified:false,clock:'HTMLMediaElement playing event; physical sound onset unknown'};
      const end=()=>{if(ended)return;ended=true;jsPsych.finishTrial();};
      observer=observeAudio(a,e=>{
        if(e.event==='playing'&&timing.first_playing_performance_ms===null){
          timing.first_playing_performance_ms=e.performance_ms;clearTimeout(watchdog);timer=setTimeout(end,CONFIG.timing.gazeMs);
        }
        if(e.event==='error'){timing.error={code:a.error?.code,message:a.error?.message};stop('audio-error');end();}
      });
      watchdog=setTimeout(()=>{timing.error={message:'Audio did not start within 10 seconds'};stop('audio-timeout');end();},10000);
      queueMicrotask(()=>{timing.play_request_performance_ms=performance.now();a.play().catch(e=>{timing.error={name:e.name,message:e.message};stop('audio-play-rejected');end();});});
    },on_finish:r=>{
      clearTimeout(timer);clearTimeout(watchdog);observer.cleanup();finishCapture(r,c);
      timing.events=observer.events;timing.media_duration_s=Number.isFinite(a.duration)?a.duration:null;
      timing.playing_from_gaze_origin_ms=timing.first_playing_performance_ms===null?null:timing.first_playing_performance_ms-r.gaze_origin_performance_ms;
      timing.ended=observer.events.some(e=>e.event==='ended');
      timing.buffering=observer.events.some(e=>['waiting','stalled'].includes(e.event)&&e.performance_ms>timing.first_playing_performance_ms);
      r.audio_timing=timing;r.playback_pass=timing.ended&&!timing.error;
      r.playback_flags=timing.buffering?['buffering']:[];a.pause();
      if(!r.playback_pass)stop('audio-incomplete');r.analysis=analyzeTrial(r,CONFIG.analysis);
    }});
}
function choice(item,condition,probe,id){let c;const options=shuffle(['distal','proximal']);return trial(id,{type:jsPsychHtmlButtonResponse,
  stimulus:markup(condition==='thin'?item.thinQuestion:item.thickQuestion,'<p>Choose one.</p>'),choices:options.map(k=>`The ${item[k]}`),
  data:{task:'choice',item_id:item.id,condition,probe_index:probe,choice_order:options,
    question_text:condition==='thin'?item.thinQuestion:item.thickQuestion,choice_labels:options.map(k=>`The ${item[k]}`)},
  extensions:gazeExtension(),on_load:()=>{c=startCapture(null);},on_finish:r=>{finishCapture(r,c);r.selected_role=options[r.response]??null;}});}
function select(name,label,options){return `<p><label>${label}<select required name="${name}"><option value="">Choose one</option>${options.map(o=>`<option>${o}</option>`).join('')}</select></label></p>`;}
function feedbackExposure(){return {
  calibration_clarity:rows.some(r=>r.task==='calibration'),
  video_naturalness:rows.some(r=>r.task==='video'&&r.video_timing?.first_playing_ms!==null&&Number.isFinite(r.video_timing?.first_playing_ms)),
  audio_difficulty:rows.some(r=>r.task==='audio-gaze'&&Number.isFinite(r.audio_timing?.first_playing_performance_ms))};}
function rating(name,label,low,high,experienced=true){
  return experienced?select(name,`${label} (1 = ${low}; 7 = ${high})`,['1','2','3','4','5','6','7']):
    `<p>${label}: Not applicable — this stage was not presented.</p><input type="hidden" name="${name}" value="">`;
}

function audioCheck(attempt) {let soundEvents=[],soundFinished=false,soundError=null;return trial(`audio-check-${attempt}`,{type:jsPsychSurveyHtmlForm,
  html:`<h2>Check your sound</h2><p>Play the sound, then select the word you heard. Adjust the volume to a comfortable level.</p><audio id="sound-check" controls src="assets/audio/speech-check.wav"></audio>
    ${select('heard','Word heard',['apple','river','seven','I could not hear it'])}`,
  button_label:'Check',data:{task:'audio-check',attempt,audio_file:'assets/audio/speech-check.wav',audio_provenance:'macOS-Samantha-neutral-seven-2026-10-02'},on_load:()=>{
    const a=document.querySelector('#sound-check');
    a.addEventListener('ended',()=>{soundFinished=true;});
    for(const event of ['playing','ended','seeking','error'])a.addEventListener(event,()=>soundEvents.push({event,performance_ms:performance.now(),media_time_s:a.currentTime}));
    a.addEventListener('error',()=>{soundError={code:a.error?.code??null,message:a.error?.message||'Sound check playback failed'};jsPsych.finishTrial({response:{heard:'I could not hear it'}});},{once:true});
    document.querySelector('#jspsych-survey-html-form-next').disabled=true;
    a.addEventListener('ended',()=>{document.querySelector('#jspsych-survey-html-form-next').disabled=false;});
  },on_finish:r=>{r.sound_check={ended:soundFinished,error:soundError,events:soundEvents};r.audio_check_pass=r.response.heard==='seven'&&soundFinished&&!soundError&&!soundEvents.some(e=>e.event==='seeking');session.audioPass=r.audio_check_pass;}});}

function buildTimeline(){const timeline=[];
  timeline.push(ready('welcome','Pilot Sessions','<p>You will watch four silent events. After each, you will hear two phrases, one at a time, and answer a question after each phrase.</p>'));
  if(!researcherPreview)timeline.push(trial('browser-check',{type:jsPsychBrowserCheck,minimum_width:CONFIG.screen.minimumWidth,minimum_height:CONFIG.screen.minimumHeight,
    inclusion_function:d=>!d.mobile&&d.browser==='chrome'&&d.webcam,
    exclusion_message:'<p>This pilot needs desktop Chrome, a webcam, and a window at least 1280 × 720 pixels.</p>',
    on_finish:r=>{if(r.mobile||r.browser!=='chrome'||!r.webcam)stop('browser-requirements');}}));
  timeline.push(trial('fullscreen',{type:jsPsychFullscreen,fullscreen_mode:true}));
  timeline.push(trial('preload',{type:jsPsychPreload,images:ITEMS.map(i=>i.tableau),video:ITEMS.map(i=>i.video),
    audio:[...ITEMS.flatMap(i=>Object.values(i.audio).map(a=>a.file)),'assets/audio/speech-check.wav'],
    continue_after_error:true,max_load_time:30000,on_finish:r=>{if(!r.success)stop('preload-failed');}}));
  timeline.push(active('setup-block',[
    trial('setup-questionnaire',{type:jsPsychSurveyHtmlForm,html:markup('Your setup',
      select('vision','Vision',['Normal without correction','Corrected to normal','Other vision difficulty','Prefer not to say'])+
      select('eyewear','Wearing now',['None','Glasses','Contact lenses','Prefer not to say'])+
      select('camera_type','Camera',['Built-in','External','Unsure'])+
      select('natural_light','Natural light in the room',['Yes','No','Unsure'])+
      select('light_direction','Main light direction',['In front','Side','Behind','Overhead','Unsure'])+
      '<p><label>Estimated camera distance in centimeters (optional)<input type="number" name="distance_cm" min="10" max="200"></label></p>'+
      select('audio_device','Audio output',['Wired headphones','Bluetooth headphones','Built-in speakers','External speakers','Other'])+
      rating('lighting_setup','Lighting quality','Very poor','Very good')),button_label:'Continue'}),
    trial('glasses-notice',{type:jsPsychHtmlButtonResponse,stimulus:`<section class="glasses-notice"><p>If you are wearing glasses, please take off your glasses during the experiment if this does not significantly affect your vision.</p><p>Thank you.</p></section>`,choices:['Continue']}),
    audioCheck(1),branch('retry-audio',()=>!session.audioPass,[ready('audio-coaching','Adjust your sound','<p>Check your volume and audio output. Listen to the whole sound before answering.</p>'),audioCheck(2)]),
    trial('audio-gate',{type:jsPsychHtmlKeyboardResponse,stimulus:'',choices:'NO_KEYS',trial_duration:1,on_finish:()=>{if(!session.audioPass)stop('audio-check-failed');}}),
  ]));
  if(!researcherPreview)timeline.push(active('camera-and-calibration',[
    ready('camera-instructions','Camera setup','<p>Keep your eyes visible, face an even light source, reduce glare, and sit comfortably about an arm’s length away. Keep the same position after calibration. Close unused applications and tabs.</p>'),
    trial('camera-init',{type:jsPsychWebgazerInitCamera,on_finish:r=>{
      if(r.camera_error)stop('camera-start-failed');
      const track=document.querySelector('#webgazerVideoFeed')?.srcObject?.getVideoTracks()[0];
      const settings=track?.getSettings?.()||{};
      session.environment.camera={width:settings.width??null,height:settings.height??null,reported_frame_rate:settings.frameRate??null};
    }}),...calibrationSequence('initial',true),
  ]));
  timeline.push(active('task-instructions-block',[ready('task-instructions','Watch and listen','<p>Watch each silent event. Then look at the X until it disappears. A picture will appear while you hear a phrase. Look naturally at the picture; no response is needed during the sound. Next, answer the written question.</p><p>The second phrase refers to the same event. Keep your head still and take a break only between blocks.</p>')]));
  itemOrder.forEach((item,i)=>{
    const group=[videoTrial(item,`${item.id}-video`)];
    session.requiredIds.push(`${item.id}-video`);
    session.assignment.items[i].conditions.forEach((condition,p)=>{
      const prefix=`${item.id}-${condition}`;
      const ids=['fixation','preview','audio','choice'].map(s=>`${prefix}-${s}`);session.requiredIds.push(...ids);
      group.push(active(`${prefix}-probe`,[fixation(item,ids[0]),preview(item,ids[1]),audioTrial(item,condition,p+1,ids[2]),
        active(`${prefix}-choice-block`,[choice(item,condition,p+1,ids[3])])]));
    });timeline.push({...active(`${item.id}-block`,group),on_timeline_finish:endScenario});
  });
  timeline.push(trial('feedback',{type:jsPsychSurveyHtmlForm,html:()=>markup('Feedback',
    '<p><label>Age<input name="age" type="number" min="18" max="110" required></label></p>'+
    select('english_background','English background',['Native speaker','Near-native','Additional language'])+
    '<p><label>Major or field of study<input name="major" required></label></p>'+
    select('phone','Looked at a phone during the task',['Never','Once','More than once','Not applicable'])+
    select('moved_away','Moved away from the camera',['Never','Once','More than once','Not applicable'])+
    select('distractions','Distractions during the task',['None','Some','Frequent','Not applicable'])+
    rating('lighting','Lighting quality during the experiment','Very poor','Very good')+
    rating('calibration_clarity','Calibration instructions','Very unclear','Very clear',feedbackExposure().calibration_clarity)+
    rating('video_naturalness','Video naturalness','Very unnatural','Very natural',feedbackExposure().video_naturalness)+
    rating('audio_difficulty','How difficult was the audio to hear?','Not at all difficult','Extremely difficult',feedbackExposure().audio_difficulty)+
    '<p><label>Suggestions or technical problems<textarea name="suggestions" rows="4"></textarea></label></p>'),button_label:'Finish',on_finish:r=>{r.feedback_exposure=feedbackExposure();for(const [key,seen]of Object.entries(r.feedback_exposure))if(!seen)r.response[key]=null;}}));
  timeline.push(ready('debrief','Thank you',()=>session.stopReason
    ?'<p>The technical checks did not all pass. Your diagnostic data will be saved when you select Finish.</p>'
    :'<p>The pilot is complete. Select Finish to save your results, then give the downloaded JSON file to the researcher.</p>','Finish'));
  session.requiredIds.push('welcome','fullscreen','preload','setup-questionnaire','glasses-notice','audio-gate','feedback','debrief');
  if(!researcherPreview)session.requiredIds.push('browser-check','camera-init','initial-gate');
  return timeline;
}

const jsPsych=initJsPsych({display_element:'jspsych-target',show_progress_bar:false,
  extensions:researcherPreview?[]:[{type:jsPsychExtensionWebgazer,params:{round_predictions:false,sampling_interval:34}}],
  on_trial_finish:r=>{
    if(r.item_id){r.item_position=assignment.items.find(a=>a.id===r.item_id)?.position;
      const match=r.logical_id.match(/-(thin|thick)-/);if(match){r.condition=match[1];r.probe_id=`${session.id}:${r.item_id}:${match[1]}`;}}
    if(typeof r.stimulus==='string'&&r.stimulus.includes('<'))delete r.stimulus;
    rows=jsPsych.data.get().values();journal.checkpoint(rows);
  },on_interaction_data_update:r=>session.interactions.push({...r,performance_ms:performance.now()}),
  on_finish:async()=>{
    const root=document.querySelector('#jspsych-target');
    clearGazeChrome();
    if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});
    root.innerHTML=markup('Results ready','<p>Saving your results…</p>');
    try{
      trackerOff();
      rows=jsPsych.data.get().values();await journal.checkpoint(rows);const result=await journal.flush();
      const payload=makePayload(session,rows,CONFIG,{local_journal:result,download_status:'requested; browser cannot verify disk receipt'});
      const filename=`${researcherPreview?'preview':'causal-gaze'}-${session.id}.json`;
      root.innerHTML=markup('Results ready',`<p>${result.ok?'A recovery copy is saved in this browser.':'Browser recovery failed; download the results now.'} Download the JSON and give it to the researcher.</p><button id="download">Download results</button><p><a href="recovery.html">Open saved sessions</a></p>`);
      document.querySelector('#download').onclick=()=>download(payload,filename);download(payload,filename);
    }catch(error){
      console.error(error);
      root.innerHTML=markup('Results ready',`<p>The results page could not finish saving. <a href="recovery.html">Open saved sessions</a>.</p>`);
    }
  }});
jsPsych.data.addProperties({session_id:session.id,study_version:CONFIG.version,schema_version:CONFIG.schema});
document.addEventListener('visibilitychange',()=>session.interactions.push({event:document.hidden?'hidden':'visible',performance_ms:performance.now()}));
window.addEventListener('resize',()=>session.interactions.push({event:'resize',width:innerWidth,height:innerHeight,performance_ms:performance.now()}));
window.addEventListener('pagehide',()=>{trackerOff();checkpointCapture();});
// This fork uses a window flag rather than Brown v3's saveDataAcrossSessions API.
window.saveDataAcrossSessions=false;
try {session.manifest=await fetch('build-manifest.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Missing build manifest');return r.json();});
  // Expose browser audio-output estimates without calling them physical onset measurements.
  audioContext=jsPsych.pluginAPI.audioContext();
  session.environment.audio={base_latency_s:audioContext?.baseLatency??null,output_latency_s:audioContext?.outputLatency??null};
  await jsPsych.run(buildTimeline());
} catch(error) {
  trackerOff();stop('initialization-error');session.error=String(error);await journal.checkpoint(rows);
  document.querySelector('#jspsych-target').innerHTML=markup('Unable to start','<p>The study could not initialize. Check the browser console and local files. <a href="recovery.html">Recover saved data</a>.</p>');console.error(error);
}
