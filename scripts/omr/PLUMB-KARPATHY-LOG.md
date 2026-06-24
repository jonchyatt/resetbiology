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

**FLW verdict:** ✅ APPROVED (Jon, 2026-06-24) — "Fix now, then advance hold the true north." Silent bars fixed; advancing to G3.
