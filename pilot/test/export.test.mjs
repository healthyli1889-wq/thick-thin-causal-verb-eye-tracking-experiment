import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {makePayload} from '../src/storage.js';import {CONFIG} from '../src/config.js';

const baseSession=()=>({id:'s1',ledger:[],interactions:[],requiredIds:[],stopReason:null,
  initialValidationPass:false,finalValidationPass:false,mode:'study',assignment:{},environment:{},manifest:null});
const brown=(id,score,pass)=>({logical_id:id,task:'brown-measurement',pass,
  measurement:{score,diagnostics:{mean_error_px:(100-score)*4,rms_dispersion_px:120}}});
const validation=(id,pass,hz)=>({logical_id:id,task:'validation',
  verdict:{pass,failed:pass?[]:['every_point_in_roi'],perPoint:hz.map(h=>({hz:h}))}});

test('a low accuracy score is recorded and labelled, and never reported as screened',()=>{
  const low=makePayload(baseSession(),
    [brown('initial-brown-1',41,false),validation('initial-validation-1',false,[12.4,19,17.2]),
     brown('final-brown-1',38,false),validation('final-validation-1',false,[15.8,14.1])],
    CONFIG,{ok:true});
  // Nothing stopped the run, so completion must not be readable as a quality claim.
  assert.equal(low.stop_reason,null);
  assert.equal(low.tracking_quality_gate,'recorded-not-enforced');
  assert.equal(low.confirmatory_ready,false);
  assert.ok(low.quality.blockers.some(b=>b.includes('recorded but not screened')));

  const tq=low.quality.tracking_quality;
  assert.equal(tq.enforced,false);
  assert.equal(tq.recalibration_attempts_offered,0);
  assert.equal(tq.reference_levels_met,false);
  assert.equal(tq.lowest_brown_score,38);
  assert.equal(tq.lowest_validation_hz,12.4);
  assert.equal(tq.reference_levels.brown_minimum_score,CONFIG.calibration.brownMinimumScore);
  assert.equal(tq.reference_levels.validation_minimum_hz,CONFIG.calibration.minimumHz);
  // Every measurement survives individually, not just the summary.
  assert.deepEqual(tq.brown_scores.map(s=>s.score),[41,38]);
  assert.ok(tq.brown_scores.every(s=>!s.meets_reference&&Number.isFinite(s.mean_error_px)));
});

test('reference levels are still labelled as met when they are, and fail closed when unmeasured',()=>{
  const good=makePayload(baseSession(),
    [brown('b',88,true),validation('v',true,[24,22])],CONFIG,{ok:true});
  assert.equal(good.quality.tracking_quality.reference_levels_met,true);
  assert.equal(good.quality.tracking_quality.lowest_brown_score,88);

  // No calibration at all must not read as a pass.
  assert.equal(makePayload(baseSession(),[],CONFIG,{ok:true}).quality.tracking_quality.reference_levels_met,false);
  // One side measured and failing is still a failure.
  assert.equal(makePayload(baseSession(),[brown('b',88,true),validation('v',false,[9])],
    CONFIG,{ok:true}).quality.tracking_quality.reference_levels_met,false);
});

test('the quality gate stays disabled in config',()=>{
  assert.equal(CONFIG.calibration.qualityGateEnforced,false);
  assert.equal(CONFIG.calibration.recalibrationAttemptsOffered,0);
});

test('export preserves mismatched source IDs and malformed samples; duplicate sessions fail',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pilot-export-test-'));
  try{
    const input=path.join(dir,'session.json'),out=path.join(dir,'out');
    const payload={session_id:'file-session',mode:'study',environment:{synthetic_test_data:true},trials:[{
      session_id:'wrong-source-session',logical_id:'v',task:'video',webgazer_data:[{x:10,y:20,t:1}],capture_duration_ms:10}]};
    const source=JSON.stringify(payload);fs.writeFileSync(input,source);
    const script=new URL('../analysis/export.mjs',import.meta.url).pathname;
    const run=(...args)=>spawnSync(process.execPath,[decodeURIComponent(script),...args],{encoding:'utf8'});
    const result=run(input,out);assert.equal(result.status,0,result.stderr);
    assert.equal(fs.readFileSync(input,'utf8'),source);
    for(const file of ['trials.csv','samples.csv']){
      const csv=fs.readFileSync(path.join(out,file),'utf8');
      assert.ok(csv.includes('source_session_id'));assert.ok(csv.includes('"wrong-source-session"'));assert.ok(csv.includes('"file-session"'));
    }
    const participants=fs.readFileSync(path.join(out,'participants.csv'),'utf8');
    assert.ok(participants.includes('session-id-mismatch'));assert.ok(participants.includes('missing-time-or-geometry'));
    const duplicates=path.join(dir,'duplicate');fs.mkdirSync(duplicates);
    fs.writeFileSync(path.join(duplicates,'a.json'),source);fs.writeFileSync(path.join(duplicates,'b.json'),source);
    const rejected=run(duplicates,path.join(dir,'bad-out'));assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/duplicate session_id/);
    assert.equal(fs.existsSync(path.join(dir,'bad-out')),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
