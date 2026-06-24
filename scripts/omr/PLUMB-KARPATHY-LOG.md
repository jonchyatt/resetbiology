# PLUMB — Karpathy / FLW gate log

External GM: Frank Lloyd Wright (FLW). Each gate: measurable goal → hypothesis → experiment → measure → result → FLW verdict. Advance only on APPROVE. Deterministic code is the floor of truth; every number from a tool, every AI claim verified against the artifact.

---

## G1 — Verify the plunk source (does VT III play from the score, or stale omrTargets?)

**Date:** 2026-06-24 (session resume, fresh context)

**Measurable goal:** Determine, at the artifact level, the runtime source of VocalTrainer III's plunk reference pitches + timing — the verified score-derived sync, or the stale `omrTargets.ts` ("OLD hallucinated OMR pitches").

**Hypothesis (PLUMB.md:61):** the live plunk may be reading `omrTargets.ts`, which would mean the engraving work and the plunk source were disconnected — explaining why the plunk "never felt score-driven."

**Experiment:** static trace of `src/components/PitchDefender/VocalTrainerIII.tsx` plunk audio path + grep every writer of `plunkNotesRef` + read the sync-v2 JSON header + read the `omrTargets.ts` header. (ui-specialist dispatched for canon; every claim re-verified against file by grep/read.)

**Measurement (artifact-verified, not specialist words):**
- `plunkNotesRef.current` is assigned in **exactly 2 places**: line 1031 (`= []` reset) and line 1049 (the sync fetch). **No `omrTargets` writer exists.**
- Plunk audio path: `syncUrl` → (`getActiveLidaRoseScorePart` swaps to `syncV2Url`, default `scoreTimingMode='v2'` @340) → `fetch` @1046 → `plunkNotesRef` @1049 → `schedulePlunkWindow` @986 → `playPlunkTone` → `freq = midiToFreq(note.pitchMidi)` @943.
- Sync-v2 file header (`public/musicxml/lida-rose-lead-sync-v2.json`): `"source": "score-conductor-v2 shared Lead-led timing from corrected score rhythm"` — score-derived; `noteCount: 118`.
- `omrTargets`/`getOmrTarget`/`omrTarget` references are **all in the visual lane only**: import @42, `omrTarget` useMemo @1638, phrase/target/render @1644-1731, @2401-2541. None reach `plunkNotesRef` or `playPlunkTone`.
- `omrTargets.ts` header @4-6 itself: "The Lead timing is superseded by lida-rose-lead-sync.json. Baritone timing is superseded by lida-rose-baritone-sync.json."

**Result: HYPOTHESIS REFUTED.** The plunk plays from the **score-derived sync-v2 JSON**, not `omrTargets`. Engraving and plunk source ARE connected. The feared regression does not exist in the audio path. `omrTargets` survives only as the visual practice-lane fallback (and even there, reconciled JSON wins first).

**Two open deltas to "definition B" (plunk plays FROM THE SCORE — correct pitches AND dead-on timing):**
1. **Equality unproven (→ G4).** sync-v2 is *generated from* the corrected score, but nothing asserts `pitchMidi` == the verified MusicXML note-for-note. Generated-from-score ≠ proven-equal-to-score. Plumb's conviction: only the green gate locks it. (Note: `verify-vt3-plunk-sync.mjs` + `check-notes-match.mjs` already exist — inspect before building G4 fresh.)
2. **Timing still hybrid, not dead-on.** sync-v2 header: timing = "score rhythm plus measure-level isolated-audio anchors" (24 conductor anchors). Definition B demands "dead-on timing, NOT from extracted audio." Pitches already meet the bar; **timing leaning on audio anchors is the real gap to True North.**

**Reframe for the mission:** the engraving work was not wasted — it feeds the plunk. The remaining work is not "rewire the source" (already correct) but "**prove** the source equals the score (G4) and **lift timing off audio onto pure score rhythm** (definition B)." G2's green gate is the precondition that makes that proof meaningful.

**FLW verdict:** ✅ APPROVED (Jon, 2026-06-24) — "as long as the score is super accurate... I can't have either an inaccurate score or a metronome that doesn't work." Directed a deep-dive on existing score-playback solutions to optimize the whole build (3 parallel research agents — synthesis in `PLUMB-RESEARCH-SYNTHESIS.md`).

