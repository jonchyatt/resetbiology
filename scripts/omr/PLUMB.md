# PLUMB — raw score in → verified, dead-on, trainable product out

**Name:** *Plumb*. A plumb line is the dead-on-true reference; the plunk track plays **plumb-true off the verified score**, and the gate keeps everything true. (Rename freely — Jon names things.)

The system the VocalTrainer III OMR lane is *becoming*. Today (2026-06-24) the **verification core** (the gate) was built and proven; the full product is not finished yet — see "Remaining steps."

---

## ⭐ TRUE NORTH — the vision that anchors every decision

Jon feeds in a single raw scanned page of music — one of the 248 pages of the *Music Man* vocal book, or any score he will ever hold — and **Plumb returns a flawless, fully-verified trainable product with zero human re-audit**:

- An **engraving** note-for-note, beat-for-beat identical to what the composer printed — every notehead on the right line, every accidental, every tie, every held whole note, the right clef, octave, and key.
- A **plunk track** — the reference pitches the student sings against — that plays **plumb-true off that verified score**: the *actual written music*, at the *correct pitch* and *dead-on timing*, NOT a noisy guess scraped from a recording. When his son sings "Lida Rose," the note he matches is the note Meredith Willson wrote, rendered perfectly.
- The **lyrics**, under the right notes, so the surface teaches the words and the music as one.

And it does this **at scale** — score after score, each going in raw and coming out perfect and *locked* — so the library of trainable songs grows without Jon, or any Claude, ever again squinting at a ledger line at 4 a.m.

**The engraving was never the goal — it is the foundation.** The goal is the **plunk that plays true**, because a singer can only learn pitch against a reference that is itself perfect. *Perfect the score so the plunk plays plumb.* Jon has held that line from the very start.

**The conviction that makes it a system, not a heroic act:** *deterministic code is the floor of truth.* OMR is lossy and always will be; no model — not Audiveris, not a sub-agent, not the operating Claude — is ever trusted above the notation laws and the golden contract. A song is *locked* only when the gate is green. This is the system Jon can **walk away from**. It is the exact opposite of "it keeps looking at it."

---

## The finished-product definition (Jon, 2026-06-24) — what "done" means
> "Go in one piece, come out a perfect verified product."

- **A. 100% GREEN** gate — zero flagged defects, not "5 known gaps."
- **B. Plunk track plays FROM THE SCORE** — correct pitches (already score-derived) **and dead-on timing**, NOT from extracted audio. *This was the whole point of perfecting the engraving.*
- **C. Lyrics included.**
- **D. Repeatable** — drop in a score's scans → out comes the verified product (one orchestrated pass). The real goal is the 6 barbershop + ~14 other raw-scanned songs, not just Lida.

---

## Why Plumb converges where prior attempts didn't
OMR (Audiveris) is lossy and **cannot be made perfect**. So don't chase perfect OMR — **fence it**: deterministic checks the corrections can't satisfy by being self-consistent, plus a once-minted golden contract. A song is *locked* only when green.
The OLD gate (`verify-lida-score-source-gate.mjs`) compared the build to a re-run of the **same** corrections → green even when a correction was wrong (self-grading homework). **Plumb's gate checks notation LAWS** a wrong correction can't satisfy.

## Pipeline stages
1. **Ingest** — scans/PDF → `pdftoppm` render → Audiveris OMR → `scripts/omr/source/<song>-<pg>.xml` (PRIMARY SOURCE, read-only, never edited).
2. **Engrave** — `build-<part>-musicxml.mjs`: isolate part (treble-8 lead / bass baritone), normalize divisions to 12, stitch, apply *minimal* corrections → `public/musicxml/<song>-<part>.musicxml`.
3. **GATE** — `verify-score-invariants.mjs <songId>` vs `songs/<songId>.song.mjs` contract:
   - I1 bar completeness · I2 tie-pitch parity · I3 numbering · I4 bar-count vs contract · I5 note count · I6 dangling ties · I7 key
   - **[TODO] octave-vs-source rule** — generated octave must equal the Audiveris source octave (corrections never shift octave). The 2026-06-24 incident is exactly why.
   - then `verify-lida-score-source-gate.mjs` (build-determinism consistency).
