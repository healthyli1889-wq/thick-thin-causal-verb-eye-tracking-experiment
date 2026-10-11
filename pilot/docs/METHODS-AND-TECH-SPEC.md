> Updated 2026-10-03 for pilot-2.4.1/schema-3.5.0. Current operational QC and allocation instructions: [README](../README.md). Scientific readiness remains false.

> User clarification supersedes the previous material-source warning: the intended
> stimuli are the existing four minimalist geometric silent videos and separate
> `cause to X` / `X` recordings. Human-character videos elsewhere in `materials`
> are not the requested replacement. See the [correction](MATERIALS-AUDIT-2026-10-03.md).

# Methods and technical specification — October 2, 2026

## 1. Study question and scope

The linked [study document](https://docs.google.com/document/d/1w14ctG9VVMLFM2qofqnmD1T8KECe4B4O6ZSwTBsnmyg/edit) was read across all eight tabs, including nested meeting tabs; the first tab was empty. The populated tabs were Experiment Design v2, Meeting 8/27, eye tracking & pilot, Meeting 9/3, Pilot subject test, 标签页 7, and 标签页 8 (Meeting 9/28). Earlier material discussed process versus result; the recent four-event pilot asks about distal versus proximal causes. They are distinct contrasts and should not be merged in the analysis.

Working RQ: **After viewing a causal event, does causal wording change the relative attention (operationalized as eye gazing direction) allocated to the distal and proximal causal candidates?** 

Working prediction: the periphrastic form shifts relative attention toward the distal candidate compared with the lexical form. This is a prediction to test, not a scoring key defining correct responses. Behavioral choices are not calibration measurements.

The requested sequence is retained: one video, then phrase → written question and response, twice per event. Because the phrase comes after the video, video-period gaze is a pre-language observation, not an effect of that phrase. The user-selected audio manipulation is the isolated phrase pair “break” versus “cause to break”, followed by a written question. Retain that format; complete spoken questions are not required. Describe the implemented task as **post-event phrase priming and causal choice**, and limit inference to that manipulation.

## 2. Materials and design decisions


| Event          | Current recordings     | Written questions                                             | Outstanding issue                                                                             |
| -------------- | ---------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| path-break     | break / cause to break | Who broke the fence? / Who caused the fence to break?         | Final-frame candidates too close                                                              |
| car-bend       | bend / cause to bend   | Who bent the sign? / Who caused the sign to bend?             | Final-frame candidates too close                                                              |
| painting-crack | crack / cause to crack | Who cracked the painting? / Who caused the painting to crack? | Confirm that viewers perceive the intended causal chain                                       |
| juice-split    | split / cause to split | Who split the drink? / Who caused the drink to split?         | Decide whether the intended event is **spill**, not split; rerecord and rename together if so |


`src/stimuli.js` identifies all four MP4s, four tableaux, and eight MP3s.
`juice-split-v050` is the selected source asset. ffprobe verifies 96 frames, 24 fps, and exactly 4.000 s for each selected video. The old assets are copied without alteration. Audio onsets are **null**, not the unverified old 10–20 ms values. Enter independently annotated word boundaries and their provenance when replacing the recordings; do not infer them from file duration.

Within each session, two items are thin-first and two thick-first; event order uses a four-list Williams balanced Latin square, crossed with two layouts and two first-probe patterns across 16 roster-assigned cells. See `../README.md` and `../allocation-roster.csv`. This reduces order imbalance but does not eliminate contrastive responding or carryover. Analyze first probes separately in a pilot sensitivity check. For a confirmatory study, present each item in one condition per participant, cross conditions over counterbalanced lists, add validated items/fillers, and estimate the needed sample and item counts by simulation. There is no universal “16 items makes it publishable” threshold.

The old fixed 0–35% / 65–100% bands missed the characters. The revised pilot uses item-specific approximate candidate centers from the existing audit and splits the tableau at their midpoint; mirrored layouts preserve causal role. These are **exploratory spatial sides**, not verified object outlines. Dynamic video AOIs are deliberately unassigned until per-frame annotations exist.

At a 1280 px stage, current horizontal separations are approximately 307, 294, 333, and 166 px. A 200 px tolerance can cross their midpoint. The proposed “200 ≤ half-width 224” assumes an unscaled 448 px AOI that actually contains the target; neither assumption establishes validity here. Runtime geometry records the actual stage, separation, and `radius200SupportsSeparation` flag. Do not declare an AOI classification validated merely because the camera gate passes. Re-render a neutral response display with more separated candidates, export projected object bounds, and verify held-out looks to both candidates before formal collection.

## 3. Brown demo score versus study validation

The downloaded Brown source implements nine dots × five clicks, with the
center revealed after the other eight. `www/js/calibration.js::calcAccuracy`
waits five seconds, retrieves a 50-point circular buffer, and calls
`precision_calculation.js::calculatePrecision`. Its score is:

`round(mean(100 × max(0, 1 − distance_to_center / (viewport_height / 2))))`.

It is a screen-height-normalized central distance score. It is neither “90%
correct trials” nor “90% of gaze inside the AOI,” nor a general measure of
precision as dispersion. The downloaded function offers Continue/Recalibrate;
it does not require a score above 90. Five seconds of waiting also does not
make the final 50 points a complete five-second record.

In `src/index.mjs`, the gaze callback precedes four-prediction averaging and
boundary limiting used for display/stored demo points. That supports the
distinction in the supplied notes **for this Brown version**. It must not be
assumed to describe the study's separate fork. The local Brown function table
is useful source documentation, not a specification of jsPsych measurements.


| Purpose                    | Brown reference                                         | Study implementation                                            |
| -------------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| Train gaze mapping         | `recordScreenPosition`, regression `addData`            | `webgazer-calibrate`, nine positions × five repetitions         |
| Inspect camera positioning | video/face overlay                                      | `webgazer-init-camera`                                          |
| Demo center feedback       | `calcAccuracy`, `getStoredPoints`, `calculatePrecision` | Reproduced score ≥75 PLUS no-click validation gate with visible prediction feedback                                      |
| Independent spatial check  | Custom demo needed for multiple targets                 | `webgazer-validate`, no clicking/training                       |
| Per-trial predictions      | `setGazeListener` / `getCurrentPrediction`              | `extension-webgazer` plus `onGazeUpdate` observer               |
| Retry coaching             | Generic recalibration option                            | Measured sample/ROI failure → practical suggestions → new check |
| Persistent study record    | Not supplied by the visible dots                        | Our trial journal and JSON export                               |


Official [jsPsych eye-tracking documentation](https://www.jspsych.org/v8/overview/eye-tracking/)
requires its compatible WebGazer fork. Its integrated example uses 200 px and
recalibrates if any point is below 50%; that is example logic, not a universal
research acceptance standard. The [validation plugin](https://www.jspsych.org/v8/plugins/webgazer-validate/)
provides raw points, offsets, percentages, and sampling summaries. The revised
study uses these raw points to recompute each target's result.

The [YouTube tutorial](https://www.youtube.com/watch?v=Wh77ZGdIaZQ) could not be
retrieved during this review. Installation/calibration claims were checked
against the installed source and official documentation instead.

## 4. Acceptance rules and participant guidance

These are explicit **pilot policies**, to evaluate and freeze before formal
collection; they are not advertised as Brown-approved research cutoffs.


| Stage         | Implemented rule                                                                                                                                 | Consequence                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Sound         | Play a neutral spoken word to completion and identify it                                                                                         | Retry once with volume/output guidance; otherwise stop task entry   |
| Calibration   | Eight outer positions in random order × five clicks, then center × five; click coordinates/times recorded                                                                            | Trains model; provides no independent pass score                    |
| Brown center | 5 s; four-point smoothing, clipping, last 50 points; official arithmetic; score ≥75 | Study policy; incomplete buffer or interruption fails |
| Validation    | Five look-only targets with red prediction feedback; 1 s settling + 2 s measurement each; every target ≥50% within 200 CSS px AND ≥15 finite samples/s over the full interval | Pass all points or retry; empty/missing points fail                 |
| Recalibration | At most two retries after the first attempt                                                                                                      | Third failure stops task entry; feedback and diagnostic save remain |
| Midpoint      | Repeat Brown center measurement and validation after two events; same retry policy                                                                                            | Stop subsequent events if still failing                             |
| Final         | Repeat Brown center measurement and validation without retraining                                                                                                             | Record terminal quality; no retroactive rescue of earlier samples   |
| Drift         | Last 80% of a 1 s fixation; ≥15 samples/s, median x/y bias ≤min(200 px, half candidate separation), x/y MAD ≤75 px                               | Store failure reason; no correction if rejected                     |
| Gaze coverage | Full-window rate ≥15 Hz; unobserved duration ≤25%; offscreen duration ≤30% of covered duration                                                   | Diagnostic quality flag, separate from scientific readiness         |


Counting samples over the full fixed validation duration prevents a short
burst from looking like sustained high sampling. An uncalibrated tracker may
return null even with a working webcam, so the old pre-calibration gaze-rate
screen is removed. Camera resolution/reported frame rate are recorded as
metadata; they are not substituted for measured prediction throughput.

Low sample counts trigger “close unused apps/tabs, connect power, keep your
face visible.” Poor target coverage triggers “use even frontal lighting,
reduce glasses glare, hold the same position, look until the dot disappears.”
The face-position screen is shown again before retraining. These are practical
interventions, not a diagnosis of the cause. Do not remove needed vision
correction or promise that coaching guarantees a pass.

The neutral spoken-word check (locally generated “seven,” macOS Samantha)
checks basic speech audibility through the same HTML audio path. It can be
guessed and is not a validated headphone screen or a validation of all study
recordings. Before formal use, independently test intelligibility and
linguistic naturalness of the eight recordings. Keep subjective clarity ratings.

## 5. Drift correction and time measurement

Van der Cruyssen et al. estimate bias from the trailing 80% of fixation and
translate AOI boundaries. Their left/right task used horizontal correction;
their visual-world task also used vertical correction and task-specific
exclusions. See the [paper](https://doi.org/10.3758/s13428-023-02221-2) and
[author-hosted full text](https://pure.uva.nl/ws/files/254480266/The_validation_of_online_webcam-based_eye-tracking.pdf).
Our median estimator and numerical cutoffs are adaptations, not their exact
protocol. Compare raw and corrected results; correction assumes a stable
additive offset and cannot repair scale errors or arbitrary gaze noise.

The cross sits at the midpoint between the current candidates. The raw
samples remain unchanged. For AOI classification, adding `(dx,dy)` to all
AOIs is equivalent to subtracting it from samples in a temporary calculation;
never do both. Screen-boundary checks use original coordinates. Drift is
estimated before each probe, then applied to preview/audio classifications.
It is not applied retrospectively to the preceding video. Failed fixation
checks are retained and make corrected analyses unavailable.

All phase clocks are stored. `webgazer_data.t` is relative to the extension's
on-load origin, not automatically audio onset. For audio, retain play request,
`playing`, `ended`, `waiting`, and `stalled` event timestamps and subtract the
recorded gaze origin. `playing` is a browser playback marker, **not measured
physical sound onset**. AudioContext latency estimates are environment
metadata, not a valid correction for HTMLAudioElement timing. No assumed
300 ms WebGazer lag is subtracted in this revision.

For video, record `playing`, `ended`, `waiting`, `stalled`, `error`, play
rejection, metadata duration, and playback quality counters. Playback ends
the trial; the watchdog indicates failure. Frame callbacks record `mediaTime`,
`presentedFrames`, and display-time metadata. A gaze sample's media time is
read at prediction receipt, not at webcam exposure. Browser scheduling can
delay or omit frame callbacks; callback count is not automatically dropped
frame count. See [MDN's frame callback contract](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback).

The browser cannot guarantee exactly 4000 ms of wall time on every computer.
The correct contract distinguishes four-second encoded media, startup delay,
wall playback, stalls, dropped frames, and trial overhead. A one-frame wall
deviation is a diagnostic flag to examine, not proof that the MP4 is wrong.
Hardware loopback/high-speed verification is needed for claims about physical
sound/display onset. Do not silently trim media to compensate for software
delays.

## 6. Data requirements, derived backward from the RQ


| Data level                   | Fields recorded or explicitly pending                                                                                      | Why needed                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Session/design               | UUID, version/schema, build hashes, item/probe order, condition, layout, timestamps                                        | Reproduce exposure and counterbalancing                              |
| Participant/setup            | Age, English background, major, vision, eyewear, natural light/direction, camera type, estimated distance, audio device    | Describe sample and explore quality associations                     |
| Hardware/environment         | Browser, viewport/screen, devicePixelRatio, camera settings, audio latency estimates                                       | Interpret pixel geometry and hardware variation                      |
| Calibration/validation       | Every attempt's raw data, targets, ROI percentage, count/rate, offsets/MAD, thresholds, verdict, checkpoint                | Distinguish training from no-click, feedback-visible quality assessment             |
| Gaze sample                  | Raw x/y/t, receipt timestamp, Δx/Δy/Δt, speed, normalized/signed coordinates, raw/corrected label, media time at receipt   | Recompute spatial/time summaries without overwriting raw data        |
| Phase/trial                  | Logical ID, item/condition/probe, DOM geometry, drift target/bias/dispersion, interruptions, timing events, sample quality | Link samples to the correct stimulus and detect failures             |
| Derived outcomes             | Centroid/SD, time-weighted centroid, dwell duration/fraction, distal preference, eligible first shift, 100 ms bins         | Address allocation and movement questions                            |
| Response/experience          | Choice/RT, phone use, moving away, distractions, instruction clarity, naturalness, audio difficulty, suggestions           | Behavioral outcome and diagnostic feedback                           |
| Integrity/save               | Start/finish/branch ledger, missing/duplicate IDs, completion, stop reason, local-storage outcome                          | Separate skipped timelines, incomplete sessions, and missing records |
| Required before formal study | Verified word annotations, dynamic video AOIs, validated final AOIs, perceptual/linguistic norms                           | Avoid unsupported language-locked or object-specific conclusions     |


This is a hierarchy of entities rather than a flat list of overlapping
“factors.” Store the source once and join by UUID/logical trial ID. Use CSS px
for both DOM geometry and gaze; devicePixelRatio does not convert pixels to
centimeters or degrees of visual angle. Physical calibration needs screen
size and viewing distance measurements.

Each sample represents a noisy estimate, not a labeled fixation. Δx/Δy and
speed are descriptive and must not be interpreted as validated saccades.
The extension requests predictions every 34 ms; a table with one observation
at every 25 ms would imply measurements that were not made. Preserve actual
irregular timestamps and any missingness. Displaying 100 ms summaries does
not improve the underlying temporal resolution.
Dwell uses a forward hold capped at 100 ms; longer gaps remain missing, and
the final unbounded sample gets no invented duration. These are occupancy
estimates, not exact gaze duration. Missing, offscreen, offstage, other, and
unannotated time stay distinguishable. Video samples are unannotated because
final-frame boundaries cannot follow moving agents.

The Geller et al. [tutorial](https://jgeller112.github.io/L2_VWP_Webcam/) is the
best first reading for the data pipeline and environment questionnaire. Our
questionnaire adapts relevant items and adds audio output and study feedback;
it is not presented as a verbatim validated scale. Their study used Gorilla,
so platform-specific columns and thresholds do not transfer automatically.
Self-reported conditions can reveal associations with failure, not pinpoint
causal factors without experimental manipulation.

All subjective ratings use 1–7 with explicit endpoints. Audio difficulty is
negatively framed as requested; higher scores mean worse audibility. Reverse
wording alone is **not an attention check**. Do not exclude participants just
because clarity/difficulty ratings disagree; actual audibility problems are
possible. Add a separate, unambiguous instructed-response item only if needed.

## 7. Selected analysis strategy

**Pilot:** report recruitment/attempt/attrition counts, per-point validation,
drift failure, coverage, playback diagnostics, and participant-level means/SDs.
Show condition differences with uncertainty as exploratory. Current unverified
AOIs and missing word boundaries prevent confirmatory language-effect tests.
The export deliberately withholds word-locked summaries instead of using the
old placeholder timestamps.

**Planned primary outcome after materials are validated:** distal-versus-
proximal allocation in a prespecified post-causative-word window. Proposed
window: 200–2200 ms after independently annotated “broke”/“caused” onset, subject
to timing validation and pilot justification. This is a proposed analysis
window, not a universal effect-latency rule. Different lexical/event-word
onsets in the periphrastic question require separate annotations and a
prespecified secondary alignment.

Use one observation per participant × item × assigned condition. Reduce to
100 ms bins under a fixed coverage rule; classify a bin by its majority
covered referent occupancy and leave tied/insufficient bins unassigned.
Let D and P be numbers of distal/proximal bins. Proposed primary model:

`empirical_logit = log((D + 0.5) / (P + 0.5))`

`empirical_logit ~ condition + layout + trial_order + (1 + condition | participant) + (1 + condition | item)`

This is a window-level linear mixed model on empirical logits. It is a
practical starting model, to validate by residual checks and simulation, not
an implemented confirmatory analysis. Prespecify minimum referent coverage,
handling of boundary-heavy trials, random-effects simplification, and
participant/item resampling for uncertainty. Do not put every 34 ms sample
into an ordinary binomial model as an independent Bernoulli trial: repeated
samples from one look create pseudoreplication. Binning alone does not remove
temporal dependence. Barr's [multilevel visual-world analysis](https://doi.org/10.1016/j.jml.2007.09.002)
is useful background; this specific window model is our proposed adaptation.

With only four items, treat item as a fixed factor for exploratory estimates
and limit inference to these scenes; a complex item random-effects structure
will be poorly estimated. Four levels do not make all random effects
mathematically unidentifiable. A repeated two-probe pilot additionally needs
probe position/first condition and a first-probe-only sensitivity analysis.

**Secondary:** use a mixed model for trial-level signed horizontal centroid
and a logistic mixed model for distal behavioral choice. Normalize/mirror x
before combining layouts. Report dwell-based preference alongside centroid:
a central mean can arise from alternating extreme looks and does not mean
someone looked at the center. Report uncorrected and accepted drift-corrected
results separately. Do not select whichever gives the predicted effect.

**Exploratory time course:** plot participant-aggregated 100 ms bins with
coverage and uncertainty. If testing across time, use a prespecified
participant-respecting permutation/cluster procedure. A significant cluster
does not identify the exact onset of an effect. Do not perform a separate
uncorrected ANOVA at each timestamp. A model for mean x/y alone does not test
the same question as relative AOI allocation.

Video gaze can describe whether a causal action was sampled once dynamic
AOIs exist. It cannot prove comprehension or “rule out” all visual confounds.
Adding this baseline as a covariate needs a prespecified estimand; avoid
opportunistic adjustment. Choose sample/item counts by simulation using pilot
variance and exclusion rates, not by whether N=20 produces p<.05.

## 8. Source/code map and completion rules


| File                                       | Responsibilities                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `src/config.js`                            | All thresholds, timing, quality policy, explicit readiness=false        |
| `src/stimuli.js`                           | Four items, eight phrases, approximate geometry and material provenance |
| `src/quality.js`                           | Validation, coaching, drift, and logical integrity checks               |
| `src/experiment.js`                        | Participant flow, gating, geometry capture, gaze callbacks, surveys     |
| `src/media.js`                             | Playback event and frame logging; ended/error/watchdog handling         |
| `src/analysis.js`                          | Labels, deltas, coverage, occupancy, centroid, first shifts, bins       |
| `src/storage.js`                           | IndexedDB journal, payload, completion audit, explicit download         |
| `analysis/export.mjs`                      | Non-destructive JSON/recovery → nine CSV tables; see README                |
| `scripts/build-manifest.mjs` / `check.mjs` | SHA-256 provenance and MP4 contract checks                              |
| `preview.html` / `recovery.html`           | Researcher media inspection / interrupted-session recovery              |


The prior missing `trial_index=14` was attributed in the existing audit to a
skipped conditional branch. A numerical gap alone is not evidence of loss.
This revision audits explicit expected task IDs, duplicates, starts without
finishes, and branch decisions. Final export is built after the debrief row,
so that row is not silently omitted. An aborted session saves its actual
path, stop reason, and diagnostics; completion and scientific eligibility
remain separate from file existence.

No browser-only solution guarantees that all data survive a power failure,
storage denial, or closing a tab during an unfinished trial. The journal
protects completed rows, the ledger reveals interrupted work, and downloads
can be retried. Browser download requests cannot verify receipt on disk.
For remote recruitment, add a consented, authenticated backend with durable
acknowledgments and idempotent IDs; do not imply one exists now.

## 9. Reading order and formal-study exit criteria

Read Geller's linked tutorial first, then [Slim & Hartsuiker (2023)](https://doi.org/10.3758/s13428-022-01989-z)
for webcam visual-world feasibility and sampling concerns, Van der Cruyssen
for fixation-based correction, and the jsPsych source/plugin references for
implementation. Between-platform latency findings are not a calibration
constant for this computer.

The current design is fixed by the user's instructions: four geometric silent
videos, split retained, and both isolated phrase conditions per scenario.
Do not replace these with human-character videos, full spoken sentences, or
one-condition-per-item lists. Before confirmatory interpretation, independently
check the eight recordings and word onsets, validate causal-role AOIs and the
actual camera/audio hardware, and specify the analysis window, model, sample
size and exclusion policy. Report repeated-item carryover and limited item
generalization as limitations of this design. The implementation intentionally does not certify those scientific
requirements from software tests alone.
Calibration update (2026-10-03): the requested center-score gate is now inclusive
≥75, with the five-point thresholds unchanged. Training accepts only explicit
target clicks after settling, checks fresh eye-feature timestamps and actual
regression insertions, and excludes cursor movement. Center measurement keeps
the background WebGazer loop paused so the extension alone requests predictions.
See the calibration audit for evidence and limits; no retrospective rescaling
of previously recorded center scores is performed.

Latency update (v2.3): red visual feedback no longer applies the extra
four-frame display average; Brown scoring still does. Model Kalman filtering
remains enabled. Inference is serialized across background and explicit
requests, background generations are canceled at pause/resume, and unchanged
ridge fits are cached with invalidation on training updates. Exported inference
duration describes software computation only, not end-to-end gaze latency.
The calibration stage's visible prediction is still a model being trained;
held-out validation is required to judge post-calibration spatial error.


Current flow update (v2.4): the center gate is inclusive ≥75. Validation displays
red predictions from its existing polling stream; each validation row records
`gaze_feedback_visible=true` and `validation_context=visible-prediction-feedback`.
This is not a feedback-free validation. Brown center measurement still hides
prediction feedback. Each of four 4-second scenarios includes both counterbalanced
phrases, each followed by its corresponding written question and response.
The pre-phrase fixation marker is X. Background sampling now spans each whole
scenario, including responses and phase transitions; absolute-time raw records
are in `continuous_gaze`, with bounds in `continuous_segments`. The per-phase
records and continuous stream overlap and must not be counted twice.
Question screens have no object AOI assignment. Final feedback includes age,
English background, major, suggestions and four 1–7 ratings (lighting,
calibration clarity, video naturalness, negatively framed audio difficulty).
Setup lighting is separately named `lighting_setup`.

`?allocation=1&mode=preview` is a camera-free walkthrough using the same four
videos, eight phrases, questions and final form. Preview files explicitly have
`mode=preview`, `gaze_enabled=false`, `complete=false`; `flow_complete` reports
walkthrough completion. Export preserves the mode and example analyses exclude
preview responses. This does not bypass the gate in participant study mode.
