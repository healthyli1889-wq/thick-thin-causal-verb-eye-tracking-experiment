import {auditIntegrity,auditRecords,auditContinuousGaze} from './quality.js';
export function createJournal(session) {
  const opened=new Promise((resolve,reject)=>{
    const req=indexedDB.open('causal-gaze-pilot-v2',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('sessions',{keyPath:'session_id'});
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  let chain=Promise.resolve(),lastError=null,writes=0;
  opened.catch(e=>{lastError=String(e);});
  function write(snapshot) {
    chain=chain.then(async()=>{
      const db=await opened;
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('sessions','readwrite');tx.objectStore('sessions').put(snapshot);
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });lastError=null;writes++;
    }).catch(e=>{lastError=String(e);});
    return chain;
  }
  return { checkpoint:(rows)=>write(structuredClone({session_id:session.id,session,rows,updated_at:new Date().toISOString()})),
    flush:async()=>{await chain;return {ok:lastError===null&&writes>0,error:lastError,writes};} };
}
export async function recoveredSessions() {
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open('causal-gaze-pilot-v2',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('sessions',{keyPath:'session_id'});
    r.onerror=()=>reject(r.error);r.onsuccess=()=>{
      const db=r.result,tx=db.transaction('sessions'),req=tx.objectStore('sessions').getAll();
      req.onsuccess=()=>{resolve(req.result);db.close();};req.onerror=()=>reject(req.error);
    };
  });
}
export function download(payload,name) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
// Every accuracy number the session produced, plus the levels they are being compared against,
// in one place. `reference_levels_met` is a label on the measurements, not a gate that ran.
function trackingQuality(rows,validations,config) {
  const brown=rows.filter(r=>r.task==='brown-measurement');
  const scores=brown.map(r=>r.measurement?.score).filter(s=>Number.isFinite(s));
  const hz=validations.flatMap(r=>r.verdict?.perPoint?.map(p=>p.hz)??[]).filter(Number.isFinite);
  return {policy:'Calibration and validation ran once per checkpoint and were recorded. No score stopped the session.',
    enforced:config.calibration.qualityGateEnforced,
    recalibration_attempts_offered:config.calibration.recalibrationAttemptsOffered,
    reference_levels:{brown_minimum_score:config.calibration.brownMinimumScore,
      validation_minimum_percent_in_roi:config.calibration.minimumPercent,
      validation_roi_radius_px:config.calibration.radiusPx,
      validation_minimum_hz:config.calibration.minimumHz},
    brown_scores:brown.map(r=>({id:r.logical_id,score:r.measurement?.score??null,
      mean_error_px:r.measurement?.diagnostics?.mean_error_px??null,
      rms_dispersion_px:r.measurement?.diagnostics?.rms_dispersion_px??null,
      meets_reference:r.pass===true})),
    lowest_brown_score:scores.length?Math.min(...scores):null,
    lowest_validation_hz:hz.length?Math.min(...hz):null,
    validation_accuracy:validations.map(r=>({id:r.logical_id,
      mean_offset_px:r.verdict?.accuracy?.mean_offset_px??null,
      mean_precision_rms_px:r.verdict?.accuracy?.mean_precision_rms_px??null,
      formula:r.verdict?.accuracy?.formula??null})),
    reference_levels_met:brown.length>0&&validations.length>0
      &&brown.every(r=>r.pass===true)&&validations.every(r=>r.verdict?.pass===true)};
}
export function makePayload(session,rows,config,save) {
  const expected=session.stopReason ? session.ledger.filter(e=>e.event==='start').map(e=>e.id) : session.requiredIds;
  const integrity=auditIntegrity(rows,session.ledger,expected,true);
  const isPreview=session.mode==='preview';
  const records=auditRecords(rows,session.id,{requireGaze:!isPreview});
  const continuous=auditContinuousGaze(session,rows);
  const gaze=rows.filter(r=>r.task==='audio-gaze');
  const validations=rows.filter(r=>r.task==='validation');
  return {schema_version:config.schema,study_version:config.version,session_id:session.id,
    generated_at:new Date().toISOString(),mode:session.mode||'study',gaze_enabled:!isPreview,
    flow_complete:!session.stopReason&&integrity.pass&&records.pass&&continuous.pass,
    complete:!isPreview&&!session.stopReason&&integrity.pass&&records.pass&&continuous.pass,
    stop_reason:session.stopReason,confirmatory_ready:false,material_status:session.material_status||'unknown',
    assignment:session.assignment,parameters:config,environment:session.environment,
    build_manifest:session.manifest,ledger:session.ledger,interactions:session.interactions,
    continuous_gaze:session.continuous_gaze||[],continuous_segments:session.continuous_segments||[],
    in_progress_trial:session.in_progress_trial||null,data_integrity:integrity,record_integrity:records,continuous_integrity:continuous,save,
    // Accuracy was measured and recorded, never enforced. A session reaching the end therefore
    // says nothing about its tracking quality; read tracking_quality before using any trial.
    tracking_quality_gate:'recorded-not-enforced',
    quality:{brown_checkpoints:rows.filter(r=>r.task==='brown-measurement').map(r=>({id:r.logical_id,score:r.measurement?.score,pass:r.pass})),
      validation_checkpoints:validations.map(r=>({id:r.logical_id,pass:r.verdict?.pass})),
      initial_validation_pass:session.initialValidationPass,
      final_validation_pass:session.finalValidationPass,
      tracking_quality:trackingQuality(rows,validations,config),
      exploratory_gaze_trials:isPreview?0:gaze.length,
      usable_confirmatory_trials:0,
      blockers:['Tracking accuracy was recorded but not screened; trials of any accuracy are present and exclusion is still an open analysis decision','Human gaze accuracy and end-to-end latency not validated','Unvalidated, closely spaced stimulus geometry','Unverified word onsets and audio transcription','Four repeated items; carryover and limited item generalization']},
    trials:rows};
}
