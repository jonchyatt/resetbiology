# PF-7 benchmark recovery receipt

Date: 2026-10-07
Branch: card/pf-7-benchmark-recovery
Base: a9c1378339157b76eb94a78d58887a03905b81d5 (origin/master)

## Delivered in this attempt

- Recovered `D:/worktrees/rb-pf7-benchmark` from an interrupted checkout by restoring it to origin/master; no unrelated worktree was deleted.
- Added deterministic 48 kHz fixture and aligned-window contract at `src/components/PitchDefender/pitchBenchmark.ts`.
- Fixture set: 11 fixtures (five steady notes C2-C6, semitone step, octave leap, glide, silence, reference-only, reference-plus-singer).
- Source windows: 3,072 samples, 1,536-sample hop; model input: exactly 1,024 samples at 16 kHz.
- Added octave-sensitive cents and octave-displacement metric helpers plus median/p95, missed-voiced, silence false-voiced, and compute-time aggregation.
- Increased the legacy microphone benchmark analyser from 2,048 to 4,096 samples so a 48 kHz capture is not below PESTO's 1,024-sample post-resample minimum.
- Added focused fixture-contract test and a manifest runner.

## Runnable checks

- `npx tsx tests/pitch-benchmark.test.ts` PASS: 11 fixtures, 330 windows, 3 detectors.
- Contract runner twice: both runs produced 11 fixtures, 330 windows, 990 detector rows; byte comparison PASS.
- `npx tsc --noEmit` PASS.
- `git diff --check` PASS.

## Explicit remaining gap

The actual browser model inference pass (Pitchy, PESTO, and CREPE on those injected fixtures), timing capture, model-result JSON, commit/push, and PR were not completed in this attempt. The deterministic preprocessing and metric contract are real and tested; no model metrics are claimed here.
