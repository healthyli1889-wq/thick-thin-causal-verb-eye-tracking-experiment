// Exercises the actual vendored regression, with synthetic eye patches and no camera.
import assert from 'node:assert/strict';import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8765/');
 const result=await page.evaluate(()=>{
  const wg=window.webgazer,reg=wg.getRegression()[0];wg.applyKalmanFilter(false);
  let seed=13;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed>>>24;};
  const eye=()=>{const image=new ImageData(10,6);for(let i=0;i<image.data.length;i+=4){image.data[i]=random();image.data[i+1]=random();image.data[i+2]=random();image.data[i+3]=255;}return {width:10,height:6,patch:image};};
  const eyes=()=>({left:eye(),right:eye()});
  reg.init();for(let i=0;i<45;i++)reg.addData(eyes(),[100+(i%9)*100,100+Math.floor(i/9)*100],'click');
  const probes=Array.from({length:12},eyes),uncached=[],cached=[];
  let t=performance.now();for(const e of probes){reg.coefficientsCache=null;uncached.push(reg.predict(e));}const uncachedMs=performance.now()-t;
  t=performance.now();for(const e of probes)cached.push(reg.predict(e));const cachedMs=performance.now()-t;
  return {uncachedMs,cachedMs,maximumDifference:Math.max(...cached.flatMap((p,i)=>[Math.abs(p.x-uncached[i].x),Math.abs(p.y-uncached[i].y)])),status:wg.getCalibrationStatus()};
 });
 assert.equal(result.maximumDifference,0);assert.ok(Number.isFinite(result.cachedMs));
 fs.writeFileSync('/tmp/pilot-ridge-benchmark.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