---

## G2 — Lida Rose → 100% green

**Date:** 2026-06-24 (same session)

**Measurable goal:** every notation-law violation cleared — `verify-score-invariants.mjs lida-rose` reports PASS for both parts. Each fix print-pinned (printed page / homophonic source voices), never guessed; pitch sequences cross-checked so the build's omrTargets verify still holds.

**Baseline (tool, not estimate):** 5 violations — Lead I1@m16 (36t), I1@m18 (36t), I2@m25 (E♮→E♭ tie); Baritone I1@m17 (42t), I4 (31 bars != 34).

**Experiment + measurement (all artifact-verified):**
- **Lead m16/m18** — built `_inspect-source.mjs`; dumped all 4 source voices. Homophony proved 4-beat bars (m16 = 4 plain quarters per Tenor+Baritone; m18 = rest+2 eighths+2 quarters per Tenor+Baritone+Bass). Audiveris had mis-read 3 quarters as a 2/3 triplet. `deTripletizeQuarterTriplets` restores quarters; **pitch sequence unchanged** → build verify intact.
- **Lead m25** — source exports key-flats *with* `<alter>` (m24 note1 = `E(-1)4`), so m25 note1 having NO alter = genuine E-natural; `normalizeLeadMeasure` per-measure reset key-flatted it → cross-pitch tie. `fixLeadTieStopNatural` restores E♮; regenerated omrTargets (the build's "first divergence @84: E4 vs D#4" gave the exact index).
- **Baritone** — the 1368-line `lida-baritone-source-corrections.mjs` is **dead (no importers)**; baritone is driven by `applyLeadMeasureCorrections(... part:'Baritone')`. Mapped generated→printed deterministically: gen m17 = p197 P3 local m9 = **printed bar 19**. Inserted the 3 dropped held wholes (printed 9 "shy"=F3, 13 "chime"=Cb4 [contract], 21 "name"=Cb4 [page]); completed bar 19's 8-eighth run (+Db4). Held pitches read from the printed page since Audiveris dropped the bars entirely.

**Result: GATE PASS.** Lead 35 bars + Baritone 34 bars, all notation laws hold. "Safe to lock." Committed `e08fce21` (protect commit `852c53a5` before it). omrTargets regenerated (Lead 118, Baritone 106→110); both builds pitch-verify.

**Found + FIXED (Jon: "fix now"):** baritone bars 5 "sky", 25 "hop-ing", 29 "fine" were silent full-rests — Oliver dropped by Audiveris, same class as the held bars, but the gate can't see "silent where the page shows singing." Restored from the printed page + chord constraints: bar 5 = F3 (same Cb4-Lead cadence as "shy", HIGH), bar 25 = Db4 + Bb3 ("ing"=Bb3 completes the Eb triad HIGH; "hop"=Db4 root-double MODERATE), bar 29 = Eb3 (doubles Lead Eb4, MODERATE). Baritone now 114 notes, 0 silent sing-bars, gate still green. Moderate reads flagged for visual confirm when G4 plays them.

**FLW verdict:** ✅ APPROVED (Jon, 2026-06-24) — "Fix now, then advance hold the true north." Silent bars fixed; advancing.

---

## G4 (step 1) — Plunk-from-score VERIFIER built + run (the True North gate)

**Date:** 2026-06-24 (same session)

**Measurable goal:** a gate that proves the plunk a singer matches plays the verified score note-for-note. Built `verify-plunk-from-score.mjs <songId>` — extracts the melodic pitch sequence from the verified MusicXML and from the sync JSON VT III actually fetches, asserts equality.

**Measurement (run vs current sync):** **FAIL, quantified —**
- Lead `-sync-v2.json` / `-sync.json`: 118 vs 118 notes, **first divergence @84: score E4 vs plunk D#4 (Eb4)** — the plunk still carries the OLD hallucinated m25 pitch, not today's E-natural correction.
- Baritone: **score 114 vs plunk 106** — the plunk is missing all 8 notes added today (3 held bars + bar-19 eighth + 3 restored sing-bars); diverges @4 (F3 vs G#3, sequence shifted).

**Result:** confirms G1's open delta concretely — the plunk source is correctly *wired* (reads sync-v2) but the sync is **stale**: it was built before the engraving was corrected. *This is why the plunk never felt score-driven.* The verifier is the permanent lock; it goes green only when the sync is rebuilt off the corrected score.

**Next experiment (the metronome fix + True North):** rebuild `build-lead-sync.mjs` / `build-baritone-sync.mjs` to **pure-notation timing** — delete the audio-anchor machinery (`alignScoreToAudio` / `selectConductorAnchors` / `pruneTempoCliffAnchors`), walk score events `start += durationDivs/divisions × 60/bpm`, keep the `{pitchMidi,startTimeSeconds,durationSeconds}` shape. Then `verify-plunk-from-score.mjs` PASSES = plunk plays the verified score, dead-on, no audio. Recipe: `PLUMB-RESEARCH-SYNTHESIS.md`.

**FLW verdict:** ⏳ gate defined + gap quantified. Handing off the sync rebuild (substantial) to a fresh session per context discipline.

---

## G4 (step 1 BUILD) — Sync rebuilt to pure-notation timing (the metronome fix)

**Date:** 2026-06-24 (session 3 resume, fresh context)

**Report to FLW — state absorbed:** True North = raw score in → flawless verified trainable product out, zero re-audit; the engraving is the foundation, the **plunk that plays plumb-true off the verified score** is the goal; deterministic code is the floor of truth, a song locks only when the gate is green. Current state: Lida 100% GREEN engraving both parts (Lead 35 bars/118 notes, Baritone 34 bars/114 notes); `verify-score-invariants.mjs lida-rose` PASS; `verify-plunk-from-score.mjs lida-rose` RED — the plunk sync is **stale** (frozen before the engraving was corrected): Lead diverges @84 (old m25 E♭ not E♮), Baritone 106 vs 114 (missing today's 8 added notes).

**Measurable goal:** `node scripts/omr/verify-plunk-from-score.mjs lida-rose` GREEN — the plunk a singer matches plays the verified MusicXML note-for-note — by rebuilding the sync from the corrected score with **pure-notation timing** (no audio), while keeping `verify-score-invariants.mjs` GREEN and every other committed gate GREEN.

**Hypothesis:** the plunk never felt score-driven because the sync timing is DTW-aligned to an audio recording (~24 conductor anchors + rubato) — research synthesis §0: MusicXML `<duration>/<divisions>` is authoritative and already tuplet-adjusted, so dead-on timing = `startBeat × 60/bpm`, no audio. Rebuilding pitch off the corrected XML fixes the pitch divergence by construction (same XML the gate reads); rebuilding timing off pure notation fixes Jon's "weird metronome."

**Recon (artifact-verified, not estimated):**
- Pipeline: v1 `build-{lead,baritone}-sync.mjs` → `-sync.json`/`-reconciled.json`; v2 `build-lida-conductor-v2.mjs` reads v1 reconciled `src==='conductor-anchor'` markers → `-sync-v2.json` (what VT III fetches for the plunk, line 1046 → `plunkNotesRef`) + `-reconciled-v2.json` (visual lane) + health.
- **No `<sound tempo>` / `<metronome>` / `<per-minute>` in either MusicXML** (only `<sound dynamics>`). Per synthesis tempo-trap, BPM must be supplied + asserted, not defaulted. → BPM becomes **contract golden-truth** (`tempoBpm`).
- **Measured tempo (deterministic, committed data):** Lead 118 notes / **138 beats** (m1 pickup=2, 34 bars × 4); Baritone 114 / **134 beats** (m1=2, 33 × 4) — every full bar = 4 beats, cross-validates the engraving. Avg = totalBeats/recordingDur×60: Lead 99.47, Baritone 96.53. **The two parts are sung together → must share ONE tempo grid** (else they drift seconds apart). Shared **tempoBpm = 99** (Lead-led measured average, rounded; spb 0.606, span 83.6s ≈ recording).
- **Coupling discovered (the web Plumb warns of):** deleting the audio-conductor machinery turns 3 *other* committed gates RED — `build-lida-score-health.mjs` + `build-baritone-score-health.mjs` (`score-conductor-sync` check requires `conductorAnchors≥18` + `/score-conductor/` source) and `verify-vt3-plunk-sync.mjs` (same). True North A (100% green) + "gate stays green to advance" ⇒ these must MIGRATE to pure-notation invariants, not be shimmed. `EXPECTED_BARITONE_NOTE_COUNT=106` is also stale (score 114) — baritone health already failing today.

**Experiment (the build — one unified timing core, no fan-out: deterministic timing math must be a single source of truth):**
1. Shared `score-timing.mjs` — proven `scoreEventsFromXml` + `resolveTempoBpm(contract)` (throws if absent) + `buildNotationNotes(events,bpm)` (`start=startBeat×60/bpm`, `dur=beats×60/bpm`, clamp non-overlap).
2. Contract: add `tempoBpm:99`, Baritone `expectedNotes:114`. Baritone manifest → 114 + version.
3. Rewrite v1 lead+baritone + v2 conductor → pure-notation; self-verify count + pitch==XML inline.
4. Migrate both health builders + `verify-vt3-plunk-sync.mjs` → `notation-timing` check (source `/notation/`, monotonic, every start == `round3(scoreBeat×60/bpm)` dead-on grid). Keep all source-side checks (key/pitch/whole-note/count/printed-audit/clef) intact.

**Backup (iron rule):** `/c/Users/jonch/omr-backups/20260624-161235-before-sync-rebuild/` (10 scripts + 16 JSON).

**Measurement + result: ✅ GREEN — the metronome is fixed.**
- `verify-plunk-from-score.mjs lida-rose` → **PASS** all four: Lead `-sync-v2`/`-sync` 118 note-for-note, Baritone `-sync-v2`/`-sync` 114 note-for-note. The plunk now plays the verified score.
- `verify-score-invariants.mjs lida-rose` → **PASS** both parts ("Safe to lock") — musicxml untouched, law gate stayed green.
- `verify-vt3-plunk-sync.mjs` → **PASS** both parts (118/114, pure-notation source, dead-on grid).
- Build artifacts: Lead 118 notes @ 99bpm → 82.42s, dead-on grid offGrid=0/118; Baritone 114 @ 99bpm → 81.21s, offGrid=0/114 (ends ~1.2s before Lead's tied bar-35 "Rose", correct — Baritone tacet there). Both parts on ONE shared 99bpm grid ⇒ duet stays aligned. Lead health 8/8 PASS.
- Files: `score-timing.mjs` (new shared core) + rewritten `build-{lead,baritone}-sync.mjs` + `build-lida-conductor-v2.mjs` (all audio machinery deleted) + migrated `build-{lida,baritone}-score-health.mjs` + `verify-vt3-plunk-sync.mjs` (score-conductor → notation-timing check) + contract `tempoBpm:99`/Baritone `expectedNotes:114` + baritone manifest 106→114.

**Finding surfaced (NOT a regression — the gate doing its job):** rebuilding Baritone health against the session-2-corrected score un-masked a stale **engraving-audit** discrepancy — `printed-score-audit` FAILs at generated m9/m18/m31 (e.g. m9 score `F3:whole` vs manifest `Cb4:half Gb3:half`). Git timeline proves it: `lida-baritone-printed-manifest.mjs` last touched **2026-06-23** (`37a75735`, pre-correction); the baritone score corrected **2026-06-24** (`0b14a143`). `PRINTED_BARITONE_AUDIT_MEASURES` is calibrated to the OLD reading. It was hidden until now only because the health JSON was stale (built against the old 106-note score). **NOT auto-fixed** — editing independent printed-page audit truth to match the build is the self-grading anti-pattern Plumb exists to kill; resolving m9/m18/m31 requires a VISUAL read of pp.197-198 (Oliver's line). This belongs to G3 (gate hardening) + the prompt's already-queued "baritone moderate reads need visual confirm when the plunk plays them." Timing/plunk/law gates are all green; the Baritone engraving layer is not fully locked until the page is read.

**FLW verdict:** ⏳ AWAITING — step 1 (metronome/plunk) green on all timing+law gates; reporting for APPROVE to advance. G3 should fold in the Baritone audit-manifest reconcile (visual) alongside the octave-vs-source + silent-where-singing invariants.
