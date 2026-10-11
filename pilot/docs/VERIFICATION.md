# Current verification — v2.4.1

The user confirmed the existing four geometric silent videos and separate
`cause to X` / `X` recordings. The earlier inference that human-character
videos should replace them is withdrawn; see [CHECKLIST](CHECKLIST.md).

35 Node tests pass. Added cases cover camera rejection and late initialization
after cancellation, missing choice gaze, answer/audio mismatch, missing or
invalid continuous streams, malformed viewport export, preservation of wrong
source session IDs, duplicate export rejection, invalid-sample missing time,
and first-shift eligibility across tracking loss.

Browser audit modes: `brown75`, `preview`, `validation-error`, `sound-error`,
`audio-fail`, `preload-fail`, `interrupt`, `camera-error`. They verify the complete
four-video/eight-probe flow and recovery, no-prediction preview, failure reasons,
unseen-stage ratings saved as null, and partial recovery. Browser gaze is
synthetic, except preview which makes no prediction requests; camera permission
rejection is injected into the real initialization plugin. This is not a live
human-camera accuracy test. Calibration/training/validation durations are
shortened in test routing; video and audio assets play from actual local files.

Reproduce individual browser modes (Playwright installed in the local runtime):

```sh
PLAYWRIGHT_MODULE='/Users/healthyli/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs' node test/browser-flow.mjs brown75
```

The current export passed Python and R checks: synthetic sessions yield zero
included responses by default, and eight responses with `--include-synthetic`;
preview remains excluded. Export-level integrity is recomputed, alongside
saved integrity metadata. The original JSON is unchanged. Missing word-onset
annotations still produce unavailable word windows.

Current-version browser result summaries are stored in `qa-results.json`.
Media checks verify all four videos have no audio stream, match declared
per-item duration/frame rate/count, decode with their tableaux, and have all
eight separate, decodable audio files. Spoken-text declarations are checked
against the required forms; audio semantics are not independently transcribed.

The versioned observations below are historical.

# Current verification — v2.4, October 3, 2026

- 27 Node tests pass, including the inclusive 75 threshold (74 and 56 fail),
  single-sampler continuity across phases, late-sample isolation, validation
  feedback coordinates/staleness/cleanup, and preview-data separation.
- Synthetic Chrome session with center score exactly 75 passed all three
  checkpoints and completed four videos, eight audio probes and eight choices.
  All eight choices have gaze samples; four closed continuous-recording segments
  have ordered timestamps. Validation red feedback appeared and was removed
  afterward. Saved and recovered JSON both contain 62 rows, with both integrity
  audits passing and no JavaScript errors.
- Camera-free full walkthrough completed four videos and eight audio/question
  pairs plus the requested final questionnaire, saved and recovered 45 rows,
  made zero gaze-prediction calls, and recorded `complete=false`,
  `flow_complete=true`, `mode=preview`, `gaze_enabled=false`.
- Synthetic 75-point JSON exported nine CSV tables; Python and R descriptive QA
  loaded them and joined all eight responses; both excluded preview responses. Continuous and phase sample
  tables overlap by design and must not be pooled as independent observations.
- A synthetic 56-point session failed all three center attempts, skipped all
  four videos, and saved/recovered 29 diagnostic rows without JavaScript errors.
- Validation now has visible feedback. These tests establish software behavior;
  they do not establish human accuracy, latency or research readiness.

The versioned observations below are historical.

> v2.3 update (2026-10-03): 24 Node tests cover fit-cache invalidation, prediction
> equivalence, pause/resume generations and serialized inference/recovery after
> rejection. `test/browser-ridge.mjs` runs the real vendored solver on synthetic
> eye images without a camera: cached/uncached coordinates matched exactly;
> 12 predictions took 11.1/19.6 ms respectively in the recorded run. These are
> solver timings, not measured human gaze accuracy or end-to-end latency.

> Calibration update 2026-10-03: version 2.2 adds 3 regression tests (21 total),
> an inclusive ≥80 gate, accepted-training checks and single-owner measurement.
> See [the calibration audit](CALIBRATION-AUDIT-2026-10-03.md). Historical v2.1
> test observations below are retained as such.

# Verification record — October 2, 2026

## Completed checks

- Eighteen Node regression tests: all pass. They cover threshold boundaries,
  missing/sparse validation, drift direction and rejection, mirrored geometry,
  first-shift eligibility, missing-time accounting, missing word onset,
  logical integrity, ended playback, autoplay rejection, and watchdog failure.