4. **Plunk / timing** — `build-<part>-sync.mjs` + `build-lida-conductor-v2.mjs`: plunk **pitches come from the score**; timing is currently score-rhythm + audio *anchors* (hybrid, Phase-1 — NOT yet dead-on).
5. **[TODO] Lyrics** — carry `<lyric>` from the source XML → attach to notes → verify present + aligned. (Audiveris already exports lyrics; the build currently strips them.)
6. **App artifacts** — ~9 JSON/MusicXML files per song + `omrTargets.ts` entry + `ScoreViewer SONGS` row.

## Current state (2026-06-24, end of session 2 — see PLUMB-KARPATHY-LOG.md for the gate log)
- **1 of ~20 songs ENGRAVING-COMPLETE + 100% GREEN** (Lida Rose). Others = raw scans in `public/score/page-001..248.jpg`.
- **Lida passes every notation law, both parts** — `node scripts/omr/verify-score-invariants.mjs lida-rose` → "GATE PASS … Safe to lock." Lead 35 bars / 118 notes, Baritone 34 bars / 114 notes.
  - Lead m16/m18 de-tripletized (Audiveris faked a 2/3 triplet; the homophonic voices proved 4 plain quarters). Lead m25 restored to E-natural (normalize had key-flatted a tied E♮ → the cross-pitch tie).
  - Baritone: dead `lida-baritone-source-corrections.mjs` bypassed; corrections now live in `applyLeadMeasureCorrections(... part:'Baritone')`. Inserted Oliver's 3 dropped held bars (9 "shy"=F3, 13 "chime"=Cb4, 21 "name"=Cb4) + completed bar 19's 8-eighth run + **restored 3 bars Audiveris had dropped to SILENCE** (5 "sky"=F3, 25 "hop-ing"=Db4+Bb3, 29 "fine"=Eb3 — moderate reads flagged for visual confirm when the plunk plays them).
- **G4 plunk-from-score GATE → ✅ GREEN (session 3, 2026-06-24).** The sync was rebuilt off the corrected score with **pure-notation timing** (no audio): `verify-plunk-from-score.mjs lida-rose` PASSES all four (Lead/Baritone × `-sync`/`-sync-v2`, 118/114 note-for-note). The plunk now plays the verified score, dead-on, at a constant **99 bpm shared by both parts** (so the duet stays aligned). `verify-score-invariants` + `verify-vt3-plunk-sync` also green. The audio-anchor machinery (`alignScoreToAudio`/`selectConductorAnchors`/`pruneTempoCliffAnchors`/template fetch) is DELETED. Timing core lives in `score-timing.mjs`; tempo is contract golden-truth (`tempoBpm`). See PLUMB-KARPATHY-LOG.md G4 (step 1 BUILD).
- **Open (surfaced by the rebuild, queued for G3):** Baritone `printed-score-audit` FAILs at m9/m18/m31 — `PRINTED_BARITONE_AUDIT_MEASURES` (manifest, last touched 2026-06-23) is STALE vs the session-2-corrected score (2026-06-24). Needs a VISUAL read of pp.197-198 to reconcile; NOT blind-edited (would be self-grading). Timing/plunk/law gates unaffected.
- Octave authority unchanged: the Audiveris source. The 2026-06-24 octave incident remains the reason corrections must never shift octave.

