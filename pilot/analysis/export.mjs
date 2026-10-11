import fs from 'node:fs';import path from 'node:path';import {sampleRows} from '../src/analysis.js';import {auditRecords} from '../src/quality.js';
const [input,out='analysis/derived']=process.argv.slice(2);
if(!input)throw new Error('Usage: node analysis/export.mjs session.json|input-directory output-directory');
const files=fs.statSync(input).isDirectory()?fs.readdirSync(input).filter(f=>f.endsWith('.json')).sort().map(f=>path.join(input,f)):[input];
const tables={participants:[],trials:[],samples:[],windows:[],bins:[],validation_points:[],events:[],partial_samples:[],continuous_samples:[]};
const seen=new Set();
for(const file of files){
 const p=JSON.parse(fs.readFileSync(file,'utf8')),rows=p.trials||p.rows;
 if(!Array.isArray(rows))throw new Error(`${file}: expected trials or recovery rows`);
 const id=p.session_id||p.session?.id;if(!id||seen.has(id))throw new Error(`Missing or duplicate session_id: ${id}`);seen.add(id);
 const s=p.session||p,assignment=s.assignment||{};
 const common={session_id:id,allocation:assignment.allocation,list:assignment.list,layout:assignment.layout,probe_pattern:assignment.probe_pattern};
 const exportAudit=auditRecords(rows,id,{requireGaze:s.mode!=='preview'});
 const setup=rows.find(r=>r.logical_id==='setup-questionnaire')?.response||{},feedback=rows.find(r=>r.logical_id==='feedback')?.response||{};
 tables.participants.push({...common,source_file:path.basename(file),study_version:p.study_version||rows[0]?.study_version,schema_version:p.schema_version||rows[0]?.schema_version,
  build_id:(p.build_manifest||s.manifest)?.build_id,mode:s.mode||'study',material_status:p.material_status||s.material_status||'unknown',flow_complete:p.flow_complete,complete:p.complete??false,recovery_file:!p.trials,synthetic_test_data:s.environment?.synthetic_test_data??false,
  stop_reason:p.stop_reason||s.stopReason,integrity_pass:p.data_integrity?.pass,record_integrity_pass:p.record_integrity?.pass,continuous_integrity_pass:p.continuous_integrity?.pass,record_integrity_at_export_pass:exportAudit.pass,record_integrity_at_export_errors_json:JSON.stringify(exportAudit.errors),confirmatory_ready:false,
  environment_json:JSON.stringify(s.environment),feedback_exposure_json:JSON.stringify(rows.find(r=>r.logical_id==='feedback')?.feedback_exposure),...setup,...feedback});
 for(const row of rows){
  const r={...row,session_id:id};const join={session_id:id,source_session_id:row.session_id,session_id_matches:row.session_id===id,logical_id:r.logical_id,probe_id:r.probe_id,trial_index:r.trial_index,item_id:r.item_id,item_position:r.item_position,task:r.task,condition:r.condition,probe_index:r.probe_index,layout:r.layout};
  tables.trials.push({...join,rt_ms:r.rt,response_json:JSON.stringify(r.response),question_text:r.question_text,choice_order_json:JSON.stringify(r.choice_order),choice_labels_json:JSON.stringify(r.choice_labels),selected_role:r.selected_role,
   audio_file:r.audio_file,spoken_text:r.spoken_text,video_file:r.video_file,capture_duration_ms:r.capture_duration_ms,word_onset_ms:r.word_onset_ms,word_onset_verified:r.word_onset_verified,
   playback_pass:r.playback_pass,playback_flags_json:JSON.stringify(r.playback_flags),audio_timing_json:JSON.stringify(r.audio_timing),video_timing_json:JSON.stringify(r.video_timing),
   gaze_recorded:r.gaze_recorded,gaze_feedback_visible:r.gaze_feedback_visible,validation_context:r.validation_context,interrupted:r.interrupted,drift_json:JSON.stringify(r.drift),geometry_json:JSON.stringify(r.geometry),sampling_diagnostics_json:JSON.stringify(r.sampling_diagnostics),brown_score:r.measurement?.score,brown_pass:r.pass});
  tables.samples.push(...sampleRows(r).map(x=>({...x,source_session_id:row.session_id,session_id_matches:row.session_id===id})));
  for(const kind of ['phase','corrected_phase','word_window','corrected_word_window'])if(r.analysis){
   const w=r.analysis[kind]||{};tables.windows.push({...join,kind,available:w.available??false,reason:w.reason,start_ms:w.start_ms,end_ms:w.end_ms,n:w.n,hz:w.hz,
    missing_fraction:w.missing_fraction,offscreen_fraction:w.offscreen_fraction,distal_dwell_ms:w.dwell_ms?.distal,proximal_dwell_ms:w.dwell_ms?.proximal,
    other_dwell_ms:w.dwell_ms?.other,offstage_ms:w.dwell_ms?.offstage,offscreen_ms:w.dwell_ms?.offscreen,missing_ms:w.dwell_ms?.missing,
    distal_preference:w.distal_preference_among_referents,distal_minus_proximal_fraction:w.distal_minus_proximal_fraction,
    mean_x_px:w.centroid?.x,mean_y_px:w.centroid?.y,sd_x_px:w.centroid?.sd_x,sd_y_px:w.centroid?.sd_y,time_weighted_x_px:w.centroid?.time_weighted_x,time_weighted_y_px:w.centroid?.time_weighted_y,
    first_shift_json:JSON.stringify(w.first_shift),quality_pass:w.quality_pass,quality_flags_json:JSON.stringify(w.quality_flags),geometry_validated:w.geometry_validated,drift_applied:r.drift?.applied,interrupted:r.interrupted});
  }
  tables.bins.push(...(r.analysis?.bins||[]).map(b=>({...join,start_ms:b.start_ms,end_ms:b.end_ms,audio_relative_start_ms:Number.isFinite(r.audio_timing?.playing_from_gaze_origin_ms)?b.start_ms-r.audio_timing.playing_from_gaze_origin_ms:null,
   n:b.n,hz:b.hz,distal_ms:b.dwell_ms?.distal,proximal_ms:b.dwell_ms?.proximal,missing_ms:b.dwell_ms?.missing,offscreen_ms:b.dwell_ms?.offscreen,quality_pass:b.quality_pass})));
  tables.validation_points.push(...(r.verdict?.perPoint||[]).map(point=>({...join,checkpoint:r.checkpoint,attempt:r.attempt,validation_pass:r.verdict.pass,...point})));
 }
 tables.continuous_samples.push(...(s.continuous_gaze||[]).map(x=>({session_id:id,...x})));
 tables.events.push(...(s.ledger||[]).map(e=>({session_id:id,source:'ledger',...e})),...(s.interactions||[]).map(e=>({session_id:id,source:'interaction',...e})));
 const partial=s.in_progress_trial||p.in_progress_trial;
 tables.partial_samples.push(...(partial?.samples||[]).map((x,i)=>({session_id:id,logical_id:partial.logical_id,partial:true,sample_index:i,...x})));
}
function csv(data){const cols=[...new Set(['session_id',...data.flatMap(Object.keys)])];const esc=x=>x===null||x===undefined?'':`"${String(x).replaceAll('"','""')}"`;return [cols.join(','),...data.map(r=>cols.map(k=>esc(r[k])).join(','))].join('\n')+'\n';}
fs.mkdirSync(out,{recursive:true});for(const [name,table] of Object.entries(tables))fs.writeFileSync(path.join(out,`${name}.csv`),csv(table));
fs.writeFileSync(path.join(out,'export-manifest.json'),JSON.stringify({generated_at:new Date().toISOString(),source_files:files,rows:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length])),note:'No participant exclusion or inferential model applied. Missing values are empty CSV fields. Preserve original JSON.'},null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length]))));
