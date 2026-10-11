# Four-scene eye-tracking pilot: procedure, quality control, and readiness


## 1. Starting a session and assigning a participant

From this directory:

```sh
npm run verify
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/?allocation=1&v=2.6.0` in desktop Chrome. The next participant takes the next unused number on the roster. A URL with no number shows the researcher entry page. Participants should not choose their own number. The **full-flow preview** is `http://127.0.0.1:8765/?allocation=1&mode=preview&v=2.6.0`. It does not request the camera and does not apply a calibration cutoff. It plays the four videos and eight audio clips, then the questionnaire. The page stays labelled as a preview. Downloaded files begin with `preview-`, and the record has `mode=preview`, `gaze_enabled=false`, and `complete=false`. A preview that reaches the end sets only `flow_complete=true`. Item-level inspection is at `/preview.html`. Recovery for this browser is at `/recovery.html`. The camera needs localhost or HTTPS, and the runtime has to be allowed to load the models this WebGazer fork uses.

[allocation-roster.csv](allocation-roster.csv) holds 32 pre-assigned numbers. For each session, write an anonymous `participant_code`, the actual `session_id`, and a status. Keep names and other identifying information somewhere else. Do not reuse a number that has already been issued. A retest keeps the original row and is linked to it in writing. Decide the exclusion and replacement rules before recruitment starts. Several computers share one researcher roster. The browser has no central lock on who has been recruited.

The four scenes are A = path-break, B = car-bend, C = painting-crack, and D = juice-split.

| List | Video order |
|---|---|
| 1 | A B D C |
| 2 | B C A D |
| 3 | C D B A |
| 4 | D A C B |

This is a Williams balanced Latin square. Each video appears once in each serial position, and each ordered pair of neighbouring videos appears once. Crossing the square with standard versus mirrored layout, and with the two first-word patterns, gives 16 cells. Each participant sees two scenes thick-first and two thin-first. Over a full cycle of 16 people, first-word order and mirroring are balanced inside every scene. **A balanced allocation is not a balanced completed sample.** After withdrawals, failures, and no-shows, report the count in each cell. A single total N is not the balance check. A blank roster of another size can be written with `node scripts/allocation-roster.mjs new-roster.csv 64`. The script will not overwrite a file that already exists.

## 2. What each stage records, and what a failure means

