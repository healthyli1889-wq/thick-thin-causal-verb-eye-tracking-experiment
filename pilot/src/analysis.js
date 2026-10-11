import {mean,validSample} from './quality.js';
const inside=(p,r)=>p.x>=r.left&&p.x<r.right&&p.y>=r.top&&p.y<r.bottom;
const sd=a=>a.length>1 ? Math.sqrt(a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1)) : null;
export function label(p,geo,viewport,drift=null) {
  if(!validSample(p)) return 'invalid';
  if(!viewport||!(viewport.width>0)||!(viewport.height>0))return 'unannotated';
  if(p.x<0||p.x>=viewport.width||p.y<0||p.y>=viewport.height) return 'offscreen';
  if(!geo) return 'unannotated';
  // Keep physical screen bounds fixed; translate only the stimulus AOIs.
  const q={...p,x:p.x-(drift?.applied?drift.dx:0),y:p.y-(drift?.applied?drift.dy:0)};
  if(!inside(q,geo.stage)) return 'offstage';
  return geo.regions.find(r=>inside(q,r))?.role || 'other';
}
export function sampleRows(row) {
  const samples=(row.webgazer_data||[]);
  return samples.map((p,i)=>{
    const previous=samples[i-1],valid=validSample(p),pairValid=valid&&validSample(previous),dt=pairValid?p.t-previous.t:null;
    const dx=pairValid?p.x-previous.x:null,dy=pairValid?p.y-previous.y:null;
    const audioOffset=row.audio_timing?.playing_from_gaze_origin_ms;
    const onset=row.word_onset_ms;
    const stage=row.geometry?.stage||row.stage_rect;
    const correctedX=valid&&row.drift?.applied?p.x-row.drift.dx:null;
    const correctedY=valid&&row.drift?.applied?p.y-row.drift.dy:null;
    const nx=valid&&stage?(p.x-stage.left)/stage.width:null;
    const base={sample_index:i,viewport_valid:!!row.viewport&&row.viewport.width>0&&row.viewport.height>0,sample_valid:!!validSample(p),timestamp_order_valid:validSample(p)&&p.t>=0&&(!previous||p.t>previous.t),probe_id:row.probe_id,session_id:row.session_id,logical_id:row.logical_id,trial_index:row.trial_index,
      task:row.task,item_id:row.item_id,condition:row.condition,probe_index:row.probe_index,
      layout:row.layout,t_ms:p.t,x_px:p.x,y_px:p.y,dx_px:dx,dy_px:dy,dt_ms:dt,
      speed_px_s:dt>0?Math.hypot(dx,dy)/dt*1000:null,
      x_corrected_px:correctedX,y_corrected_px:correctedY,
      x_stage:nx,y_stage:valid&&stage?(p.y-stage.top)/stage.height:null,
      x_signed_distal:valid&&row.geometry?.centers?.length===2?2*(p.x-row.geometry.midpoint.x)/(row.geometry.centers[0].x-row.geometry.centers[1].x):null,
      aoi_raw:label(p,row.geometry,row.viewport),
      aoi_corrected:row.drift?.applied?label(p,row.geometry,row.viewport,row.drift):null,
      audio_relative_ms:Number.isFinite(p.t)&&Number.isFinite(audioOffset)?p.t-audioOffset:null,
      word_relative_ms:Number.isFinite(p.t)&&row.word_onset_verified&&Number.isFinite(audioOffset)&&Number.isFinite(onset)?p.t-audioOffset-onset:null,
      // Callback receipt media time, not a camera-frame synchronization claim.
      video_media_time_at_receipt_s:p.video_media_time_at_receipt_s ?? null,
      callback_performance_ms:p.callback_performance_ms ?? null,
      inference_duration_ms:p.inference_duration_ms ?? null,
      video_paused_at_receipt:p.video_paused_at_receipt ?? null};
    return base;
  });
}
export function summarizeWindow(row,start,end,config,corrected=false) {
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start) return {available:false,reason:'missing-window-timing'};
  if(corrected&&!row.drift?.applied) return {available:false,reason:'drift-check-failed-or-absent'};
  const raw=sampleRows(row), all=raw.filter(p=>p.sample_valid&&p.timestamp_order_valid), samples=all.filter(p=>p.t_ms>=start&&p.t_ms<end);
  const flags=[...(raw.some(p=>!p.sample_valid||!p.timestamp_order_valid)?['invalid-or-unordered-samples']:[]),...(row.interrupted?['interrupted']:[]),...(row.playback_pass===false?['playback-failed']:[]),...(row.playback_flags||[]),...(row.drift&&!row.drift.applied?['drift-check-failed']:[]),...(row.sampling_diagnostics?.errors?.length?['prediction-errors']:[])];
  const dwell={distal:0,proximal:0,other:0,offstage:0,offscreen:0,unannotated:0,missing:0};
  let covered=0,weightedX=0,weightedY=0;
  const key=corrected?'aoi_corrected':'aoi_raw';
  // Forward hold capped at 100 ms. Never bridge a long loss of tracking.
  raw.forEach((p,index)=>{
    if(!p.sample_valid||!p.timestamp_order_valid)return;
    // An explicitly invalid next prediction ends the previous observation;
    // dropping it first would falsely fill that tracking loss with dwell.
    const next=Number.isFinite(raw[index+1]?.t_ms)?raw[index+1].t_ms:p.t_ms;
    const dt=Math.max(0,Math.min(next,end,p.t_ms+config.maximumSampleHoldMs)-Math.max(start,p.t_ms));
    const role=p[key] || 'other'; dwell[role]=(dwell[role]||0)+dt;
    covered+=dt;weightedX+=dt*(corrected?p.x_corrected_px:p.x_px);weightedY+=dt*(corrected?p.y_corrected_px:p.y_px);
  });
  const duration=end-start; dwell.missing=Math.max(0,duration-covered);
  const roles=dwell.distal+dwell.proximal;
  const hz=samples.length/(duration/1000), missing=dwell.missing/duration;
  const offscreen=covered?dwell.offscreen/covered:null;
  const lastBefore=all.filter(p=>p.t_ms<start).at(-1);
  const baseline=lastBefore && start-lastBefore.t_ms<=config.maximumSampleHoldMs ? lastBefore[key] : null;
  // A shift requires observed prior occupancy outside that target, three samples,
  // and <=100 ms gaps. Starting inside an AOI is not a zero-latency shift.
  const firstShift={};
  for(const role of ['distal','proximal']) {
    let shift=null,gap=false,previousTime=lastBefore?.t_ms;
    if(baseline && baseline!==role) for(let i=0;i<samples.length-2;i++) {
      const trio=samples.slice(i,i+3);
      if(trio[0].t_ms-previousTime>config.maximumSampleHoldMs||raw.some(p=>!p.sample_valid&&(!Number.isFinite(p.t_ms)||(p.t_ms>=lastBefore.t_ms&&p.t_ms<=trio[2].t_ms)))){gap=true;break;}
      previousTime=trio[0].t_ms;
      if(trio.every(p=>p[key]===role)&&trio[1].t_ms-trio[0].t_ms<=config.maximumSampleHoldMs&&trio[2].t_ms-trio[1].t_ms<=config.maximumSampleHoldMs) {shift=trio[0].t_ms-start;break;}
    }
    firstShift[role]={latency_ms:shift,eligible:!!baseline&&baseline!==role&&!gap,baseline_aoi:baseline,observation_gap:gap};
  }
  return {available:true,start_ms:start,end_ms:end,n:samples.length,hz,dwell_ms:dwell,
    dwell_fraction:Object.fromEntries(Object.entries(dwell).map(([k,v])=>[k,v/duration])),
    distal_preference_among_referents:roles?dwell.distal/roles:null,
    distal_minus_proximal_fraction:(dwell.distal-dwell.proximal)/duration,
    missing_fraction:missing,offscreen_fraction:offscreen,
    quality_flags:flags,quality_pass:flags.length===0&&hz>=config.minimumHz&&missing<=config.maximumMissingFraction&&offscreen!==null&&offscreen<=config.maximumOffscreenFraction,
    centroid:{x:mean(samples.map(p=>corrected?p.x_corrected_px:p.x_px)),y:mean(samples.map(p=>corrected?p.y_corrected_px:p.y_px)),
      sd_x:sd(samples.map(p=>p.x_px)),sd_y:sd(samples.map(p=>p.y_px)),
      time_weighted_x:covered?weightedX/covered:null,time_weighted_y:covered?weightedY/covered:null},
    first_shift:firstShift,corrected,geometry_validated:row.geometry?.validated===true,
    interpretation:row.geometry?'exploratory-spatial-side-occupancy':'gaze-only-no-object-AOIs'};
}
export function analyzeTrial(row,config) {
  const extent=row.capture_duration_ms;
  const onset=row.audio_timing?.playing_from_gaze_origin_ms;
  const verified=row.word_onset_verified && Number.isFinite(row.word_onset_ms);
  const primary=verified&&Number.isFinite(onset)?[onset+row.word_onset_ms+config.wordWindowStartMs,onset+row.word_onset_ms+config.wordWindowEndMs]:null;
  const phaseWindow=row.task==='video'?[row.video_timing?.playing_from_gaze_origin_ms,row.video_timing?.ended_from_gaze_origin_ms]:[0,extent];
  const bins=[];
  for(let t=0; t+config.binMs<=extent; t+=config.binMs) bins.push(summarizeWindow(row,t,t+config.binMs,config));
  return {phase:summarizeWindow(row,...phaseWindow,config),
    corrected_phase:row.geometry?summarizeWindow(row,...phaseWindow,config,true):null,
    word_window:primary&&primary[1]<=extent?summarizeWindow(row,...primary,config):{available:false,reason:verified?'word-window-not-fully-recorded':'word-onset-not-verified'},
    corrected_word_window:primary&&primary[1]<=extent?summarizeWindow(row,...primary,config,true):{available:false,reason:'verified-complete-word-window-required'},
    bins,tracker_lag_correction_ms:null};
}
