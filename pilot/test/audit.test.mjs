import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {brownPrecision,brownMeasurement} from '../src/brown-measurement.js';
import {LATIN_SQUARE,makeAssignment} from '../src/assignment.js';import {ITEMS,geometry} from '../src/stimuli.js';
import {auditRecords,evaluateValidation} from '../src/quality.js';
import {CONFIG} from '../src/config.js';import {sampleRows,summarizeWindow} from '../src/analysis.js';
test('Brown formula equals installed official www code for 100 deterministic fixtures',()=>{
 const context={window:{innerWidth:1280,innerHeight:720}};vm.createContext(context);
 vm.runInContext(fs.readFileSync(new URL('../../WebGazer-master/www/js/precision_calculation.js',import.meta.url),'utf8'),context);
 for(let j=0;j<100;j++){const points=[Array.from({length:50},(_,i)=>(i*127+j*31)%1700-200),Array.from({length:50},(_,i)=>(i*41+j*13)%1000-100)];assert.equal(brownPrecision(points,1280,720),context.calculatePrecision(points));}
 assert.equal(brownPrecision([[],[]],1280,720),null);
 assert.equal(brownMeasurement(Array.from({length:150},(_,i)=>({t:i*34,x:640,y:360})),{width:1280,height:720}).score,100);
});
test('Williams square balances position and every immediate predecessor',()=>{
 for(let col=0;col<4;col++)assert.equal(new Set(LATIN_SQUARE.map(row=>row[col])).size,4);
 const pairs=LATIN_SQUARE.flatMap(row=>row.slice(1).map((n,i)=>`${row[i]}-${n}`));assert.equal(new Set(pairs).size,12);
 const allocations=Array.from({length:16},(_,i)=>makeAssignment(i+1,ITEMS));
 for(const item of ITEMS)for(const layout of ['standard','mirrored'])for(const first of ['thick','thin'])assert.equal(allocations.filter(a=>a.layout===layout&&a.items.find(x=>x.id===item.id).conditions[0]===first).length,4);
 assert.throws(()=>makeAssignment(0,ITEMS));
});
test('bin boundaries conserve measured dwell; invalid rows remain exportable',()=>{
 const row={viewport:{width:1200,height:800},webgazer_data:[{t:0,x:200,y:200},{t:90,x:200,y:200},{t:150,x:200,y:200},{t:210,x:200,y:200}]};
 assert.equal(summarizeWindow(row,100,200,CONFIG.analysis).dwell_ms.missing,0);
 row.webgazer_data.push({t:220,x:NaN,y:200});assert.equal(sampleRows(row).length,5);assert.equal(sampleRows(row).at(-1).sample_valid,false);
 assert.equal(summarizeWindow({...row,interrupted:true},0,200,CONFIG.analysis).quality_pass,false);
});
test('late predictions cannot cross trial boundaries and promise failures are recorded',async()=>{
 const context={jsPsychModule:{ParameterType:{}},setInterval,clearInterval,performance,console};vm.createContext(context);
 vm.runInContext(fs.readFileSync(new URL('../vendor/extension-webgazer.js',import.meta.url),'utf8'),context);
 const ext=new context.jsPsychExtensionWebgazer({}),seen=[],pending=[];
 ext.webgazer={getCurrentPrediction:()=>new Promise(resolve=>pending.push(resolve))};ext.handleGazeDataUpdate=p=>seen.push(p);
 ext.startSampleInterval(10000);ext.stopSampleInterval();ext.startSampleInterval(10000);
 pending[0]({x:1});pending[1]({x:2});await new Promise(r=>setTimeout(r,0));ext.stopSampleInterval();assert.deepEqual(seen,[{x:2}]);
 ext.webgazer.getCurrentPrediction=()=>Promise.reject(new Error('mock inference failure'));ext.startSampleInterval(10000);await new Promise(r=>setTimeout(r,0));ext.stopSampleInterval();assert.equal(ext.sampleDiagnostics.errors.length,1);
});

test('signed role coordinates are anchored at actual candidate centers in either layout',()=>{
 const stage={left:0,right:1280,top:0,bottom:720,width:1280,height:720};
 for(const layout of ['standard','mirrored']){const g=geometry(ITEMS[0],layout,stage);const samples=sampleRows({geometry:g,viewport:{width:1280,height:720},layout,webgazer_data:g.centers.map((p,i)=>({...p,t:i*34}))});assert.ok(Math.abs(samples[0].x_signed_distal-1)<1e-10);assert.ok(Math.abs(samples[1].x_signed_distal+1)<1e-10);}
});

test('malformed rows and repeated validation timestamps cannot silently pass',()=>{
 assert.equal(auditRecords([{logical_id:'x',session_id:'wrong',task:'audio-gaze'}],'correct').pass,false);
 const raw=Array.from({length:40},()=>({t:100,x:100,y:100,dx:0,dy:0}));
 assert.equal(evaluateValidation({raw_gaze:CONFIG.calibration.validationPoints.map(()=>raw),validation_points:CONFIG.calibration.validationPoints},CONFIG.calibration).pass,false);
});
