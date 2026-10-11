import test from 'node:test';import assert from 'node:assert/strict';
import {CONFIG} from '../src/config.js';
import {evaluateValidation,estimateDrift,auditIntegrity} from '../src/quality.js';
import {label,summarizeWindow,analyzeTrial,sampleRows} from '../src/analysis.js';
import {ITEMS,geometry} from '../src/stimuli.js';
const gate=CONFIG.calibration;
const goodValidation=()=>({validation_points:gate.validationPoints,raw_gaze:gate.validationPoints.map(()=>Array.from({length:40},(_,i)=>({t:i*50,x:300,y:300,dx:i<20?200:201,dy:0}))),percent_in_roi:[50,50,50,50,50]});
test('accuracy is the mean gaze offset; spread is precision, not the plugin centroid radius',()=>{
 const row=goodValidation();row.average_offset=gate.validationPoints.map(()=>({x:200.5,y:0,r:99}));
 const v=evaluateValidation(row,gate);
 assert.equal(v.accuracy.mean_offset_px,200.5);
 assert.equal(v.perPoint[0].accuracy_offset_px,200.5);
 assert.ok(Math.abs(v.perPoint[0].precision_rms_px-0.5)<1e-9);
 assert.equal(v.perPoint[0].plugin_precision_median_px,99);
 assert.notEqual(v.accuracy.mean_offset_px,99);
});
test('all points must meet 50%, inclusive 200 px, with adequate samples',()=>{
 const row=goodValidation();assert.equal(evaluateValidation(row,gate).pass,true);
 row.raw_gaze[4].forEach(p=>p.dx=201);assert.equal(evaluateValidation(row,gate).pass,false);
});
test('empty, NaN, sparse, or missing validation points fail closed',()=>{
 for(const row of [null,{}, {...goodValidation(),raw_gaze:[]}, {...goodValidation(),raw_gaze:gate.validationPoints.map(()=>[{x:0,y:0,dx:0,dy:0}])}])assert.equal(evaluateValidation(row,gate).pass,false);
 const row=goodValidation();row.raw_gaze[0].forEach(p=>p.dx=NaN);assert.equal(evaluateValidation(row,gate).pass,false);
});
test('fixation uses trailing 80%, stores raw bias, and never rescues an excessive offset',()=>{
 const samples=Array.from({length:30},(_,i)=>({t:i*34,x:i<6?900:530,y:350}));
 const d=estimateDrift(samples,{x:500,y:350},1000,CONFIG.drift,120);assert.equal(d.dx,30);assert.equal(d.applied,true);
 assert.equal(estimateDrift(samples,{x:100,y:350},1000,CONFIG.drift,120).applied,false);
 assert.equal(estimateDrift(samples.slice(0,3),{x:500,y:350},1000,CONFIG.drift).applied,false);
});
const geo={stage:{left:0,right:1000,top:0,bottom:600,width:1000,height:600},regions:[{role:'distal',left:0,right:500,top:0,bottom:600},{role:'proximal',left:500,right:1000,top:0,bottom:600}],validated:false};
const viewport={width:1200,height:800};
test('AOI correction uses the correct sign and labels remain exclusive',()=>{
 const p={t:0,x:520,y:200};assert.equal(label(p,geo,viewport),'proximal');
 assert.equal(label(p,geo,viewport,{applied:true,dx:50,dy:0}),'distal');
 assert.equal(label({t:0,x:-10,y:200},geo,viewport),'offscreen');
 assert.equal(label({t:0,x:1100,y:200},geo,viewport),'offstage');
 assert.equal(label({t:0,x:500,y:200},geo,viewport),'proximal');
});
test('long gaps count as missing time, not dwell or inferred camera frames',()=>{
 const row={geometry:geo,viewport,webgazer_data:[{t:0,x:200,y:200},{t:900,x:700,y:200},{t:1000,x:700,y:200}]};
 const s=summarizeWindow(row,0,1000,CONFIG.analysis);assert.equal(s.dwell_ms.missing,800);assert.equal(s.dwell_ms.distal,100);assert.equal(s.dwell_ms.proximal,100);
 assert.equal(Object.values(s.dwell_ms).reduce((a,b)=>a+b),1000);assert.equal(s.first_shift.distal.eligible,false);
});
test('a real first shift requires a measured baseline outside the target',()=>{
 const row={geometry:geo,viewport,webgazer_data:[{t:0,x:200,y:200},{t:34,x:200,y:200},{t:68,x:700,y:200},{t:102,x:700,y:200},{t:136,x:700,y:200}]};
 const s=summarizeWindow(row,40,200,CONFIG.analysis);assert.equal(s.first_shift.proximal.latency_ms,28);assert.equal(s.first_shift.distal.eligible,false);
});
test('unverified word onset suppresses language-locked analysis',()=>{
 const row={viewport,geometry:geo,webgazer_data:[],capture_duration_ms:3000,audio_timing:{playing_from_gaze_origin_ms:10},word_onset_ms:null};
 assert.equal(analyzeTrial(row,CONFIG.analysis).word_window.available,false);
 assert.equal(sampleRows({...row,webgazer_data:[{t:34,x:10,y:10}]})[0].word_relative_ms,null);
});
test('mirroring swaps sides but preserves causal roles and records geometry limitations',()=>{
 const rect={left:0,right:1280,top:0,bottom:720,width:1280,height:720};
 for(const item of ITEMS){const g=geometry(item,'mirrored',rect);assert.ok(g.centers[0].x>g.centers[1].x);assert.equal(g.radius200SupportsSeparation,false);assert.equal(g.validated,false);}
});
test('logical integrity detects missing/duplicate rows without treating trial-index gaps as loss',()=>{
 const rows=[{logical_id:'a',trial_index:13},{logical_id:'b',trial_index:15}];
 assert.equal(auditIntegrity(rows,[],['a','b']).pass,true);
 assert.equal(auditIntegrity(rows,[],['a','b','c']).pass,false);
 assert.equal(auditIntegrity([...rows,rows[0]],[],['a','b']).pass,false);
 assert.equal(auditIntegrity(rows,[{event:'start',id:'c'}],['a','b']).pass,false);
});
