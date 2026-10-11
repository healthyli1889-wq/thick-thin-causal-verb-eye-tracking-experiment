# Vendored runtime

Copied from the existing repository distribution at
`jsPsych/jsPsych resources/jspsych/`: jsPsych 8.3.0, extension-webgazer 1.2.0,
and the installed versioned plugins. The WebGazer runtime comes from that
distribution's `examples/js/webgazer/`, as required by the jsPsych guide. It is
not the newly downloaded Brown v3.5.3 bundle. Worker support files are copied
alongside it. The build manifest hashes every local file.

Local patch: `plugin-preload.js` guards `e.error?.statusText` and
`e.error?.loaded`. The upstream 2.1.0 error formatter dereferences `e.error`
when it can be undefined after a Web Audio decoding failure, producing an
uncaught TypeError while handling an invalid audio file. The patch preserves
the failed-preload result and allows the study's failure/save path to run.

jsPsych is MIT licensed (`jspsych-license.txt`). WebGazer carries its copyright
and GPL notice in the distributed JavaScript; the GPLv3 text is included.
Upstream: https://github.com/jspsych/jspsych and
https://github.com/brownhci/WebGazer. TensorFlow/model loading behavior belongs
to the supplied fork; local source hashing does not pin remote model weights.

Local safety patch (v2.1): `extension-webgazer.js` serializes prediction requests,
invalidates pending responses when sampling stops, and records rejected promises
in `sampleDiagnostics`. This prevents late results from entering a subsequent
trial and makes inference errors inspectable. Prediction/model math is unchanged.
Regression test: `test/audit.test.mjs` (late-result and rejected-promise cases).

Local validation timing patch (v2.1): `plugin-webgazer-validate.js` accepts a
prediction only when both its request timestamp and callback are inside the
settled measurement interval. It records target pixel centers and intended/
actual interval endpoints in `point_timing`, excluding late callbacks after
the measurement deadline.

Local calibration patch (v2.2, 2026-10-03): `webgazer.js` exposes only
feature-frame timestamp/age, face-feature availability, paused state, and
regression sample counts through `getCalibrationStatus`. No image or eye-feature
arrays are exported; prediction math is unchanged. `plugin-webgazer-calibrate.js`
uses target-only training, a 750 ms settle interval, ≥300 ms click spacing, fresh
non-reused feature frames (≤500 ms old), and verifies each model sample insertion.
It no longer enables document-wide click/mousemove training. Calibration targets
are centered at their percentage coordinates in a fixed viewport container.

Local latency patch (v2.3, 2026-10-03): background loop generations invalidate
late callbacks across pause/resume; a shared inference lock prevents concurrent
face-model execution. Ridge coefficients are cached only for unchanged click
training with no active mouse trail, and invalidated on each training update
and reset; solver inputs, regularization and Kalman filtering are unchanged.
Visible red feedback uses the latest model estimate, without the additional
four-frame moving average or offscreen clamping. Brown stored-point smoothing
and study scoring remain unchanged. Predictions expose software inference
duration; this is not an end-to-end optical/physiological latency measurement.

Local recovery patch (v2.4.1): `plugin-webgazer-init-camera.js` finishes a
diagnostic trial on camera-start rejection and provides a cancel/save exit
while loading or positioning. It resolves completion once, disconnects the
face observer, removes temporary camera styles, and ignores a late start after
cancellation. The study guards later calibration steps after camera failure.
Tests: `test/camera-recovery.test.mjs` and browser `camera-error` mode.
