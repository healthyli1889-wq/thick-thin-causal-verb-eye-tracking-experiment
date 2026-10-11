import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
function harness(start){
  let cancel,loadCalls=0,ended=0;const rows=[];
  const document={querySelector:selector=>selector==='#jspsych-wg-stop'?{addEventListener:(e,fn)=>{cancel=fn;}}:null};
  const context={jsPsychModule:{ParameterType:{}},document,performance};vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../vendor/plugin-webgazer-init-camera.js',import.meta.url),'utf8'),context);
  const ext={isInitialized:()=>false,start,pause(){},hideVideo(){},webgazer:{end(){ended++;}}};
  const plugin=new context.jsPsychWebgazerInitCamera({extensions:{webgazer:ext},finishTrial:r=>rows.push(r)});
  const completion=plugin.trial({}, {},()=>loadCalls++);
  return {completion,rows,cancel:()=>cancel(),get loadCalls(){return loadCalls;},get ended(){return ended;}};
}
test('camera rejection finishes a diagnostic trial instead of leaving an unresolved screen',async()=>{
  const h=harness(()=>Promise.reject(Object.assign(new Error('Permission denied'),{name:'NotAllowedError'})));
  await h.completion;assert.equal(h.rows.length,1);assert.equal(h.rows[0].camera_error.name,'NotAllowedError');assert.equal(h.loadCalls,0);
});
test('canceling camera setup saves once and a late start cannot replace the next screen',async()=>{
  let resolve;const h=harness(()=>new Promise(r=>{resolve=r;}));
  h.cancel();await h.completion;resolve();await new Promise(r=>setImmediate(r));
  assert.equal(h.rows.length,1);assert.equal(h.rows[0].camera_error.name,'CameraSetupCanceled');assert.equal(h.loadCalls,0);assert.equal(h.ended,2);
});