## Remaining steps to the finished product
0. ✅ DONE — Lida → 100% green (both parts) + Oliver no longer silent anywhere. G4 verifier built. G1's critical check resolved: the app plays the plunk from the **sync JSON** (`VocalTrainerIII.tsx:1046` → `plunkNotesRef`), NOT `omrTargets` (that's visual-lane only). The sync is just STALE.
1. ✅ **DONE (session 3) — Sync rebuilt FROM the corrected score, pure-notation timing (THE metronome fix + heart of True North "B").** `build-{lead,baritone}-sync.mjs` + `build-lida-conductor-v2.mjs` rewritten to `start = startBeat × 60/bpm` (no audio); shared core `score-timing.mjs`; tempo = contract `tempoBpm:99` (shared, both parts). `verify-plunk-from-score.mjs lida-rose` GREEN. Recipe was `PLUMB-RESEARCH-SYNTHESIS.md`.
2. **▶ NEXT — Harden the gate (G3):** add the **octave-vs-source invariant** (generated octave == Audiveris source octave; corrections never shift octave — the 2026-06-24 class) AND the **silent-where-singing invariant** (flag a voice resting in a bar where ≥2 homophonic voices sing — the bar 5/25/29 blind spot the gate can't currently see). **ALSO fold in: reconcile the stale Baritone `PRINTED_BARITONE_AUDIT_MEASURES` (m9/m18/m31) against the printed pp.197-198 (visual) — the rebuild surfaced it; do NOT blind-edit.**
3. **Lyrics pipeline (G5):** carry source `<lyric>` → attach to notes → verify present + aligned.
4. **Onboard orchestration (G6):** one command, score → artifacts → gate → register. Prove on **song #2 (Goodnight Ladies)**. Set Audiveris **`Implicit tuplets` ON** before re-OMR (root-fixes the tuplet class at the source — synthesis §2).
5. **End-to-end product gate (G7):** green engraving + plunk==score (verifier green) + lyrics present + artifacts complete = "verified perfect."

## Backups (Jon flagged the corrections were untracked / unrecoverable)
`/c/Users/jonch/omr-backups/20260624-094442-before-baritone-remint/` →
`scripts-omr/` · `musicxml/` (current) · `source-PRIMARY-readonly/` · `experiment-extra/` (the broken octave experiment) · `system-gate-MINE/` (the gate).

## Key files (all committed — session 2 commits 852c53a5 → feat plunk-verifier)
- `scripts/omr/verify-score-invariants.mjs` — the law-gate (notation-law invariants)
- `scripts/omr/verify-plunk-from-score.mjs` — **the G4 gate** (plunk pitches == verified score)
- `scripts/omr/songs/lida-rose.song.mjs` — the declarative contract ("golden truth")
- `scripts/omr/lida-lead-source-corrections.mjs` — ALL corrections (Lead + Baritone live here; the *baritone* file is dead)
- `scripts/omr/_inspect-source.mjs` — homophony dumper (per-part per-bar notes + tick sums); the deterministic cross-check that powered every fix
- `scripts/omr/build-{lead,baritone}-musicxml.mjs` — engraving builds (self-verify vs omrTargets)
- `scripts/omr/build-lead-dataset.mjs` — regenerates `omrTargets.ts` (Lead + Baritone); run it after any correction so the builds' pitch-verify stays consistent
- `scripts/omr/build-{lead,baritone}-sync.mjs` + `build-lida-conductor-v2.mjs` — **the sync builders to rewrite to pure-notation timing (step 1)**
- `scripts/omr/PLUMB-KARPATHY-LOG.md` (gate log G1→G4) · `PLUMB-RESEARCH-SYNTHESIS.md` (the rebuild recipe)

## Hard-won lessons
- OMR can't be perfected — fence it (gate + golden); a song locks only when green.
- The old source-gate graded corrections against themselves; it could not catch a correction's own error. The law-gate can.
- **Octave:** trust the Audiveris source (reads staff position reliably). Corrections must NEVER shift octave.
- A lossy AI sub-agent miscounted the baritone (31 vs 35) and sent the audit sideways — **deterministic code is the floor of truth, not any model** (including the main one). That is the case for Plumb in one sentence.
