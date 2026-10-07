# PF-3 audio instrumentation measurement

Date: 2026-10-06 MDT (capture ended 2026-10-07T05:17:42.652Z)
Task: t_8ac886a8
Branch: `pf3/audio-instrument-20261006`
Implementation commit: `0b2872dfe29bda3b158f97b8d5576be73988430f`
Route: `http://127.0.0.1:4317/pitch-defender/pitchforks-3?pfdebug=1`

## Result

The opt-in `window.__pitchforksAudioDebug` buffer ran for 60.0175 seconds in visible desktop Brave/Chromium 154 on Windows. The browser reported four logical processors. The source was a WebAudio sine oscillator swept exponentially from 220 Hz to 440 Hz at gain 0.25 and routed to the system speaker while the ordinary Voice Lightning practice path held a live microphone stream.

| Metric | Result |
|---|---:|
| Estimates | 3,602 |
| Estimate rate | 60.016 Hz |
| Sample age median | 85.433 ms |
| Sample age p95 | 85.533 ms |
| Estimate interval median | 16.700 ms |
| Estimate interval p95 | 17.100 ms |
| Compute time median | 0.100 ms |
| Compute time p95 | 0.200 ms |
| Invalid-observation dropouts | 3,602 / 3,602 (100.00%) |
| Valid observations | 0 / 3,602 (0.00%) |
| Animation-frame stalls >32 ms | 0 |
| Longest qualifying stall | none |

## Captured instrumentation output

A compact machine-readable capture is committed beside this receipt at `receipts/pf3/PF3-AUDIO-INSTRUMENT-2026-10-06-measurement.json`. It contains the debug summary, counts, complete stall list, first estimate, last estimate, browser identity, route, and test setup.

First estimate excerpt: sample age 85.433 ms; interval 27.800 ms; compute 0.100 ms; invalid/dropout; frame interval 27.800 ms.

Last estimate excerpt: sample age 85.433 ms; interval 16.400 ms; compute 0.100 ms; invalid/dropout; frame interval 16.400 ms.

## Dropout observation and interpretation

The detector loop remained live at approximately 60 Hz for the complete capture, but every estimate was invalid. The browser microphone stream was live and the oscillator was routed to the system speaker; this machine's selected microphone did not deliver the speaker sweep above the detector's activity gates. Therefore this run measures the instrumented scheduling/window/compute path and honestly records a 100% dropout lane, but it does not establish valid-tone pitch tracking, acoustic capture-to-feedback latency, or physical speaker/microphone quality.

The reported sample age is the implementation's capture-age estimate: the 4,096-sample analyser window duration at the active sample rate plus current estimate computation time. It is not a measured acoustic speaker-to-screen latency.

No scoring behavior was changed during measurement. The 300 ms hold, literal octave matching, stale-source protection, repeated-frame protection, and Pitchy detector remain as implemented in the parent commit. A valid-observation follow-up requires a known audible input device or controlled fake-media fixture; it is not needed to report the requested scheduler metrics and observed dropout truth from this run.

## Verification

The implementation phase already passed the focused instrumentation and scoring-invariant checks recorded by parent task t_1c9ffb7e. This delivery phase additionally exercised the real `?pfdebug=1` browser buffer for the full requested duration and captured its output without modifying scoring.