- ffprobe: all four selected clips are 4.000000 s, 96 frames, 24/1 fps.
- All nine audio assets (eight experimental phrases and the neutral spoken
  check) have a positive decoded duration and pass an ffmpeg decoding check.
- Camera-free Chrome playback: all four ended normally; wall playback was
  4002.0, 4001.5, 4001.6, and 4009.6 ms in the latest run, with zero reported
  dropped frames. All clips produced 96 frame callbacks in this run; callback count and dropped-frame count remain distinct measurements.
- Synthetic tracker, successful complete flow: 62 rows; four video trials;
  eight audio/gaze probes; initial, midpoint, and final validation passed;
  logical integrity passed; local JSON download and IndexedDB recovery worked.
- Synthetic tracker, failed initial calibration: exactly three failed
  validations; no videos or critical probes entered; all 29 diagnostic/feedback
  rows saved; completion=false; actual-path integrity passed; recovery worked.
- JSON → CSV exporter: successful synthetic session produced eight CSV tables, including responses, participant setup, validation,
  events, and partial recovery samples without changing the raw source file.
- Brown scoring: 100 deterministic fixtures compared directly with the installed
  official `www/js/precision_calculation.js`; exact integer scores agree.
  Simulated successful sessions yield 100 at all three center measurements.
- Williams square: each of four items occupies every position once; all 12
  directed adjacent item pairs occur once across the four lists. The 16-cell
  layout/first-probe crossing is tested for per-item balance.
- Final successful flow checks calibration click counts, structural record
  integrity, eight unique probe IDs, and an actual recovered JSON download
  with the same session ID and 62 rows.
- Deliberate experimental audio play rejection: task stops before any choice,
  22 diagnostic/feedback rows saved, completion=false, no uncaught error.
- Navigation during the first audio gaze trial: recovery retained 19 completed
  rows plus 8 partial samples for the unfinished trial; no fake completed row.
  This tests navigation recovery, not power loss or a browser process crash.
- Python 3 and Rscript both read the exported tables and correctly reproduce
  the eight condition-linked choices. Missing verified word windows remain
  unavailable. Raw and recovered session duplicate IDs are rejected.
- Late prediction promises are discarded across sampling generations; promise
  failures are retained as diagnostics. Validation now rejects duplicate or
  malformed timestamps and callbacks outside its fixed measurement window.
- Browser initialization: no uncaught JavaScript errors in the tested flows.
- Deliberately invalid audio preload: no uncaught error after the documented
  vendor error-handler patch; task entry blocked; six diagnostic rows saved;
  completion=false, stop_reason=preload-failed; integrity and recovery passed.

The browser tests use an isolated temporary Chrome profile. Full-flow tests
replace camera/browser checks and WebGazer predictions in browser request
routing, and shorten calibration, validation, fixation, and preview durations; the center measurement remains 5 s and audio observation remains 3 s. These substitutions exist
only in the tests; they do not estimate real webcam accuracy, latency, face
detection, or participant behavior. No real participant data were generated.
The media preview tests use real source videos and native browser playback.

## Reproduce

Run `npm run build && npm run verify` in `study/`. `ffprobe` must be installed.
For browser checks, start a localhost server on port 8765, and use an installed
Playwright package (tested with 1.62.1) and Chrome:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
# In another terminal, with Playwright available:
node test/browser-smoke.mjs
node test/browser-flow.mjs pass
node test/browser-flow.mjs fail
node test/browser-flow.mjs preload-fail
node test/browser-flow.mjs audio-fail
node test/browser-flow.mjs interrupt
```

If Playwright is installed outside this project, set `PLAYWRIGHT_MODULE` to its
absolute `index.mjs` path. Browser outputs go to `/tmp/causal-gaze-*` and are
test artifacts, not research sessions. Tests use default localhost port 8765.

## Not established by these checks

Real camera permission/face detection and sustained human gaze tracking need
an observed pilot. Validate lighting, eyewear, movement, calibration failure
recovery, and browser model loading on the actual deployment machines. Confirm
neutral speech and all eight experimental recordings by listening with the
intended audio devices. No hardware acoustic/display latency measurement was
performed. No remote backend is configured or tested. Source hashes establish
local provenance, not availability/versioning of remotely fetched model weights.

The experiment remains explicitly non-confirmatory because the materials,
AOI geometry, timing annotations, and repeated-item design need revision.
