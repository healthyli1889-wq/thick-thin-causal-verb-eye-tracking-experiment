var jsPsychWebgazerInitCamera = (function (jspsych) {
  'use strict';

  var version = "2.1.0";

  const info = {
    name: "webgazer-init-camera",
    version,
    parameters: {
      /** Instructions for the participant to follow. */
      instructions: {
        type: jspsych.ParameterType.HTML_STRING,
        default: `
            <p>Position your head so that the webcam has a good view of your eyes.</p>
            <p>Center your face in the box and look directly towards the camera.</p>
            <p>It is important that you try and keep your head reasonably still throughout the experiment, so please take a moment to adjust your setup to be comfortable.</p>
            <p>When your face is centered in the box and the box is green, you can click to continue.</p>`
      },
      /** The text for the button that participants click to end the trial. */
      button_text: {
        type: jspsych.ParameterType.STRING,
        default: "Continue"
      }
    },
    data: {
      /** The time it took for webgazer to initialize. This can be a long time in some situations, so this
       * value is recorded for troubleshooting when participants are reporting difficulty.
       */
      load_time: {
        type: jspsych.ParameterType.INT
      }
    },
    // prettier-ignore
    citations: {
      "apa": "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
      "bibtex": '@article{Leeuw2023jsPsych, 	author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Bj{\\" o}rn}, 	journal = {Journal of Open Source Software}, 	doi = {10.21105/joss.05351}, 	issn = {2475-9066}, 	number = {85}, 	year = {2023}, 	month = {may 11}, 	pages = {5351}, 	publisher = {Open Journals}, 	title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, 	url = {https://joss.theoj.org/papers/10.21105/joss.05351}, 	volume = {8}, }  '
    }
  };
  class WebgazerInitCameraPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }
    static {
      this.info = info;
    }
    trial(display_element, trial, on_load) {
      const extension = this.jsPsych.extensions.webgazer;
      let trial_complete,finished=false,observer;
      const completion=new Promise(resolve=>{trial_complete=resolve;});
      var start_time = performance.now();
      var load_time;
      const end_trial = (error=null) => {
        if(finished)return;finished=true;observer?.disconnect();
        extension.pause();
        extension.hideVideo();
        if(error){try{extension.webgazer.end();}catch{}}
        var trial_data = {
          load_time:load_time??Math.round(performance.now()-start_time),camera_error:error
        };
        document.querySelector("#webgazer-center-style")?.remove();
        this.jsPsych.finishTrial(trial_data);
        trial_complete();
      };
      const cancelButton='<button id="jspsych-wg-stop" class="jspsych-btn">End session and save diagnostics</button>';
      const cancel=()=>end_trial({name:'CameraSetupCanceled',message:'Participant ended camera setup'});
      display_element.innerHTML=`<p>Starting the camera and eye tracker…</p>${cancelButton}`;
      document.querySelector('#jspsych-wg-stop').addEventListener('click',cancel);
      const showTrial = () => {
        if(finished){extension.pause();extension.webgazer.end();return;}
        on_load();
        load_time = Math.round(performance.now() - start_time);
        var style = `
          <style id="webgazer-center-style">
            #webgazerVideoContainer { top: 20px !important; left: calc(50% - 160px) !important;}
          </style>
        `;
        document.querySelector("head").insertAdjacentHTML("beforeend", style);
        var html = `
          <div id='webgazer-init-container' style='position: relative; width:100vw; height:100vh'>
          </div>`;
        display_element.innerHTML = html;
        extension.showVideo();
        extension.resume();
        var wg_container = display_element.querySelector("#webgazer-init-container");
        wg_container.innerHTML = `
          <div style='position: absolute; top: max(260px, 40%); left: calc(50% - 400px); width:800px;'>
          ${trial.instructions}
          <button id='jspsych-wg-cont' class='jspsych-btn' disabled>${trial.button_text}</button>
          ${cancelButton}
          </div>`;
        document.querySelector('#jspsych-wg-stop').addEventListener('click',cancel);
        if (is_face_detect_green()) {
          document.querySelector("#jspsych-wg-cont").disabled = false;
        } else {
          observer = new MutationObserver(face_detect_event_observer);
          observer.observe(document, {
            attributes: true,
            attributeFilter: ["style"],
            subtree: true
          });
        }
        document.querySelector("#jspsych-wg-cont").addEventListener("click", () => {
          if (observer) {
            observer.disconnect();
          }
          end_trial();
        });
      };
      if (!extension.isInitialized()) {
        extension.start().then(() => {
          showTrial();
        }).catch((error) => {
          end_trial({name:error.name||'CameraStartError',message:String(error.message||error)});
        });
      } else {
        showTrial();
      }
      function is_face_detect_green() {
        if (document.querySelector("#webgazerFaceFeedbackBox")) {
          return document.querySelector("#webgazerFaceFeedbackBox").style.borderColor == "green";
        } else {
          return false;
        }
      }
      function face_detect_event_observer(mutationsList, observer) {
        if (mutationsList[0].target == document.querySelector("#webgazerFaceFeedbackBox")) {
          if (mutationsList[0].type == "attributes" && mutationsList[0].target.style.borderColor == "green") {
            document.querySelector("#jspsych-wg-cont").disabled = false;
          }
          if (mutationsList[0].type == "attributes" && mutationsList[0].target.style.borderColor == "red") {
            document.querySelector("#jspsych-wg-cont").disabled = true;
          }
        }
      }
      return completion;
    }
  }

  return WebgazerInitCameraPlugin;

})(jsPsychModule);
