# OMR score-target lane — VocalTrainer III

Turns the **real notated notes** of a Music Man vocal part (read straight off the
sheet music) into a discrete pitch-target lane on the VocalTrainer III piano roll,
so Jon's sons can sing toward the authoritative score pitch — and so the score
notes double-check (and ultimately replace) the audio-extracted pitch.

This is the "double-verify" half of the build: the audio extraction (Spotify
BasicPitch) is a noisy estimate; the OMR notes are the clean authority.

## What's here

| File | What it is |
|---|---|
| `source/lida-196.xml`, `197`, `198` | Audiveris 5.10.2 MusicXML exports of *Lida Rose*, pp.196-198 of `The Music Man - Complete.pdf` (300 dpi page renders). PRIMARY SOURCE — keep. |
| `build-lead-dataset.mjs` | Generator: parses the Lead voice out of those exports, emits `src/components/PitchDefender/omrTargets.ts`. |

## How the Lead is identified

Lida Rose is TTBB barbershop. Each page exports 4-5 parts (p196 also has Harold's
solo intro). The **Lead** (the melody, sung by Ewart) is the **lower of the two
treble-8 (`G2_8`) staves** — Tenor is the upper one; Baritone/Bass are bass-clef.
Verified mapping: **196 → P3, 197 → P2, 198 → P2**, melodic range **Db3-E4** on
every page (no part-tracking drift, no octave-shift artifacts).

## Verification (2026-06-20)

Against the live 217-note audio extraction `Lead - Lida Rose - Lead Dominant`:

- **Octave:** audio median **B3** (MIDI 59) vs OMR median **Bb3** (58) — same octave
  band, **no transpose** applied. (Off-by-octave would have read B2 or B4.)
- **Part identity:** pitch-class cosine similarity **0.933** — same note distribution.
- **Melody:** collapsed-line DTW mean **1.77 semitones**. Moderate, as expected —
  BasicPitch over-segments the recording (102 vs 165 distinct-pitch transitions) and
  Marian's counter-melody bleeds into the lead-boosted mix. The OMR is the clean
  reference; the audio is the noisy one.
- p196 P3 matches the earlier triple-verified (Audiveris + Codex + Argus) data exactly.

## Regenerate

```bash
node scripts/omr/build-lead-dataset.mjs
```

Re-reads `source/*.xml`, re-runs the audio cross-check (skipped if offline), rewrites
`omrTargets.ts`. Deterministic from the committed sources.

## Lida Rose VT3 score-first pipeline

Use this before trusting a new engraving, plunk lane, or highlight map:

```bash
node scripts/omr/run-lida-score-pipeline.mjs
```

Fast no-write gate:

```bash
node scripts/omr/run-lida-score-pipeline.mjs --verify-only
```

Pipeline order is intentional:

1. Generate Lead and Baritone single-part MusicXML from the corrected page-source MusicXML.
2. Run `verify-lida-score-source-gate.mjs`, which compares generated MusicXML back to the corrected source by measure: key signatures, note count, measure durations, whole notes, ties, clefs, accidentals, and printed audit measures.
3. Only after the source gate passes, rebuild score-conductor timing, score-health, note maps, and `Conductor v2`.
4. Verify engraving, conductor-v2, plunk sync, and UI wiring.

Audio extraction is timing evidence only. Pitches and rhythms come from the corrected score. Noisy timing anchors must be pruned or rejected before plunk/highlight artifacts are trusted.

## Phase status

- **Phase 1 (this):** discrete score-sequence lane, laid on the score's own rhythm and
  scaled to the recording's span for visual comparison. **NOT** sample-synced to playback.
- **Phase 2 (later, Jon's staged choice):** real-time score-beat → audio-timeline sync.

## Extend to more pages / songs / parts

1. Render the page(s): `pdftoppm -r 300 -f <pg> -l <pg> -png "The Music Man - Complete.pdf" out`
   (other barbershop songs: Goodnight Ladies p100, Ice Cream/Sincere p89, Wells Fargo p143).
2. OMR: `Audiveris.exe -batch -export -output <dir> -- <page>.png` → unzip the `.mxl`.
3. Drop the inner `.xml` into `source/`, add a `{ pg, path, lead }` row in the generator
   (identify the Lead = lower treble-8 staff, Db3-E4 range), regenerate.
