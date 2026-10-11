import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../vendor/webgazer.js',import.meta.url),'utf8');
const method=name=>{const a=source.indexOf(name+' = function');assert.ok(a>=0);return source.slice(a,source.indexOf('\n};',a)+3);};
test('cached ridge fits preserve outputs, invalidate on training, and bypass cache for active trails',()=>{
 class Window{constructor(){this.data=[];}push(x){this.data.push(x);}get(i){return this.data[i];}get length(){return this.data.length;}}
 let calls=0,now=1000;
 const context={ridgeReg_reg:{RidgeReg:function(){}},src_util:{getEyeFeats:e=>e.features},src_params:{applyKalmanFilter:false},ridgeParameter:.1,
  performance:{now:()=>now},ridge:(y,X)=>{calls++;return [y.reduce((a,v)=>a+v[0],0)/y.length,1];}};
 vm.createContext(context);vm.runInContext(method('ridgeReg_reg.RidgeReg.prototype.addData')+'\n'+method('ridgeReg_reg.RidgeReg.prototype.predict'),context);
 const r=new context.ridgeReg_reg.RidgeReg();
 for(const key of ['screenXClicksArray','screenYClicksArray','eyeFeaturesClicks','screenXTrailArray','screenYTrailArray','eyeFeaturesTrail','trailTimes','dataClicks','dataTrail'])r[key]=new Window();
 r.trailTime=1000;r.trailDataWindow=20;r.trainingRevision=0;
 r.addData({features:[1,2]},[10,20],'click');
 const first=r.predict({features:[2,3]});assert.equal(calls,2);
 for(let i=0;i<8;i++){const out=r.predict({features:[2,3]});assert.equal(out.x,first.x);assert.equal(out.y,first.y);}assert.equal(calls,2);
 r.coefficientsCache=null;const fresh=r.predict({features:[2,3]});assert.deepEqual(fresh,first);assert.equal(calls,4);
 r.addData({features:[3,4]},[30,40],'click');assert.notEqual(r.predict({features:[2,3]}).x,first.x);assert.equal(calls,6);
 r.addData({features:[5,6]},[90,100],'move');r.predict({features:[2,3]});r.predict({features:[2,3]});assert.equal(calls,10);
 now=2500;r.predict({features:[2,3]});r.predict({features:[2,3]});assert.equal(calls,12);
});
test('pause/resume does not revive an old frame or multiply background loops; dot shows latest estimate',async()=>{
 const pending=[],frames=[],seen=[];let inFlight=0,maxInFlight=0;
 class Window{constructor(){this.data=[];}push(v){this.data.push(v);if(this.data.length>4)this.data.shift();}get(i){return this.data[i];}get length(){return this.data.length;}}
 const context={paused:false,loopGeneration:0,loopBusy:false,latestGazeData:null,smoothingVals:new Window(),src_k:0,
  src_webgazer:{params:{showGazeDot:true},util:{bound:p=>p}},window:{innerWidth:1000,innerHeight:800},gazeDot:{style:{}},videoElementCanvas:{width:640,height:480},
  paintCurrentFrame(){},clockStart:0,performance:{now:()=>10},requestAnimationFrame:fn=>frames.push(fn),callback:p=>seen.push(p),
  getPrediction:()=>{inFlight++;maxInFlight=Math.max(inFlight,maxInFlight);return new Promise(resolve=>pending.push(p=>{inFlight--;resolve(p);}));}};
 vm.createContext(context);const a=source.indexOf('async function loop(generation');const b=source.indexOf('//is problematic to test',a);vm.runInContext(source.slice(a,b),context);
 const old=context.loop();context.paused=true;context.loopGeneration++;context.paused=false;context.loopGeneration++;await context.loop();
 pending.shift()({x:900,y:700});await old;assert.equal(seen.length,0);
 const next=frames.shift()();pending.shift()({x:100,y:200});await next;assert.equal(maxInFlight,1);assert.equal(seen.length,1);assert.equal(context.gazeDot.style.transform,'translate3d(100px,200px,0)');
 const following=frames.shift()();pending.shift()({x:500,y:200});await following;assert.equal(context.gazeDot.style.transform,'translate3d(500px,200px,0)');
 context.paused=true;context.loopGeneration++;await frames.shift()();assert.equal(pending.length,0);
});
test('background and explicit inference requests are serialized even after a rejected request',async()=>{
 let active=0,maximum=0;const pending=[];
 const context={predictionInFlight:null,computePrediction:()=>{active++;maximum=Math.max(maximum,active);return new Promise((resolve,reject)=>pending.push({resolve:v=>{active--;resolve(v);},reject:e=>{active--;reject(e);}}));}};
 vm.createContext(context);const a=source.indexOf('async function getPrediction(regModelIndex)');const b=source.indexOf('async function computePrediction',a);vm.runInContext(source.slice(a,b),context);
 const first=context.getPrediction();const rejected=first.catch(e=>e.message);const second=context.getPrediction();assert.equal(pending.length,1);
 pending.shift().reject(new Error('failed camera frame'));await rejected;await Promise.resolve();assert.equal(pending.length,1);
 pending.shift().resolve({x:123});assert.equal((await second).x,123);assert.equal(maximum,1);assert.equal(context.predictionInFlight,null);
});
