var jsPsychWebgazerCalibrate = (function (jspsych) {
  'use strict';

  var version = "2.1.0";

  const info = {
    name: "webgazer-calibrate",
    version,
    parameters: {
      minimum_click_interval: {type:jspsych.ParameterType.INT,default:300},
      maximum_feature_age: {type:jspsych.ParameterType.INT,default:500},
      /** Array of points in `[x,y]` coordinates. Specified as a percentage of the screen width and height, from the left and top edge. The default grid is 9 points. */
      calibration_points: {
        type: jspsych.ParameterType.INT,
        // TO DO: nested array, so different type?
        default: [
          [10, 10],
          [10, 50],
          [10, 90],
          [50, 10],
          [50, 50],
          [50, 90],
          [90, 10],
          [90, 50],
          [90, 90]
        ],
        array: true
      },
      /** Can specify `click` to have participants click on calibration points or `view` to have participants passively watch calibration points.  */
      calibration_mode: {
        type: jspsych.ParameterType.SELECT,
        options: ["click", "view"],
        default: "click"
      },
      /** Diameter of the calibration points in pixels. */
      point_size: {
        type: jspsych.ParameterType.INT,
        default: 20
      },
      /** The number of times to repeat the sequence of calibration points. */
      repetitions_per_point: {
        type: jspsych.ParameterType.INT,
        default: 1
      },
      /** Whether to randomize the order of the calibration points. */
      randomize_calibration_order: {
        type: jspsych.ParameterType.BOOL,
        default: false
      },
      /** If `calibration_mode` is set to `view`, then this is the delay before calibrating after showing a point.
       * Gives the participant time to fixate on the new target before assuming that the participant is looking at the target. */
      time_to_saccade: {
        type: jspsych.ParameterType.INT,
        default: 1e3
      },
      /**
       * If `calibration_mode` is set to `view`, then this is the length of time to show a point while calibrating. Note
       * that if `click` calibration is used then the point will remain on the screen until clicked.
       */
      time_per_point: {
        type: jspsych.ParameterType.INT,
        default: 1e3
      }
    },
    data: {
      // no data collected
    },
    // prettier-ignore
    citations: {
      "apa": "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
      "bibtex": '@article{Leeuw2023jsPsych, 	author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Bj{\\" o}rn}, 	journal = {Journal of Open Source Software}, 	doi = {10.21105/joss.05351}, 	issn = {2475-9066}, 	number = {85}, 	year = {2023}, 	month = {may 11}, 	pages = {5351}, 	publisher = {Open Journals}, 	title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, 	url = {https://joss.theoj.org/papers/10.21105/joss.05351}, 	volume = {8}, }  '
    }
  };
  class WebgazerCalibratePlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }
    static {
      this.info = info;
    }
    trial(display_element, trial) {
      const extension = this.jsPsych.extensions.webgazer;
      var html = `
          <div id='webgazer-calibrate-container' style='position: fixed; inset:0; width:100vw; height:100vh'>
          </div>`;
      display_element.innerHTML = html;
      var wg_container = display_element.querySelector("#webgazer-calibrate-container");
      var reps_completed = 0;
      var points_completed = -1;
      var cal_points = null;
      const clickLog=[], attempts=[];
      let previousPosition=null, targetSince=0, lastAccepted=-Infinity, lastFeature=-Infinity;
      const status=document.createElement('div');status.id='calibration-status';
      status.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);font:16px Arial;z-index:10;text-align:center';
      display_element.append(status);
      const next_calibration_round = () => {
        if (trial.randomize_calibration_order) {
          cal_points = this.jsPsych.randomization.shuffle(trial.calibration_points);
        } else {
          cal_points = trial.calibration_points;
        }
        points_completed = -1;
        next_calibration_point();
      };
      const calibrate = () => {
        extension.resume();
        if (trial.calibration_mode == "click") {
          extension.stopMouseCalibration();
        }
        next_calibration_round();
      };
      const next_calibration_point = () => {
        points_completed++;
        if (points_completed == cal_points.length) {
          reps_completed++;
          if (reps_completed == trial.repetitions_per_point) {
            calibration_done();
          } else {
            next_calibration_round();
          }
        } else {
          var pt = cal_points[points_completed];
          calibration_display_gaze_only(pt);
        }
      };
      const calibration_display_gaze_only = (pt) => {
        var pt_html = `<div id="calibration-point" style="width:${trial.point_size}px; height:${trial.point_size}px; border-radius:${trial.point_size}px; border: 1px solid #000; background-color: #333; position: absolute; left:${pt[0]}%; top:${pt[1]}%; transform:translate(-50%,-50%);"></div>`;
        wg_container.innerHTML = pt_html;
        var pt_dom = wg_container.querySelector("#calibration-point");
        if (trial.calibration_mode == "click") {
          const changed=!previousPosition||previousPosition[0]!==pt[0]||previousPosition[1]!==pt[1];
          if(changed)targetSince=performance.now();previousPosition=pt;
          status.textContent=`Look at the fixed dark dot and click slowly. Red = estimate still being trained. ${clickLog.length} / ${trial.calibration_points.length*trial.repetitions_per_point}`;
          pt_dom.style.cursor = 'pointer';
          pt_dom.addEventListener('click', (event) => {
            const now=performance.now(), before=extension.webgazer.getCalibrationStatus?.();
            const reason=!before?'diagnostics-unavailable':now-targetSince<trial.time_to_saccade?'settling':
              now-lastAccepted<trial.minimum_click_interval?'click-too-fast':
              before.paused||!before.face_detected?'face-not-detected':
              !Number.isFinite(before.feature_age_ms)||before.feature_age_ms>trial.maximum_feature_age?'stale-eye-features':
              before.feature_time_ms<targetSince+trial.time_to_saccade||before.feature_time_ms<=lastFeature?'waiting-for-fresh-frame':null;
            const rect=pt_dom.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
            const entry={x:event.clientX,y:event.clientY,target_x:x,target_y:y,performance_ms:now,
              target_shown_ms:targetSince,status_before:before,accepted:false,reason};
            if(reason){attempts.push(entry);status.textContent=reason==='face-not-detected'?'Keep your face visible and look at the dot.':'Keep looking at the dot; wait briefly before clicking again.';return;}
            // Train ONLY the explicitly fixated target. No global click/mousemove listener.
            extension.calibratePoint(x,y);
            entry.status_after=extension.webgazer.getCalibrationStatus();
            entry.accepted=before.training_counts.length>0&&before.training_counts.every((n,i)=>entry.status_after.training_counts[i]===n+1);
            if(!entry.accepted){entry.reason='model-did-not-accept';attempts.push(entry);status.textContent='Tracking was interrupted. Keep your face visible and try again.';return;}
            attempts.push(entry);clickLog.push(entry);lastAccepted=now;lastFeature=before.feature_time_ms;
            next_calibration_point();
          });
        }
        if (trial.calibration_mode == "view") {
          var br = pt_dom.getBoundingClientRect();
          var x = br.left + br.width / 2;
          var y = br.top + br.height / 2;
          var pt_start_cal = performance.now() + trial.time_to_saccade;
          var pt_finish = performance.now() + trial.time_to_saccade + trial.time_per_point;
          const watch_dot = () => {
            if (performance.now() > pt_start_cal) {
              extension.calibratePoint(x, y);
            }
            if (performance.now() < pt_finish) {
              requestAnimationFrame(watch_dot);
            } else {
              next_calibration_point();
            }
          };
          requestAnimationFrame(watch_dot);
        }
      };
      const calibration_done = () => {
        if (trial.calibration_mode == "click") {
          extension.stopMouseCalibration();
        }
        end_trial();
      };
      const end_trial = () => {
        wg_container?.remove();
        status?.remove();
        try { extension.pause(); extension.hidePredictions(); extension.hideVideo(); } catch (e) {}
        var training_status = null;
        try { training_status = extension.webgazer.getCalibrationStatus?.(); } catch (e) {}
        var trial_data = {calibration_clicks:clickLog,calibration_click_attempts:attempts,training_status,training_policy:'target-only; settled fresh eye features; model insertion verified'};
        this.jsPsych.finishTrial(trial_data);
      };
      calibrate();
    }
  }

  return WebgazerCalibratePlugin;

})(jsPsychModule);
