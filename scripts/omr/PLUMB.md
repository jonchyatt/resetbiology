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

## Current state (2026-06-24)
- **1 of ~20 songs BUILT** (Lida Rose). Others = raw scans in `public/score/page-001..248.jpg`.
- **Lida = octave-correct reference** (baritone reverted from a broken same-day octave experiment to known-good commit `1e86b846`), **but NOT 100% green** — gate flags 5 real gaps:
  - Lead **m16, m18** — 3-beat bars (Audiveris under-read the tuplet) `[I1]`
  - Lead **m25** — E♮(64)→E♭(63) cross-pitch tie `[I2]`
  - Baritone — **missing held bars 9 / 13 / 21** (Oliver's shy/chime/name holds) `[I4]`
  - Baritone **m17** — 42-tick bar `[I1]`

## Remaining steps to the finished product
1. **Lida → 100% green:** print-pin the 2 Lead tuplet rhythms + the m24/25 tie pitch; insert Baritone's 3 held bars **at octave 3-4** + fix m17. Each print-verified; gate proves green.
2. **Add the octave-vs-source invariant** (kills the 2026-06-24 class for every song).
3. **Plunk-from-score verifier (the core of B):** assert the plunk/sync pitches == the verified MusicXML note-for-note, timing derived purely from score rhythm, dead-on. **CRITICAL CHECK FIRST:** confirm the *app* plays the plunk from the verified MusicXML/sync — NOT from the stale `omrTargets.ts` (whose own build comment calls it "OLD hallucinated OMR pitches"). If the live plunk is reading `omrTargets`, that is *why it never felt score-driven* despite the engraving work — the engraving and the plunk source were disconnected.
4. **Lyrics pipeline** (C): carry source `<lyric>` → attach → verify.
5. **Onboard orchestration** (D): one command, score → artifacts → gate → register. Prove on **song #2 (Goodnight Ladies)**.
6. **End-to-end product gate:** green engraving + plunk==score + lyrics present + artifacts complete = "verified perfect."

## Backups (Jon flagged the corrections were untracked / unrecoverable)
`/c/Users/jonch/omr-backups/20260624-094442-before-baritone-remint/` →
`scripts-omr/` · `musicxml/` (current) · `source-PRIMARY-readonly/` · `experiment-extra/` (the broken octave experiment) · `system-gate-MINE/` (the gate).

## Files I built today (currently UNTRACKED — commit to protect)
- `scripts/omr/verify-score-invariants.mjs` (the gate)
- `scripts/omr/songs/lida-rose.song.mjs` (the contract)
- `scripts/omr/run-lida-score-pipeline.mjs` (wired the gate into pipeline phase 2)

## Hard-won lessons
- OMR can't be perfected — fence it (gate + golden); a song locks only when green.
- The old source-gate graded corrections against themselves; it could not catch a correction's own error. The law-gate can.
- **Octave:** trust the Audiveris source (reads staff position reliably). Corrections must NEVER shift octave.
- A lossy AI sub-agent miscounted the baritone (31 vs 35) and sent the audit sideways — **deterministic code is the floor of truth, not any model** (including the main one). That is the case for Plumb in one sentence.
