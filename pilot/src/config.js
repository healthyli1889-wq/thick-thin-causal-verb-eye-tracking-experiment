export const CONFIG = Object.freeze({
  version: 'pilot-2.6.3', schema: '3.5.0',
  // A technical pilot. Stimulus geometry and spoken constructions still need revision.
  confirmatoryReady: false,
  calibration: {
    points: [[15,15],[50,15],[85,15],[15,50],[50,50],[85,50],[15,85],[50,85],[85,85]],
    repetitions: 5,
    validationPoints: [[25,35],[75,35],[50,50],[25,65],[75,65]],
    radiusPx: 200, minimumPercent: 50, minimumHz: 15,
    settleMs: 1000, durationMs: 2000,
    // The accuracy numbers are recorded, never enforced. Nothing below stops a session; these
    // are the comparison levels written into each saved row so that exclusion can be decided at
    // analysis time from the measurements themselves.
    qualityGateEnforced: false, recalibrationAttemptsOffered: 0,
    brownMeasurementMs: 5000, brownMinimumScore: 75,
    trainingSettleMs: 750, trainingClickIntervalMs: 300, trainingMaximumFeatureAgeMs: 500,
  },
  timing: { fixationMs: 1000, previewMs: 800, gazeMs: 3000, videoTimeoutMs: 20000 },
  drift: { discardFraction: 0.2, minimumHz: 15, maximumBiasPx: 200, maximumMadPx: 75 },
  analysis: {
    // Proposed pilot window; not a measured tracker-lag correction.
    wordWindowStartMs: 200, wordWindowEndMs: 2200,
    binMs: 100, maximumSampleHoldMs: 100, minimumHz: 15,
    maximumMissingFraction: 0.25, maximumOffscreenFraction: 0.30,
    trackerLagMs: null,
  },
  screen: { minimumWidth: 1280, minimumHeight: 720 },
  // No network data upload. An explicit local JSON download plus local recovery.
  dataDestination: 'local-download',
});
