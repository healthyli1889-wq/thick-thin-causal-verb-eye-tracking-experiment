export const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
export function median(a) { const b=[...a].sort((x,y)=>x-y); return b.length ? (b[Math.floor((b.length-1)/2)]+b[Math.floor(b.length/2)])/2 : null; }
export const mad = a => { const m=median(a); return m === null ? null : median(a.map(x=>Math.abs(x-m))); };
export const validSample = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.t);

export function evaluateValidation(row, config) {
  const n=config.validationPoints.length;
  const raw=row?.raw_gaze || [], pct=row?.percent_in_roi || [];
  const perPoint=Array.from({length:n},(_,i)=>{
    const samples=(raw[i] || []).filter(p=>validSample(p)&&Number.isFinite(p.dx)&&Number.isFinite(p.dy));
    const hitPercent=samples.length ? 100*samples.filter(p=>Math.hypot(p.dx,p.dy)<=config.radiusPx).length/samples.length : null;
    const meanDx=mean(samples.map(p=>p.dx)),meanDy=mean(samples.map(p=>p.dy));
    // Accuracy is how far the average gaze sits from the target. average_offset.r in the
    // validation plugin is the median distance from the gaze centroid, which is precision.
    const accuracyOffsetPx=meanDx===null||meanDy===null?null:Math.hypot(meanDx,meanDy);
    const precisionRmsPx=meanDx===null?null:Math.sqrt(mean(samples.map(p=>{const dx=p.dx-meanDx,dy=p.dy-meanDy;return dx*dx+dy*dy;})));
    return { index:i, timestamps_valid:samples.every((p,j)=>p.t>=0&&(j===0||p.t>samples[j-1].t)), n:samples.length, hz:samples.length/(config.durationMs/1000),
      percent:hitPercent, plugin_percent:pct[i] ?? null,
      mean_dx:meanDx,mean_dy:meanDy,accuracy_offset_px:accuracyOffsetPx,precision_rms_px:precisionRmsPx,
      plugin_precision_median_px:Number.isFinite(row?.average_offset?.[i]?.r)?row.average_offset[i].r:null,
      median_error_px:median(samples.map(p=>Math.hypot(p.dx,p.dy))),
      mad_x:mad(samples.map(p=>p.dx)),mad_y:mad(samples.map(p=>p.dy)) };
  });
  const offsets=perPoint.map(p=>p.accuracy_offset_px).filter(v=>v!==null);
  const spreads=perPoint.map(p=>p.precision_rms_px).filter(v=>v!==null);
  const accuracy={
    formula:'mean over targets of hypot(mean dx, mean dy)',
    mean_offset_px:offsets.length===n?mean(offsets):null,
    per_point_offset_px:perPoint.map(p=>p.accuracy_offset_px),
    precision_formula:'root-mean-square distance of samples from that target gaze centroid',
    mean_precision_rms_px:spreads.length===n?mean(spreads):null,
  };
  const checks={all_points_present:raw.length===n && row?.validation_points?.length===n,
    every_point_in_roi:perPoint.every(p=>p.percent!==null && p.percent>=config.minimumPercent),
    every_point_sampling:perPoint.every(p=>p.hz>=config.minimumHz),
    valid_timestamps:perPoint.every(p=>p.timestamps_valid),
    all_samples_finite:raw.every(point=>point.every(p=>validSample(p)&&Number.isFinite(p.dx)&&Number.isFinite(p.dy)))};
  return {pass:Object.values(checks).every(Boolean),checks,perPoint,accuracy,
    failed:Object.keys(checks).filter(k=>!checks[k]), radius_px:config.radiusPx,
    rule:'each-point-ROI-and-sampling; study-policy, not universal accuracy'};
}
export function coaching(verdict) {
  const tips=[];
  if (!verdict.checks.every_point_sampling) tips.push('Some dots had too few gaze measurements. Close other tabs and applications, connect your laptop to power, and keep your face visible.');
  if (!verdict.checks.every_point_in_roi) tips.push('Some gaze estimates were too far from the dots. Face an even light source, reduce glare on glasses, keep your head in the same position, and look at each dot until it disappears.');
  return tips.join(' ') || 'Keep the same seating position and lighting for the next check.';
}
export function estimateDrift(samples,target,duration,config,geometryLimit=Infinity) {
  const start=duration*config.discardFraction;
  const good=samples.filter(validSample).filter(p=>p.t>=start && p.t<duration);
  const x=good.map(p=>p.x),y=good.map(p=>p.y);
  const dx=x.length ? median(x)-target.x : null, dy=y.length ? median(y)-target.y : null;
  const limit=Math.min(config.maximumBiasPx,geometryLimit);
  const hz=good.length/((duration-start)/1000);
  const reasons=[];
  if(samples.some((p,i)=>!validSample(p)||p.t<0||(i>0&&p.t<=samples[i-1].t)))reasons.push('invalid-or-unordered-fixation');
  if(hz<config.minimumHz) reasons.push('insufficient-fixation-samples');
  if(dx===null || Math.abs(dx)>limit || Math.abs(dy)>limit) reasons.push('excessive-offset');
  if(mad(x)===null || mad(x)>config.maximumMadPx || mad(y)>config.maximumMadPx) reasons.push('unstable-fixation');
  return { applied:reasons.length===0, excluded:reasons.length>0,reasons,n:good.length,hz,
    dx,dy,mad_x:mad(x),mad_y:mad(y),target,window_start_ms:start,window_end_ms:duration,
    bias_limit_px:limit, estimator:'median-xy; study adaptation', correction:'translate-AOIs-only' };
}

