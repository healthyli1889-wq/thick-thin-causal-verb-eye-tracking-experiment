import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {makePayload} from '../src/storage.js';
import {CONFIG} from '../src/config.js';

test('continuous scenario sampling survives phase transitions without a second sampler',async()=>{
  let calls=0,activeIntervals=0,maximum=0;
  const pending=[];
  const context={jsPsychModule:{ParameterType:{}},performance,console,
    setInterval:()=>{maximum=Math.max(maximum,++activeIntervals);return activeIntervals;},
    clearInterval:id=>{if(id!=null)activeIntervals--;}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../vendor/extension-webgazer.js',import.meta.url),'utf8'),context);
  const ext=new context.jsPsychExtensionWebgazer({});
  const seen=[];ext.gazeUpdateCallbacks=[p=>seen.push(p)];
  ext.webgazer={getCurrentPrediction:()=>{calls++;return new Promise(resolve=>pending.push(resolve));}};
  ext.beginContinuousSampling();ext.stopSampleInterval();ext.startSampleInterval();
  assert.equal(calls,1);assert.equal(activeIntervals,1);assert.equal(maximum,1);
  // An inference begun before the new phase stays in the continuous log,
  // but cannot be inserted as negative-time gaze into the new phase.
  ext.activeTrial=true;ext.currentTrialStart=100;
  pending.shift()({x:20,y:30,t:90});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(seen.length,1);assert.equal(seen[0].prediction_request_performance_ms,90);
  assert.equal(ext.currentTrialData.length,0);
  ext.endContinuousSampling();assert.equal(activeIntervals,0);
  ext.startSampleInterval();ext.stopSampleInterval();
  pending.shift()({x:20,y:30,t:120});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(seen.length,1);assert.equal(activeIntervals,0);
});

test('validation feedback keeps the red estimate visible, including offscreen clamp',()=>{
  let callback,expiry,removed=false,unsubscribed=false;
  const dot={style:{},dataset:{},setAttribute(){},remove(){removed=true;}};
  const context={document:{createElement:()=>dot,body:{append(){}}},innerWidth:1000,innerHeight:800,
    setTimeout:fn=>{expiry=fn;return 1;},clearTimeout(){}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../src/gaze-feedback.js',import.meta.url),'utf8').replaceAll('export function','function').replace('export {paintGazeDot};',''),context);
  const cleanup=context.showValidationFeedback({onGazeUpdate:fn=>{callback=fn;return ()=>{unsubscribed=true;};}});
  callback({x:230,y:310});assert.equal(dot.style.display,'block');assert.equal(dot.style.transform,'translate3d(230px,310px,0)');
  callback({x:1200,y:310});assert.equal(dot.style.display,'block');assert.equal(dot.style.transform,'translate3d(999px,310px,0)');assert.equal(dot.dataset.offscreen,'true');
  callback({x:230,y:310});expiry();assert.equal(dot.style.display,'none');
  cleanup();assert.ok(removed&&unsubscribed);
});

test('a completed researcher preview cannot be labeled a completed gaze study',()=>{
  const p=makePayload({id:'preview',mode:'preview',requiredIds:[],ledger:[],interactions:[]},[],CONFIG,{});
  assert.equal(p.flow_complete,true);assert.equal(p.complete,false);assert.equal(p.gaze_enabled,false);
  assert.equal(p.quality.exploratory_gaze_trials,0);
});

test('validation trial keeps prediction feedback armed before sampling starts',()=>{
  const src=fs.readFileSync(new URL('../src/experiment.js',import.meta.url),'utf8');
  const fn=src.slice(src.indexOf('function validation'),src.indexOf('function brownCheck'));
  assert.match(fn,/showPredictions\(\)/);
  assert.match(fn,/showValidationFeedback\(ext\(\)\)/);
  assert.doesNotMatch(fn,/hidePredictions\(\)/);
});
