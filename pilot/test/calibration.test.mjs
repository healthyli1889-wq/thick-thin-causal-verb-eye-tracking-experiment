import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {brownMeasurement,brownPass} from '../src/brown-measurement.js';import {CONFIG} from '../src/config.js';
function harness(points=[[25,50],[25,50],[75,50]]){
 let now=0,dot,html='',result=null,count=0,feature=0,face=true,paused=true,accept=true,stale=false;
 const status={style:{},remove(){}};
 const container={remove(){},set innerHTML(v){html=v;dot={style:{},getBoundingClientRect:()=>({left:240,top:490,width:20,height:20}),addEventListener:(name,fn)=>{dot.click=fn;}};}};
 container.querySelector=()=>dot;
 const display={set innerHTML(v){},querySelector:()=>container,append:()=>{}};
 const engine={getCalibrationStatus:()=>({paused,face_detected:face,feature_time_ms:feature,feature_age_ms:stale?999:now-feature,training_counts:[count]})};
 const extension={webgazer:engine,resume:()=>paused=false,pause:()=>paused=true,hidePredictions(){},hideVideo(){},stopMouseCalibration(){},startMouseCalibration(){throw Error('Must not enable mousemove training');},calibratePoint:()=>{if(accept)count++;}};
 const context={jsPsychModule:{ParameterType:{}},document:{createElement:()=>status},performance:{now:()=>now}};vm.createContext(context);
 vm.runInContext(fs.readFileSync(new URL('../vendor/plugin-webgazer-calibrate.js',import.meta.url),'utf8'),context);
 const plugin=new context.jsPsychWebgazerCalibrate({extensions:{webgazer:extension},finishTrial:r=>result=r});
 plugin.trial(display,{calibration_mode:'click',calibration_points:points,repetitions_per_point:1,randomize_calibration_order:false,time_to_saccade:750,minimum_click_interval:300,maximum_feature_age:500,point_size:20});
 return {click:(time,flags={})=>{now=time;feature=flags.feature??time;face=flags.face??true;accept=flags.accept??true;stale=flags.stale??false;dot.click({clientX:250,clientY:500});},get count(){return count},get result(){return result},get html(){return html}};
}
test('training requires settling, fresh distinct features and verified model insertion',()=>{
 const h=harness();h.click(100);assert.equal(h.count,0);
 h.click(800,{face:false});assert.equal(h.count,0);
 h.click(850,{stale:true});assert.equal(h.count,0);
 h.click(900,{feature:600});assert.equal(h.count,0);
 h.click(1000);assert.equal(h.count,1);
 h.click(1100);assert.equal(h.count,1);
 h.click(1350,{feature:1000});assert.equal(h.count,1);
 h.click(1400,{accept:false});assert.equal(h.result,null);
 h.click(1500);assert.equal(h.count,2);
 h.click(1600);assert.equal(h.count,2);
 h.click(2300);assert.equal(h.count,3);
 assert.equal(h.result.calibration_clicks.length,3);assert.equal(h.result.calibration_click_attempts.length,11);
 assert.ok(h.result.calibration_clicks.every(c=>c.accepted));
});
test('45 accepted target-only clicks are required; model counts are recorded',()=>{
 const points=Array.from({length:9},(_,i)=>Array.from({length:5},()=>[15+i*5,50])).flat();const h=harness(points);
 for(let i=0;i<45;i++)h.click((i+1)*800);
 assert.equal(h.result.calibration_clicks.length,45);assert.equal(h.result.training_status.training_counts[0],45);
});
test('75 passes, 74/56 do not; a lowered gate cannot inflate the score',()=>{
 assert.equal(CONFIG.calibration.brownMinimumScore,75);
 for(const score of [56,74,75,79,80,100])assert.equal(brownPass({score},75),score>=75);
 assert.equal(brownPass({score:null},75),false);assert.equal(brownPass({score:100},75,[{}]),false);
 const m=brownMeasurement(Array.from({length:100},(_,i)=>({t:i*40,x:720+220,y:500})),{width:1440,height:1000});
 assert.equal(m.score,56);assert.equal(m.diagnostics.mean_error_px,220);assert.equal(m.diagnostics.mean_dx_px,220);assert.equal(m.diagnostics.rms_dispersion_px,0);
});
