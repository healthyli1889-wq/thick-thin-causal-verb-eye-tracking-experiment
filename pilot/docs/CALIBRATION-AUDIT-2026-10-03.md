> **v2.6 removes the gate entirely. Everything below about thresholds, pass/fail and
> recalibration retries is historical.** Calibration and validation now run once per checkpoint,
> every number is recorded, and no score stops a session. `brownMinimumScore: 75` and the
> validation criteria survive only as reference levels written into each payload under
> `quality.tracking_quality.reference_levels`. `CONFIG.calibration.qualityGateEnforced` is
> `false` and `recalibrationAttemptsOffered` is `0`.
>
> The reason is stated plainly: the ≥75 level demands a mean error within about 12.7% of the
> viewport height (roughly 114 px at a 900 px viewport), and nothing in this repository ever
> established that WebGazer can reach it on the operator's hardware. Blocking collection on an
> unvalidated level produced no data at all, which is worse than collecting data labelled with
> its measured accuracy. Exclusion is now an analysis-stage decision taken from the recorded
> numbers.
>
> The honesty cost is explicit and handled: a session can now reach the end with poor tracking,
> so `complete: true` no longer carries any quality claim. `tracking_quality_gate:
> 'recorded-not-enforced'` sits at the top level of every payload, `quality.tracking_quality`
> carries `reference_levels_met`, `lowest_brown_score`, `lowest_validation_hz` and the
> per-checkpoint scores, and the first entry in `quality.blockers` states that accuracy was
> recorded but not screened. `reference_levels_met` fails closed when nothing was measured.
> Regression tests: `test/export.test.mjs`.

> v2.4 superseded the gate below: score ≥75, inclusive; validation now displays prediction feedback. Earlier 80-point test results below are historical. Current settings and limitations: [README](../README.md).

> v2.5 corrects the training schedule for the eight peripheral targets. Up to v2.4 the
> study flattened all nine targets into five *consecutive* clicks each, so the 45 accepted
> samples were nine clusters of near-duplicate feature vectors, each cluster recorded
> within about 1.2 s from one head pose and one fixation. Those are now revisited once per
> round, reshuffled each round.
>
> The centre is deliberately still trained last, five times in a row. Brown's own
> `www/js/calibration.js` reveals Pt5 only after `PointCalibrate == 8` and then calls
> `calcAccuracy()` on the centre immediately, so the centre is the freshest training point
> at the moment it is scored. `brownCheck` replicates that measurement and therefore has to
> replicate its training order; a first v2.5 attempt scattered the centre through the
> rounds, which changes what the ≥75 gate is comparing against. The consequence is that the
> centre score is **biased in the centre's favour and is not an unbiased accuracy estimate**.
> The independent five-point validation is the number that predicts task data quality.
>
> The accepted-sample count is unchanged at 45 and the scoring formula is untouched, so
> v2.4 and v2.5 scores are not comparable as measurements of the same procedure.
> Real-device retesting is required before claiming any improvement.
>
> `ridgeParameter` was checked and left alone. Running the shipped solver
> (`vendor/worker_scripts/mat.js`, the `ridgeWorker.mjs` path) at the study's actual
> 45 × 120 dimensions gives a coefficient norm of order 10 and never triggers the
> `catch`/`k *= 10` escalation, so the fit is not the ill-conditioned blow-up that the
> 45-samples-versus-120-features ratio suggests on paper.
>
> Two things deliberately left alone, because both would raise the reported score
> without improving gaze estimation. Global mousemove training stays disabled: the
> upstream `RidgeReg.predict` concatenates the last second of cursor positions onto the
> click training set at predict time, so a participant who looks at their own cursor is
> fed the answer. And the displayed red estimate stays unsmoothed, because validation,
> the Brown check and the task trials all score the same unsmoothed `getCurrentPrediction`
> stream; smoothing only the visible dot would make the feedback look better than the
> data being scored.

# Calibration audit — 2026-10-03

The running version is now `pilot-2.2.0`, schema `3.2.0`. The user's requested
threshold is **Brown center score ≥80**, inclusive. Independent validation
remains every point ≥50% within 200 CSS px and ≥15 Hz. The scoring formula has
not been rescaled or changed. Older session results are preserved.

## What is established

