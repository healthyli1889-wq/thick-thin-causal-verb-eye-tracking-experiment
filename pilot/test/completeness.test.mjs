import test from 'node:test';import assert from 'node:assert/strict';
import {auditRecords,auditContinuousGaze} from '../src/quality.js';
import {sampleRows,summarizeWindow} from '../src/analysis.js';
import {CONFIG} from '../src/config.js';

const viewport={width:1000,height:600};
const stage={left:0,top:0,right:1000,bottom:600,width:1000,height:600};
function pair(){return [
  {logical_id:'audio',session_id:'s',probe_id:'p',item_id:'i',condition:'thin',task:'audio-gaze',webgazer_data:[{x:10,y:10,t:1}],capture_duration_ms:100,viewport,stage_rect:stage,audio_file:'a.mp3',spoken_text:'cause to break',audio_timing:{},playback_pass:true},
  {logical_id:'choice',session_id:'s',probe_id:'p',item_id:'i',condition:'thin',task:'choice',webgazer_data:[{x:10,y:10,t:1}],capture_duration_ms:100,viewport,gaze_sampling_enabled:true,question_text:'Who caused the fence to break?',choice_order:['distal','proximal'],choice_labels:['A','B'],response:0,selected_role:'distal',rt:90}
];}
test('empty response gaze, swapped labels and wrong probe links cannot silently pass',()=>{
  assert.equal(auditRecords(pair(),'s').pass,true);
  for(const mutate of [r=>{r.webgazer_data=[];},r=>{r.selected_role='proximal';},r=>{r.probe_id='wrong';},r=>{r.choice_labels=[];},r=>{r.rt=-1;}]){
    const rows=pair();mutate(rows[1]);assert.equal(auditRecords(rows,'s').pass,false);
  }
});
test('continuous-recording omissions, duplicates and unknown phases are detected',()=>{
  const session={mode:'study',continuous_segments:[{item_id:'i',start_performance_ms:10,end_performance_ms:100}],continuous_gaze:[{item_id:'i',logical_id:'video',sample_index:0,x:10,y:10,prediction_request_performance_ms:30}]};
  const rows=[{task:'video',item_id:'i',logical_id:'video'}];
  assert.equal(auditContinuousGaze(session,rows).pass,true);
  for(const mutate of [s=>{s.continuous_gaze=[];},s=>{s.continuous_segments[0].end_performance_ms=null;},s=>{s.continuous_gaze.push({...s.continuous_gaze[0],sample_index:1});},s=>{s.continuous_gaze[0].logical_id='unknown';}]){
    const s=structuredClone(session);mutate(s);assert.equal(auditContinuousGaze(s,rows).pass,false);
  }
});
test('malformed viewport remains exportable and does not become an invented AOI',()=>{
  const row=sampleRows({webgazer_data:[{t:10,x:100,y:100}]})[0];
  assert.equal(row.viewport_valid,false);assert.equal(row.aoi_raw,'unannotated');
});
test('an invalid prediction contributes missing time, not preceding-target dwell',()=>{
  const row={viewport,webgazer_data:[{t:0,x:10,y:10},{t:34,x:NaN,y:10},{t:68,x:10,y:10},{t:100,x:10,y:10}]};
  const w=summarizeWindow(row,0,100,CONFIG.analysis);
  assert.equal(w.dwell_ms.missing,34);assert.equal(w.quality_pass,false);
});
test('unobserved time before a sustained target look cannot establish a first shift',()=>{
  const geometry={stage,regions:[{role:'distal',left:0,right:500,top:0,bottom:600},{role:'proximal',left:500,right:1000,top:0,bottom:600}]};
  const w=summarizeWindow({geometry,viewport,webgazer_data:[{t:0,x:10,y:10},{t:900,x:800,y:10},{t:934,x:800,y:10},{t:968,x:800,y:10}]},10,1000,CONFIG.analysis);
  assert.equal(w.first_shift.proximal.latency_ms,null);assert.equal(w.first_shift.proximal.eligible,false);
});
