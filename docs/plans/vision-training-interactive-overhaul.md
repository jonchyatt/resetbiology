# Vision Training Interactive Overhaul — MASTER PLAN (plan-of-record)

**Status:** ACTIVE — Jon re-greenlit 2026-07-12 ("massive upgrade... dream wish list... map it out... build with da Vinci genius"). Original decision 2026-04-03.
**Rail:** `jarvis/data/rb-vision-interactive/` (lock: session 611d887a). Jarvis canon: `memory/projects/project_rb_vision_interactive_overhaul.md`.
**This file is the survivable spec.** Any Claude/Codex/human picking this up mid-flight: read this file top to bottom, then check §9 Build Ledger for what's already done.

---

## 1. North Star

The 12-week vision program must stop being *a digital PDF with Mark Done buttons* and become **a guided vision gym**: every session is a coached, full-screen, animated workout your eyes physically follow — timed, measured, scored, narrated — that a user *wants* to come back to for 60 sessions. FUN FIRST, educational second (Jon doctrine).

The test for every screen: **"Does the screen DO the exercise with you, or does it describe the exercise at you?"** Describing = failure.

## 2. What already exists (DO NOT REBUILD — this is the 85%)

| Asset | Where | State |
|---|---|---|
| 12-week curriculum (6 phases × 2 wks, 5 sessions/wk, per-day blocks + cues) | `src/data/visionProtocols.ts` (942 ln) | SOLID — becomes the prescription source for engines |
| 11 exercise definitions (checkpoints, cues, distances, progressions) | `src/data/visionExercises.ts` | SOLID — becomes engine config |
| Enrollment / streaks / points / phase gates / pause-resume | `app/api/vision/{program,progress,sessions}/route.ts` + 4 Prisma models (VisionProgramEnrollment, VisionDailySession, VisionSession, VisionProgress) | SOLID — extend, never replace |
| 3-tab shell (Today's Session / Focus Training / Vision Library) | `src/components/Vision/VisionTraining.tsx` | KEEP — never strip |
| Snellen trainer (letters + E-directional, near/far, phone/desktop, untimed mode) | `Training/SnellenChart.tsx`, `TrainingSession.tsx` | THE MODEL — already truly interactive |
| 6-mode binocular fusion (off/duplicate/red-green/grid²/grid◇/alternating) + fullscreen portal | `Training/BinocularChart.tsx` | KEEP — never strip |
| Gabor patch renderer (scientifically correct, canvas) | inside `Training/GuidedExercise.tsx` (`drawGaborPatch`) | EXTRACT + REUSE |
| GuidedExercise v1 (canvas patterns + TTS + tones + timer) | `Training/GuidedExercise.tsx` (647 ln) | SEED — v1 stays until v2 engines replace it per-exercise (v2-alongside-v1 doctrine) |
| Breathe app session machine (9 states), animated orb, offline Dexie | `/breath` app + `BreathingOrb.tsx` | TEMPLATE for runner + downshift engine |
| 51 ScreenFit source PDFs | `screenfit/` | CONTENT SOURCE for scripts/cues/video storyboards |

**GuidedExercise v1's real gaps** (why it still feels like a PDF): cue cycling is time-sliced narration divorced from the prescription (no reps, no bpm ramps, no week-awareness); 5 of 11 exercises fall through to a generic pulsing dot; zero user input → zero measurement → zero game; no flow between exercises (each is an island behind a "Back to exercises" list); tiny 400×300 canvas instead of full-screen immersion; no session arc (no warm-up → work → proof → report).

## 3. Dream Wish List (full map — everything it can be)

Tiered. T0–T2 = the transformation Jon asked for. T3–T4 = the dream ceiling. Build in order; never let a T4 idea stall a T1 ship.

### Tier 0 — Engine framework + Session Runner v2 (the spine)
- **W0.1 `VisionEngine` contract** — `src/components/Vision/Engines/types.ts`: every exercise engine implements `EngineProps { exercise, prescription, onProgress(metric), onComplete(result) }` and returns `EngineResult { durationSec, metrics: Record<string,number>, selfReport?, score }`. Prescription = `{ week, targetSeconds, bpm?, reps?, speedMultiplier?, distances? }`.
- **W0.2 Prescription resolver** — `src/lib/vision/prescription.ts`: pure function `(exerciseId, week, enrollment) → Prescription`, derived from `visionProtocols.ts` + exercise `progression` strings (e.g. "start 60 bpm; +5 bpm once accuracy ≥ 90%"). Week 1 ≠ week 9: engines get harder from DATA, not hardcode.
- **W0.3 Shared canvas kit** — `src/lib/vision/canvasKit.ts`: extract `drawGaborPatch`, parametric paths (infinity, rectangle, custom), DPR-correct full-screen canvas hook, reduced-motion fallback.
- **W0.4 Audio/voice kit** — `src/lib/vision/audioKit.ts`: TTS queue (no overlap), metronome (WebAudio, drift-free lookahead scheduler), tone palette, mute persistence.
- **W0.5 Session Runner v2** — `Training/SessionRunner.tsx`: full-screen portal (reuse binocular portal pattern). State machine: `intro → engine[i] → interlude → … → proof (Snellen quick-test) → report`. Interludes = 20–30s breathing rest with orb + "next up" preview. Report = points, per-exercise scores, streak, measured deltas, one-tap "log & finish" → existing `/api/vision/sessions` (extend payload with `metrics` JSON — additive, non-breaking).

### Tier 1 — Five engine archetypes covering all 11 exercises
| Engine | Exercises | Interaction (the game) | Measured |
|---|---|---|---|
| **W1.1 DownshiftEngine** | palming-reset, box-breath-vision | Breathe-style orb paces inhale/hold/exhale from `breathingCue`; screen auto-dims for palming; gentle voice script from PDF content | compliance (completed cycles) |
| **W1.2 FocusRhythmEngine** | focus-pushups, focus-trombone | Animated depth target grows/shrinks on breath rhythm; at each far/near hold a small letter appears → user taps the matching letter from 3 choices = clarity confirmed; blur-point slider logs NPC cm | NPC (cm), accuracy %, tempo reached |
| **W1.3 PursuitEngine** | smooth-tracking, figure8-fixation | Full-screen Gabor target rides parametric paths at week-scaled speed; optional finger/mouse trace mode scores smoothness (path deviation); size/distance layering per prescription | smoothness score, time-on-path %, speed level |
| **W1.4 SaccadeEngine** | eye-jumps | Metronome-locked jumps between targets; each target flashes a letter for ~200 ms → user keys/taps what they saw; adaptive: ≥90% accuracy for 2 rounds → +5 bpm (from exercise data) | accuracy %, bpm reached, reaction consistency |
| **W1.5 PeripheralEngine** | peripheral-pointing, mirror-scan, laterality-ladder | Central fixation task (letter changes; user must answer it → PROVES eyes stayed centered) while peripheral targets flash at increasing eccentricity; tap/point response. Laterality variant: L/R prompts, crossed-hand key response (e.g. look-left-tap-right) | reaction ms, detection % by eccentricity ring, laterality error rate |
| **W1.6 SnellenWalks adapter** | snellen-layering-walks | Extends existing SnellenChart: step-cadence audio ("step… read…"), phone-in-hand mode, line-per-step progression | furthest clear line in motion |

Each engine is ONE new file in `src/components/Vision/Engines/`. Registry `Engines/index.ts` maps `exerciseId → engine`. `GuidedExercise.tsx` becomes the fallback for anything unmapped (v1 alongside v2 until parity, then v1 retires).

### Tier 2 — The inspiration layer (what makes users COME BACK)
- **W2.1 Session intro cinematic** — 10s mission card: phase narrative ("Week 5: Resilience & Speed — today your saccades get faster"), what you'll unlock, current streak on the line.
- **W2.2 Voice coach everywhere** — Web Speech now; wired through audioKit so the RB voice stack (12 agents, Kokoro/Polly) can swap in later without touching engines.
- **W2.3 Performance-based points** — points scale with measured scores, not mere completion (keep existing completion points as floor — never-strip).
- **W2.4 Post-session report card** — deltas vs your baseline, personal bests, phase-gate progress ring, encouraging one-liner. Shareable-screenshot-worthy.
- **W2.5 Progress charts** — trend lines per metric (NPC cm ↓, saccade bpm ↑, peripheral ms ↓, Snellen line) in ProgressDashboard from the new metrics JSON; phase gates drawn as milestones.
- **W2.6 Weekly assessment ritual** — end of each 2-week phase: guided re-baseline (near/far Snellen + NPC) with before/after reveal. This is the retention hook — visible proof it's working.

### Tier 3 — Intelligence layer
- **W3.1 AI Vision Coach** — post-session feedback + Q&A + plan adjustment suggestions. MUST run CF Workers AI free tier (hard doctrine: `feedback_no_paid_burn_for_free_users.md`) — never a paid key for anonymous users.
- **W3.2 Breath integration** — Breathe app protocols embedded as the downshift engine's backend; session data cross-posts to breath history.
- **W3.3 Video demos** — 30-60s clip per exercise from ScreenFit PDF storyboards (content pipeline, not code).
- **W3.4 Night mode** — red-shifted dark palette for evening sessions (roadmap item).

### Tier 4 — Frontier (phase 2, explicitly out of current scope)
- **W4.1 Camera assist**: webcam distance tracking (upgrade existing `DistanceTracker.tsx`), face-mesh head-stillness scoring (MediaPipe), gaze-estimation compliance (WebGazer-class). Jon ruled: screen-guided ships FIRST; camera = phase 2 experiment.
- **W4.2 Custom exercise builder** (admin CRUD like Breathe's library) · **W4.3 community/leaderboards** · **W4.4 wearable distance** · **W4.5 offline PWA/Dexie parity with Breathe** · **W4.6 Drive sync**.

## 4. Hard constraints (violating any = regression)
1. **Never strip**: 3-tab layout, 6 binocular modes, phase gating, streaks/points, untimed mode, enrollment flow. New engines are ADDITIVE (`feedback_never_strip_features_silently.md`, `feedback_v2_alongside_v1.md`).
2. **Deploy = `git push origin master` ONLY.** NEVER run `vercel` CLI in this repo (duplicate-project trap; cost money twice). Live Vercel project is `app`.
3. **Layout trap**: routes live in `/app/`, components in `/src/components/` — search both before declaring anything missing.
4. **Verify on the LIVE site** (resetbiology.com) at phone viewport — localhost proof is not proof; HH Chromium ≠ iOS Safari proof, so keep all interactions touch-first, no hover-dependent UI.
5. **Free-tier AI only** for anonymous-user features.
6. **Mobile-first**: most users train on a phone held at arm's length. Big targets, landscape support for binocular, TTS because eyes are busy.
7. **DB additive-only**: new metrics ride in existing JSON fields or new nullable columns; no destructive Prisma migrations.

## 5. Work packages + delegation map

Disjoint file ownership so parallel builders never collide. Registry wiring (`Engines/index.ts`, SessionRunner integration) is ORCHESTRATOR-ONLY (one writer).

| WP | Contents | Files (owned) | Assignee class | Depends on |
|---|---|---|---|---|
| WP0 | W0.1–W0.4 contract, resolver, canvasKit, audioKit | `src/components/Vision/Engines/types.ts`, `src/lib/vision/{prescription,canvasKit,audioKit}.ts` | Orchestrator (Claude) — foundation must be right | — |
| WP1 | W1.1 Downshift + W1.2 FocusRhythm | `Engines/{DownshiftEngine,FocusRhythmEngine}.tsx` | Sonnet subagent A | WP0 |
| WP2 | W1.3 Pursuit + W1.4 Saccade | `Engines/{PursuitEngine,SaccadeEngine}.tsx` | Sonnet subagent B | WP0 |
| WP3 | W1.5 Peripheral (+ laterality variant) | `Engines/PeripheralEngine.tsx` | Sonnet subagent C | WP0 |
| WP4 | W0.5 SessionRunner v2 + interludes + report + registry wiring | `Training/SessionRunner.tsx`, `Engines/index.ts`, edits to `DailyPractice.tsx` | Orchestrator (Claude) | WP0 (parallel w/ WP1–3) |
| WP5 | W1.6 Snellen walks adapter + W2.3 points + API metrics extension | `Engines/SnellenWalksEngine.tsx`, `app/api/vision/sessions/route.ts` (additive) | Codex High (`codex exec --sandbox workspace-write`) | WP0 |
| WP6 | W2.5 charts + W2.6 weekly assessment | `Training/ProgressDashboard.tsx` (extend), `Training/WeeklyAssessment.tsx` | Sonnet subagent D | WP5 |
| WP7 | W3.1 AI coach (CF Worker + UI card) | new worker + `Training/CoachCard.tsx` | Codex High | WP5 |
| WP8 | W2.1 intro / W2.4 report polish / W3.4 night mode | inside SessionRunner files | any | WP4 |

**Acceptance per engine (definition of done):** full-screen on phone viewport · driven by prescription (week 1 vs week 9 observably different) · at least one REAL user interaction that produces a metric · TTS + visual cues · pause/resume/mute · returns `EngineResult` · completion feeds existing session API · zero TypeScript errors (`npx tsc --noEmit`) · zero console errors in a live run.

**Gate:** after WP1–4 land → deploy → verify each engine on live resetbiology.com at 390×844 viewport (screenshots into `jarvis/data/rb-vision-interactive/runtime-logs/`) → dual-eye pass on the animated engines → then WP5–8.

## 6. Build order (if you only have N hours)
1. WP0 (2h) → 2. WP4 runner skeleton with v1 GuidedExercise as engine shim (2h — DEMO-ABLE HERE: full guided session flow exists even before new engines) → 3. WP1–WP3 in parallel (engines swap in one by one) → 4. WP5 → 5. WP6 → 6. WP7/WP8.

## 7. What "inspiring" means, concretely (for whoever builds T2)
The user should feel: *briefed* (intro tells them today's mission and why), *carried* (never wonders "what now?" — the runner always moves), *seen* (voice reacts to their actual performance numbers), *proven* (weekly before/after reveals), *rewarded* (points reflect real gains, streak fire, personal bests). Copy tone: coach-warm, zero clinical dryness.

## 8. Source-content mining
The 51 PDFs in `screenfit/` hold the original coaching language, rep schemes, and safety notes. When an engine needs richer scripts than `visionExercises.ts` carries: mine the matching `Exercise-NN-*.pdf`, put durable extractions into `visionExercises.ts` fields (not hardcoded in components).

## 9. Build Ledger (append-only — update SAME commit as the work)
| Date | WP | What landed | Commit | Verified? |
|---|---|---|---|---|
| 2026-07-12 | — | This plan written; rail claimed (jarvis `data/rb-vision-interactive/`) | — | n/a |
