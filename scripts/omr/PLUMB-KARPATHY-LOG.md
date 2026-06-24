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

**FLW verdict:** ⏳ AWAITING APPROVE to advance to G2 (Lida → 100% green).
