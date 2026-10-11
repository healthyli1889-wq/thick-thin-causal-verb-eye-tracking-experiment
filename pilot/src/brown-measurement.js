// Arithmetic matches the supplied Brown www/js/precision_calculation.js.
// The prediction engine remains jsPsych's supported fork; this is not a claim
// that Brown v3 and the fork yield identical raw predictions or sampling times.
export function brownPrecision(past50,width,height) {
  if(!(Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0)||past50?.length!==2||past50.some(a=>a.length!==50||a.some(v=>!Number.isFinite(v))))return null;
  let sum=0;
  for(let i=0;i<50;i++) {
    const dx=width/2-past50[0][i],dy=height/2-past50[1][i];
    const distance=Math.sqrt(dx*dx+dy*dy);
    sum+=distance<=height/2 ? 100-distance/(height/2)*100 : 0;
  }
  return Math.round(sum/50);
}
export function brownMeasurement(samples,viewport,bounds=viewport) {
  const smooth=[],display=[];
  for(const p of samples) {
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    smooth.push(p);if(smooth.length>4)smooth.shift();
    display.push({t:p.t,x:Math.max(0,Math.min(bounds.width,smooth.reduce((n,q)=>n+q.x,0)/smooth.length)),
      y:Math.max(0,Math.min(bounds.height,smooth.reduce((n,q)=>n+q.y,0)/smooth.length))});
  }
  const last50=display.slice(-50),past50=[last50.map(p=>p.x),last50.map(p=>p.y)];
  const distances=last50.map(p=>Math.hypot(p.x-viewport.width/2,p.y-viewport.height/2));
  const avg=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:null;
  const rawLast50=samples.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(-50);
  const meanX=avg(last50.map(p=>p.x)),meanY=avg(last50.map(p=>p.y));
  return {diagnostics:{target_x:viewport.width/2,target_y:viewport.height/2,
      mean_error_px:avg(distances),mean_capped_error_px:avg(distances.map(d=>Math.min(d,viewport.height/2))),
      mean_dx_px:meanX===null?null:meanX-viewport.width/2,mean_dy_px:meanY===null?null:meanY-viewport.height/2,
      rms_dispersion_px:last50.length?Math.sqrt(avg(last50.map(p=>(p.x-meanX)**2+(p.y-meanY)**2))):null,
      raw_center_score:brownPrecision([rawLast50.map(p=>p.x),rawLast50.map(p=>p.y)],viewport.width,viewport.height)},
    score:brownPrecision(past50,viewport.width,viewport.height),past50,display_points:display,
    raw_count:samples.length,finite_count:display.length,
    formula:'Brown www calculatePrecision: round(mean(max(0,100-100*distance/(height/2))))',
    input_pipeline:'jsPsych-fork predictions -> trailing-four mean -> viewport-bound -> last 50',
    viewport,bounds,recorded_window_ms:last50.length?last50.at(-1).t-last50[0].t:null};
}

export function brownPass(measurement,minimumScore,interruptions=[]) {
  return Number.isFinite(measurement?.score)&&measurement.score>=minimumScore&&interruptions.length===0;
}
