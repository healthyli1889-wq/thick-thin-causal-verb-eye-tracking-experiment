import {CONFIG} from './config.js';
import {brownPrecision,brownMeasurement} from './brown-measurement.js';
function timingSummary(values){
 const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
 return {n:a.length,median:a.length?a[Math.floor((a.length-1)*.5)]:null,p95:a.length?a[Math.floor((a.length-1)*.95)]:null,max:a.at(-1)??null};
}
export function calibrationReport(payload){
 const rows=payload.trials||payload.rows||[];
 return {session_id:payload.session_id,study_version:payload.study_version||rows[0]?.study_version,
  note:'Brown score is a screen-height-normalized center-distance score, not percent of correct gaze samples. Environmental causes cannot be inferred from a score alone.',
  calibration:rows.filter(r=>r.task==='calibration').map(r=>({id:r.logical_id,
   training_inference_ms:timingSummary((r.clicks||[]).map(c=>c.status_before?.last_inference_duration_ms)),
   recorded_clicks:r.clicks?.length,accepted_model_samples:r.training_status?.training_counts??null,
   rejected_clicks:r.calibration_click_attempts?.filter(c=>!c.accepted).reduce((out,c)=>{out[c.reason]=(out[c.reason]||0)+1;return out;},{})??null,
   click_intervals_ms:r.clicks?.slice(1).map((c,i)=>c.performance_ms-r.clicks[i].performance_ms)})),
  measurements:rows.filter(r=>r.task==='brown-measurement').map(r=>{
   const m=r.measurement||{},v=m.viewport||{};
   const reproduced=brownPrecision(m.past50,v.width,v.height);
   const diagnostic=m.diagnostics||(r.raw_predictions?brownMeasurement(r.raw_predictions,v,m.bounds).diagnostics:null);
   return {id:r.logical_id,saved_score:m.score,reproduced_score:reproduced,formula_matches:reproduced!==null&&reproduced===m.score,
    original_pass:r.pass,current_minimum_score:CONFIG.calibration.brownMinimumScore,passes_current_score_threshold:reproduced!==null&&reproduced>=CONFIG.calibration.brownMinimumScore,
    inference_ms:timingSummary((r.raw_predictions||[]).map(p=>p.inference_duration_ms)),
    viewport:v,raw_count:m.raw_count,finite_count:m.finite_count,last50_span_ms:m.recorded_window_ms,
    ...diagnostic,interruptions:r.interruptions,threshold_at_collection:r.threshold_policy,
    prediction_errors:r.sampling_diagnostics?.errors??null};
  }),
  validation:rows.filter(r=>r.task==='validation').map(r=>({id:r.logical_id,pass:r.verdict?.pass,failed:r.verdict?.failed,gaze_feedback_visible:r.gaze_feedback_visible,validation_context:r.validation_context,prediction_errors:r.sampling_diagnostics?.errors??null,points:r.verdict?.perPoint}))};
}