| Finding | Source evidence | Repair |
|---|---|---|
| Two inference paths were active during center measurement and afterward | `brownCheck` called `ext().resume()` and then `startSampleInterval()`. In the vendored engine, `resume` runs the animation loop, which calls `getPrediction`; the extension separately calls `getCurrentPrediction` → `getPrediction`. The earlier serial-request patch only serialized the extension's own requests. | Center measurement leaves the background loop paused. This fork explicitly paints a fresh camera frame when `getCurrentPrediction` runs while paused. Calibration's continuous loop remains active during training and is paused at its end. Validation and task sampling consequently have one owner. |
| Calibration trained on mouse movement as well as target clicks | The plugin called `startMouseCalibration` → `addMouseEventListeners`, which registers both click and mousemove. Ridge prediction includes recent movement training data. Cursor movement is not an explicit instruction to fixate that cursor. | Disable global listeners; explicitly call `calibratePoint` only after a valid target click. |
| Click count did not establish successful training | The old wrapper counted DOM clicks. `recordScreenPosition` can return without insertion when paused or lacking eye features; the plugin advanced regardless. | Read non-image diagnostic metadata and verify the regression sample count increases by one before advancing. All 45 accepted samples are recorded. |
| Rapid clicks could reuse stale eye features or occur before gaze settled | There was no click pacing or feature timestamp check. Multiple target clicks could be logged without fresh corresponding eye features. | New target settles for 750 ms; ≥300 ms between accepted clicks; require a distinct feature timestamp from after settling and age ≤500 ms. Rejected attempts are logged with reasons. These timing values are explicit study engineering policies, not validated universal research thresholds. |
| Nominal calibration coordinates denoted the corner of a dot inside a layout container | `left:x%; top:y%` lacked centering; a 20 px dot's center was roughly 10 px away (plus its border). | Fixed viewport container and `translate(-50%,-50%)` put the center at the requested coordinate. Training records the actual DOM center. This small offset alone does not explain a score of 56. |
| Failure feedback had a hard-coded 90 | The gate configuration and failure text were separate constants. | Gate and feedback use `CONFIG.calibration.brownMinimumScore`; the new comparator is inclusive. |

Prediction mathematics and the Brown formula are unchanged. The engine patch
only exposes frame time/age, feature availability, pause state and model counts;
it does not export eye images or eye-feature arrays. The active study continues
to use the compatible fork required by the
[official jsPsych documentation](https://www.jspsych.org/v8/overview/eye-tracking/).
The [calibration plugin documentation](https://www.jspsych.org/v8/plugins/webgazer-calibrate/)
describes its stock parameters; the additional accepted-click checks are local
patches documented in `vendor/PROVENANCE.md`.

## What 56 means, and what it does not establish

The downloaded Brown implementation computes:

`round(mean(max(0, 100 − 100 × distance_to_center / (viewport_height / 2))))`.

A score rounded to 56 corresponds to a mean **capped** distance of approximately
0.22 × viewport height (range approximately 0.2175–0.2225 × height, owing to
rounding). At a 1000 CSS px viewport height this is about 220 px. Points farther
than height/2 have their distance contribution capped, so this is not necessarily
the uncapped mean error. It is not the percentage of samples inside an AOI.

At the same illustrative height, score 80 corresponds approximately to 100 px
capped mean error and score 90 to 50 px. These examples do not establish the
user's actual viewport size or error distribution.

No matching raw session for the user's reported 56 was available in the checked
Downloads files. The computer-use tool could not read the current browser
because it timed out. Thus the identified code defects are **plausible
contributors**, not a confirmed decomposition of this specific score. Head
motion, camera positioning, lighting, eyewear reflections and model limitations
remain possible contributors, but none has been diagnosed from this report.

## Evidence needed to finish the session-specific diagnosis

Open `/recovery.html` in the **same browser and origin** as the original study
(`localhost` and `127.0.0.1` have different browser storage). Each saved session
now has a Calibration diagnostics disclosure and its original JSON download.
Or run:

```sh
node analysis/calibration-report.mjs /path/to/session-or-recovery.json
```

The report recomputes the saved 50-point score and compares it with the recorded
score. It reports mean x/y offset, mean distance, RMS dispersion, raw versus
smoothed score, sample counts/span, interruptions, per-target validation, and
accepted/rejected training counts. Older files lacking insertion metadata show
null; successful historical training is not inferred from DOM clicks alone.
A persistent offset and high dispersion suggest different failure patterns;
neither identifies a physical cause without observation. Changing the threshold
does not correct either kind of error.

## Verification

- Node tests compare the Brown arithmetic with the installed official function
  on 100 deterministic fixtures, plus an exact 56 fixture (220 px horizontal
  offset at 1000 px viewport height).
- Regression tests require 45 accepted target-only insertions and cover premature
  clicks, missing face features, stale/reused frames and insertion failures.
- Boundary tests cover 79, 80, 100, missing scores and interrupted measurements.
- Browser QA uses synthetic gaze and shortened training delays; it does not
  measure human tracking accuracy. Its fake engine throws if the extension
  requests predictions while the background loop is active.
- A 56-score synthetic flow passes the five independent validation targets but
  fails the center gate on all three attempts, saves diagnostics and never enters
  the videos. This verifies that 56 is not silently promoted to a pass.
- An 80-score synthetic flow passed all three checkpoints, completed four
  videos and eight probes, and saved/recovered 62 rows without JavaScript errors.
- All 21 Node tests, decoded asset checks and the regenerated manifest check
  pass. These are software checks, not measurements of a human participant.

The program changes require a page reload and a new calibration. They cannot
repair samples already collected. Real-device retesting is still required before
claiming a score or precision improvement.