// Compare explicit logical IDs. jsPsych indices may have gaps for conditional branches.
export function auditIntegrity(rows,ledger,expectedIds,strict=false) {
  const counts=new Map(); for(const r of rows) if(r.logical_id) counts.set(r.logical_id,(counts.get(r.logical_id)||0)+1);
  const missing=expectedIds.filter(id=>!counts.has(id));
  const duplicates=[...counts].filter(([,n])=>n!==1).map(([id])=>id);
  const unfinished=ledger.filter(e=>e.event==='start' && !counts.has(e.id)).map(e=>e.id);
  const unkeyed=rows.filter(r=>!r.logical_id).length;
  const ledger_mismatch=strict?rows.filter(r=>ledger.filter(e=>e.event==='start'&&e.id===r.logical_id).length!==1||ledger.filter(e=>e.event==='finish'&&e.id===r.logical_id).length!==1).map(r=>r.logical_id):[];
  return {ledger_mismatch,pass:!ledger_mismatch.length&&!missing.length&&!duplicates.length&&!unfinished.length&&!unkeyed,
    missing,duplicates,unfinished,unkeyed,expected:expectedIds.length,observed:rows.length,
    trial_index_policy:'indices need not be contiguous; check logical IDs and start/finish ledger'};
}

// Structural completeness is separate from scientific validity or subject quality.
export function auditRecords(rows,sessionId,{requireGaze=true}={}) {
  const errors=[];const add=(r,reason)=>errors.push({id:r.logical_id,reason});
  for(const r of rows){
    if(r.session_id!==sessionId)add(r,'session-id-mismatch');
    if(['video','fixation','preview','audio-gaze'].includes(r.task)||(r.task==='choice'&&r.gaze_sampling_enabled!==undefined)){
      if(requireGaze&&(!Array.isArray(r.webgazer_data)||!r.webgazer_data.length))add(r,'missing-gaze');
      if(!(r.capture_duration_ms>0)||!(r.viewport?.width>0)||!(r.viewport?.height>0)||(r.task!=='choice'&&!r.stage_rect))add(r,'missing-time-or-geometry');
      if((r.webgazer_data||[]).some((p,i,a)=>!validSample(p)||p.t<0||(i>0&&p.t<=a[i-1].t)))add(r,'invalid-or-unordered-gaze');
    }
    if(r.task==='video'&&(!r.video_timing||!r.playback_pass))add(r,'incomplete-video');
    if(r.task==='audio-gaze'&&(!r.audio_file||!r.spoken_text||!r.audio_timing||!r.playback_pass))add(r,'incomplete-audio-record');
    if(r.task==='choice'){
      if(!r.question_text||!['distal','proximal'].includes(r.selected_role)||!Number.isFinite(r.rt)||r.rt<0)add(r,'incomplete-choice-record');
      if(!Array.isArray(r.choice_order)||r.choice_order.length!==2||new Set(r.choice_order).size!==2||!r.choice_order.includes('distal')||!r.choice_order.includes('proximal')||
        !Array.isArray(r.choice_labels)||r.choice_labels.length!==2||!Number.isInteger(r.response)||r.selected_role!==r.choice_order[r.response])add(r,'choice-selection-mismatch');
      const audio=rows.filter(a=>a.task==='audio-gaze'&&a.probe_id===r.probe_id);
      if(!r.probe_id||audio.length!==1||audio[0].item_id!==r.item_id||audio[0].condition!==r.condition||!audio[0].playback_pass)add(r,'choice-audio-link-mismatch');
    }
  }
  return {pass:errors.length===0,errors};
}

export function auditContinuousGaze(session,rows) {
  if(session.mode==='preview')return {pass:true,applicable:false,errors:[]};
  const samples=session.continuous_gaze||[],segments=session.continuous_segments||[];
  const errors=[],items=rows.filter(r=>r.task==='video').map(r=>r.item_id);
  for(const id of items){
    const matching=segments.filter(s=>s.item_id===id);
    if(matching.length!==1||!(matching[0].end_performance_ms>matching[0].start_performance_ms))errors.push({item_id:id,reason:'missing-or-unclosed-segment'});
    if(!samples.some(p=>p.item_id===id))errors.push({item_id:id,reason:'missing-continuous-gaze'});
  }
  for(const [i,p]of samples.entries()){
    const s=segments.find(s=>s.item_id===p.item_id),t=p.prediction_request_performance_ms;
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(t)||p.sample_index!==i||
      (i>0&&t<=samples[i-1].prediction_request_performance_ms)||!s||t<s.start_performance_ms||t>s.end_performance_ms)
      errors.push({sample_index:i,reason:'invalid-continuous-sample'});
    if(p.logical_id&&!rows.some(r=>r.logical_id===p.logical_id&&r.item_id===p.item_id))errors.push({sample_index:i,reason:'unknown-sample-phase'});
  }
  return {pass:errors.length===0,applicable:true,errors,samples:samples.length,segments:segments.length};
}