| Stage | What is implemented and stored | Failure handling and limits |
|---|---|---|
| Before the session | `npm run verify` checks that the media decode, that each of the four videos is 4.000 s / 96 frames / 24 fps, and that the SHA-256 values in the build manifest match. The browser preloads every stimulus. | A failed preload does not enter the task. After a source file changes, review the diff, then run `npm run build` so the version fingerprint is new. The manifest is not a runtime tamper check. |
| Browser and consent | Desktop Chrome, a webcam, and at least 1280×720. The program requests fullscreen and records the browser, screen, viewport, and device pixel ratio. | The researcher still has to obtain real informed consent. The technical entry page is not an ethics procedure. |
| Room and sound | Vision, glasses, camera, distance, light direction, and headphone type are recorded. The neutral word *seven* is played in full and the participant responds. | A wrong answer can be retried once after an adjustment. A second error stops the session. This step only checks that speech is basically audible. It does not show that the eight study recordings sound natural. |
| Calibration training | Eight peripheral positions form one round and are reshuffled every round, for five rounds (40 clicks, one click per presentation). The centre is then clicked five times in a row, 45 clicks in all. A new position waits 750 ms, and clicks are at least 300 ms apart. Only a fresh, non-duplicate eye-feature frame is accepted, and only after the model's sample count has increased. Coordinates, times, and the accept or reject reason are stored. The predicted point is shown during training. | The model is trained again on every run. Confirm that 45 training samples were actually accepted. Mouse-movement training across the screen is off. A click is not, by itself, an independent accuracy test. Peripheral points are spread across rounds because repeated clicks on the same target share one head pose and one fixation, and add almost nothing to a 120-dimensional ridge fit. The centre comes last in order to follow Brown's `www/js/calibration.js`, where Pt5 appears only after the other eight points and the centre is measured immediately. **The centre score is therefore biased toward the centre. It is not an unbiased accuracy estimate. The five-point validation is.** |
| Brown centre measurement | A central cross is fixated for 5 seconds. Predictions are averaged over at most the last four points and clamped to the screen. The last 50 points are scored with the same formula as Brown's `calculatePrecision`. Raw predictions, smoothed points, the 50-point input, window size, and the score are saved. | **The score does not stop the session.** Score, mean error, and dispersion are stored in full. The `pass` field is still marked at ≥75, but that mark does not control the procedure. 75 is this study's reference level, not an official Brown standard. Fifty points are not every sample from the 5 seconds. |
| No-click validation (red dot visible) | Each of five targets waits 1 s and is then sampled for 2 s. The red dot is the same batch of raw predictions; there is no second inference loop. Error, offset, MAD, and rate are recomputed from the unsmoothed raw coordinates. The reference level is ≥50% of samples inside 200 CSS px at each point, and ≥15 Hz. | **Nothing is blocked and nothing is retried.** ROI percentage, offset, MAD, Hz, and the failure reason are stored for every point. A tab switch, a blur, or a resize is marked as missing the reference level, and the session continues. The measured scores are shown, and the next stage starts. |
| Pre-word fixation | A 1 s X. The last 80% of samples estimate the median x/y offset and the MAD. Offset may not exceed min(200 px, half the distance between the two characters). MAD must be ≤75 px, and the rate ≥15 Hz. | If the check fails, the offset correction is not applied. The raw values stay in the file. A correction only shifts the AOI. It does not rewrite a failed sample into a pass. |
| Video | Native `playing`, `ended`, `waiting`, `stalled`, and `error` events, performance time, frame callbacks, and a dropped-frame count. The trial ends on `ended`. No extra 405 ms is added. | A rejected play, an error, a timeout, or the wrong duration stops the session. Buffering, dropped frames, and a wall-clock duration off by one frame are QC flags. A 4 s media file is not a guarantee that the device displayed 4 s. |
| Picture plus audio, with gaze | Recording starts at the first `playing` event and runs for 3 s. The actual word, audio file, playback events, duration, and whether the clip ended are saved, together with raw gaze, time, viewport, AOI, and interruptions. | Failure to start, no start within 10 s, or a clip that has not finished within 3 s stops the session. Buffering and similar events fail the analysis QC. `playing` is a software event. It is not a measured acoustic onset at the earphone. |
| Question response | The full question text, the options as displayed and their order, the distal or proximal choice, RT, condition, `probe_id`, scene position, and raw gaze during the response are stored. | Response and gaze join on `probe_id`. The question page has no object AOI. The position of an option is not the video character's AOI. |
| End questionnaire | Age, English background (native / near-native / additional language), major, and suggestions, plus lighting, calibration clarity, video naturalness, and audio difficulty, each on a 1–7 scale. | Audio difficulty stays negatively worded. That item alone cannot pass or fail attention. Lighting at the start is stored as `lighting_setup`. Lighting at the end is stored as `lighting`. |
| Midpoint and end | After two videos, Brown measurement and validation run again. Recalibration is available at the midpoint. Both run once more at the end, and the final quality record is saved. | A failure at the end is recorded as such. Earlier samples are not retrospectively marked accurate. |
| Save and completeness | UUID, `logical_id`, and a ledger of starts, ends, and branches. The check looks for missing rows, duplicate rows, rows with no start or no end, a mismatched session, missing critical fields, and gaze that is invalid or out of order. | `complete` requires that the procedure was not stopped and that the stage records, field correspondence, and continuous-sample integrity checks all passed. `complete=true` is still not scientific validity, and it is not proof that the download reached disk. |
| Recovery | IndexedDB is written before and after each trial. During a gaze trial a partial snapshot is saved about once a second. At the end the raw JSON is downloaded and can be downloaded again. | A crash can lose the last snapshot that was not committed. Partial records are labelled `partial`. They are not presented as finished trials. There is no remote backend. Clearing the browser, private mode, or a storage failure can make recovery unavailable. |

The Brown formula was checked against the installed file `../WebGazer-master/www/js/precision_calculation.js`. The regression test calls that function directly and compares it, input by input, on 100 shared inputs. The scores match. The formula is:

`round(mean(max(0, 100 − 100 × distance_to_center / (viewport_height / 2))))`

