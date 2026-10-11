# Material decision corrected after user clarification

**Current conclusion:** retain the four existing minimalist geometric **silent**
videos (bend, break, crack, split) and the separate **`cause to X` / `X`** audio
files. The user explicitly confirmed these requirements after the file audit.
Do not replace them with human-character videos or complete spoken sentences.
The historical `../PILOT-V2-SPEC.md` material inventory also identifies the human-character files as superseded drafts. That existing evidence should have been checked before the prior warning.

The previous inference that the workspace `materials` videos must replace the
running study's geometric files was wrong and is withdrawn.

File counts, hashes, durations and the existence of embedded audio tracks in the
other folder remain factual inventory observations. They do not establish which
stimuli the user intended. The running four video files each have a video-only
stream and are also muted by the player. The eight phrase files are separate
MP3s with the requested declared wording. Independent listening/transcription
and word-onset annotation remain unverified; these are distinct from format.

## Earlier inventory, retained with its superseded interpretation labeled

## Files found in materials

Recursively inspected `materials/cause and burn_5 pairs_pilot`, including hidden
files. Found six MP4 files and three PNG images; no standalone audio files.
All six MP4 files contain both a video stream and a stereo AAC audio stream.
The audio streams have nonzero signal. This does not identify their spoken
content or establish that they contain the separate thick/thin phrases.

| Source path under that folder | Video stream length | Container length | Audio stream | Observation from sampled video frames |
|---|---:|---:|---|---|
| `break/output (3).mp4` | 5.041667 s | 5.056 s | AAC, 32 kHz, stereo | Cyclist, pedestrian, fence |
| `break/output (4).mp4` | 5.041667 s | 5.056 s | AAC, 32 kHz, stereo | Byte-identical duplicate of output (3) |
| `bent/output (2).mp4` | 7.041667 s | 7.072 s | AAC, 32 kHz, stereo | Blue and red cars, road sign |
| `crack/output (4).mp4` | 7.041667 s | 7.072 s | AAC, 32 kHz, stereo | Two men and a framed painting |
| `split/output.mp4` | 5.041667 s | 5.056 s | AAC, 32 kHz, stereo | Girl with a horn and boy holding a drink |
| `split/output (1).mp4` | 8.041667 s | 8.064 s | AAC, 32 kHz, stereo | Different framing/action version of the drink scene |

There are five unique MP4 files across four scenario folders. Both drink-scene
versions need to remain distinguishable; a numeric filename suffix alone is
not evidence of the intended final version. All source videos report 24 fps.
The crack source is H.264 at 1280×720; the others are HEVC at 1920×1080.

## What the experiment currently loads

`src/stimuli.js` selects `assets/event/items/path-break.mp4`, `car-bend.mp4`,
`painting-crack.mp4` and `juice-split-v050.mp4`, all 4.000-second H.264 files.
These are the geometric-character versions from the archived pilot, not the
original source videos above.

Its eight `assets/audio/verb-{thick,thin}-{break,bend,crack,split}.mp3` files are
also copied from the archived pilot. Their declared provenance is
`existing-macos-say-Samantha` (the older source called them placeholders); declared texts are the isolated verb
and “cause to [verb]”. File identity and decodability have been verified, not
independent word-by-word listening accuracy or correspondence to the user's
intended recordings. `speech-check.wav` is a separate neutral setup check.

The current answers (green triangle/red cube, blue/orange car,
yellow triangle/purple cube, teal capsule/brown cube) and tableau geometry
belong to those geometric versions. Simply switching video paths would leave
the questions' answer labels, still images, duration contracts and gaze
geometry inconsistent with the source material.

## Previously unresolved choices — now superseded by the user

- Resolved format: keep the existing separate `cause to X` and `X` phrase assets; do not use embedded soundtrack audio as a phrase prompt.
- Resolved stimulus family: retain the geometric split clip. Neither human-character drink-video variant is selected.

No source files or active stimuli were replaced during this audit. Original
soundtracks must not automatically play during the intended silent-video
phase or be substituted for post-video language prompts. A coordinated material
update must handle browser codec compatibility, actual durations, corresponding
still images, actor labels, audio wording, and newly checked geometry together.

The machine-readable [inventory](materials-audit.json) records paths, SHA-256,
stream metadata, decode checks and matching archived assets. Audio semantics
remain unverified; structural checks are not a transcript.