**What matches is the scoring formula and the local smoothing and clamping steps.** The two programs are not claimed to share a prediction model, sampling times, a full interface, or real-world accuracy. This study keeps the [fork that jsPsych requires](https://www.jspsych.org/v8/overview/eye-tracking/). The downloaded Brown v3 bundle was not dropped in as a replacement. A Brown score is a distance from the centre. It is not "90% of AOI judgements were correct." During the real task the predicted point and the camera image are hidden. The file stores coordinates, not a camera recording, a GIF, or a server-side screen capture.

## 3. The four scenes, eight recordings, and questions

**Checked against the latest explicit instruction: keep the four existing silent geometric videos, bend, break, crack, and split.** The audio is the isolated phrase `cause to X` or `X`, not a full sentence. The person videos under `materials` are a different set of files. They are not evidence that the current experiment is using the wrong stimuli. The earlier conclusion that the original person videos had to be wired in is withdrawn. File sources and the correction are in the [materials audit](docs/MATERIALS-AUDIT-2026-10-03.md).

The table below is the stimulus definition currently in the code, plus the source statement. The media decode. **The eight recordings have not yet had an independent word-for-word listen-through, and their word boundaries have not been annotated.**

| Scene | Thick audio → question | Thin audio → question | Distal / proximal options |
|---|---|---|---|
| Fence | `break` → Who broke the fence? | `cause to break` → Who caused the fence to break? | The green triangle / The red cube |
| Road sign | `bend` → Who bent the sign? | `cause to bend` → Who caused the sign to bend? | The blue car / The orange car |
| Painting | `crack` → Who cracked the painting? | `cause to crack` → Who caused the painting to crack? | The yellow triangle / The purple cube |
| Drink | `split` → Who split the drink? | `cause to split` → Who caused the drink to split? | The teal capsule / The brown cube |

Each scene plays one 4.000 s video. Two probes then follow. Each probe is an X fixation, an 800 ms picture preview, audio with gaze recording, and a written question with two options and a response. Every scene contains thick once and thin once. Which comes first is set by the roster. Videos are labelled Scenario 1–4. If the initial tracking check fails, all four scenes are skipped. If the midpoint check fails, the remaining scenes are skipped. The failure page shows the centre score and the status of the five-point check.

From the start of the video until the second response, one sampler keeps running in the background. It covers the video, the X, the picture, the audio, the response, and the transitions. `continuous_gaze` stores raw coordinates, request and receipt times, scene, phase, and viewport. `continuous_segments` stores the start and end of each scene. A prediction that arrives late stays in the continuous record. It is not pushed into the next phase as a negative-time sample. Calibration checks are stored separately. A missing face, a failed inference, or a slow device can still drop samples. This is not a claim of physiologically continuous measurement. "Background" here means the browser, on this machine. There is no remote upload server. The audio is the existing Samantha phrase recordings. The questions are not spoken. The order matches the original request of verb, then question. Hearing the full question aloud would mean changing the materials, the audio, and the word onsets together. The drink scene keeps *split*, as specified. Paths and the literal text are in [src/stimuli.js](src/stimuli.js).


## 4. How to analyze pilot data in R or Python

The raw JSON is the audit file. It keeps the full structure, configuration, allocation, version, build fingerprint, media events, and coordinates that have not been rewritten. The exporter does not edit that file and does not quietly drop a participant with poor data. Invalid samples stay in the export, with a flag. Missing values are empty fields, not zeros. Preview keeps its mode flag. The accompanying R and Python response summaries exclude `mode=preview` and `synthetic_test_data=true` by default. A preview is not participant data.

```sh
node analysis/export.mjs /path/to/session.json /path/to/derived
# or several independent session JSON files in one directory:
node analysis/export.mjs /path/to/raw-sessions /path/to/derived
python3 analysis/describe.py /path/to/derived
Rscript analysis/describe.R /path/to/derived
```

| CSV | What it is for, and its key |
|---|---|
| participants | One row per session: allocation, version, completion, environment, questionnaire. `session_id` is the key. Linking a retest to the real participant still depends on the researcher's roster. |
| trials | Every stage, question text, options, response, RT, audio, video, and QC. Key: `session_id` + `logical_id`. |
| samples | Each raw gaze sample, source `sample_index`, x/y, Δx/Δy, time, raw and corrected AOI, and validity. Key: `session_id` + `logical_id` + `sample_index`. |
| continuous_samples | The raw gaze stream across phases of a scene, including the response. Key: `session_id` + `sample_index`. It overlaps `samples`. Do not stack the two tables and count the samples twice. |
| windows | `phase`, `corrected_phase`, `word_window`, and `corrected_word_window`: mean, SD, dwell, missingness, and quality status. A window whose word onset was never verified is marked `unavailable`. |
| bins | 100 ms time bins for exploring the time course. Time is relative to the audio. A bin is not a real sampling frame. |
| validation_points | Quality at each validation target, on each validation. These can be summarised by person or by stage. |
| events | Branches, starts, ends, and window interactions, for finding skips, interruptions, and anomalies. |
| partial_samples | Gaze from a crash recovery that never became a finished trial. Stored apart from the complete trials. |

The CSVs are UTF-8. Time columns carry an `ms` or `s` suffix. Coordinates are CSS pixels. `x_signed_distal` is scaled to the actual character centres (distal = +1, proximal = −1, midline = 0), not to the middle of the screen. Geometry and complex event columns stay as JSON strings and can be expanded with Python `json` or R `jsonlite`. The export refuses a repeated `session_id`, so an original download and a recovery copy are not both counted. The raw JSON also keeps the 50 Brown scoring points and the raw validation samples. The CSV summaries do not replace them.

What is appropriate now is **technical quality and description**: pass and withdrawal rates, sampling rate, missingness, within-condition participant means, and response proportions. After the materials are validated, preregister a mixed model of trial-level gaze allocation and a logistic mixed model of the binary choice, keeping the subject, item, condition, and order structure. Several thousand gaze samples are not several thousand independent participants, and they should not be entered that way into a t-test or an ANOVA. Estimands, windows, and limits are in [METHODS-AND-TECH-SPEC.md](docs/METHODS-AND-TECH-SPEC.md).



## 5. Examined factors (current)

The reproducible test record is in [VERIFICATION.md](docs/VERIFICATION.md). The tests cover the Brown formula, Latin-square balance, isolation of late predictions, rejected promises, missing and duplicate records, window timing, playback end, rejection, and timeout, and the browser save path. They show that those cases are handled. **They do not show that every risk has been closed.** Before formal recruitment, freeze the version, finish the four research checks above, and run the full procedure at least once on the real device, including a tab switch, a quit, and a data recovery.
