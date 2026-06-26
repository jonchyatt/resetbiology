# TASK FOR A SUPER-AGENT: recover 5 dropped Baritone bars in a barbershop score (ground-truth = the printed page)

You are a music-OCR + score-engraving expert agent with vision and code execution. Solve a bounded, well-defined problem inside an existing repo. Read this whole brief, then work against the actual files (paths given). **The printed page image is the only ground truth. Do not trust the OMR output, prior AI reads, or "it looks consistent" — verify every pitch against the page.**

---

## TRUE NORTH (why this exists)
We are building a "foundry": raw scanned vocal scores in → **verified-perfect** trainable products out (a flawless engraving + a metronome/"plunk" that plays the verified score + lyrics), at scale, each one locked and trustworthy without a human re-auditing it. The governing rule: **a thing may only be called "verified/locked/correct" after it is checked against the real-world authority (the printed page) — never merely against itself.** "Lida Rose" (from *The Music Man*, 4-part barbershop) is the first proof case. Everything downstream (timing, lyrics, training) rides on the engraving being correct, so the engraving must be right first.

## THE PIPELINE (how the engraving was built)
1. Printed score pages were scanned → `public/score/page-196.jpg`, `page-197.jpg`, `page-198.jpg` (and `page-199.jpg`). These are the **ground truth**.
2. Audiveris (an OMR tool) read each page → `scripts/omr/source/lida-196.xml`, `lida-197.xml`, `lida-198.xml` (MusicXML, one `<part>` per printed staff). **Audiveris is lossy and sometimes wrong or drops notes/bars.**
3. Our build scripts stitch one voice's staff across the 3 pages, normalize the key, apply manual corrections, and emit a single-part engraving:
   - `scripts/omr/build-baritone-musicxml.mjs` → `public/musicxml/lida-rose-baritone.musicxml`
   - `scripts/omr/build-lead-musicxml.mjs` → `public/musicxml/lida-rose-lead.musicxml`
   - Manual corrections live in `scripts/omr/lida-lead-source-corrections.mjs` (handles BOTH Lead and Baritone). **Never edit the source XML or the page JPGs — corrections only go here.**
   - Key normalization: `scripts/omr/lida-lead-key-normalize.mjs` (forces 6 flats / Gb major everywhere).
4. Verification: `scripts/omr/verify-score-invariants.mjs lida-rose` (notation-law checks). An authoritative engraving→page map: `scripts/omr/lock/lida-rose/measure-map.json`.

## THE 4 VOICES (this is the crux of our failures)
The score is 4-part barbershop. Top-to-bottom the voices are **EWART = Tenor/Lead (treble-8vb)**, then **Lead**, then **OLIVER = Baritone (bass clef)**, then **OLIN = Bass (bass clef)**. (Our part of interest is **OLIVER / Baritone**.)
- **The voice labels EWART / OLIVER / OLIN are printed on the PAGE IMAGES only.** In the MusicXML the parts are all anonymous: `<part-name>Voice</part-name>`, instrument "Voice Oohs". So a part can only be matched to a voice by **staff position**, which is exactly where automated tooling keeps going wrong.
- **page-196 has 5 `<part>`s (P1–P5); pages 197 and 198 have 4 (P1–P4).** The current code maps Baritone = `lida-196.xml` part **P4**, `lida-197.xml`/`lida-198.xml` part **P3**. Verify this mapping is correct — a wrong staff mapping would corrupt everything.
- Key: 6 flats (Gb major). Audiveris read the key signature inconsistently (it reported `<fifths>` of −2, −5, −6 on page 196 and +1 on page 198 — almost certainly OCR noise, not a real modulation). We force −6. Confirm 6 flats is right against the page.

## THE SPECIFIC PROBLEM
Audiveris **dropped 5 of OLIVER's (Baritone's) bars entirely** (phrase-end held notes + cadence bars it couldn't read). We **reconstructed those 5 bars by guessing** the pitches from chord logic + a (failed) attempt to read the page. **An expert musician (the score's owner) read the printed page and says all 5 of our reconstructed bars are WRONG.** We need the **true OLIVER pitches (and rhythm) for these 5 bars, read from the printed page**, and a method robust enough to trust.

The 5 bars (engraving measure number · which printed line/system it's in · lyric word · OUR WRONG GUESS):
| # | eng measure | page | printed line (measures) | lyric | OUR GUESS (wrong) |
|---|---|---|---|---|---|
| 1 | m5  | page-196 | line of measures 1–5  | "sky"     | F3 (whole) |
| 2 | m9  | page-196 | line of measures 6–9  | "shy"     | F3 (whole) |
| 3 | m21 | page-197 | line of measures 18–21| "name"    | Cb4 (whole) |
| 4 | m25 | page-198 | line of measures 22–25| "hop-ing" | Db4 + Bb3 (two halves) |
| 5 | m29 | page-198 | line of measures 26–30| "fine"    | Eb3 (whole, fermata) |

Engraving→page map (authoritative, from `measure-map.json`): page-196 = engraving measures 1–9, page-197 = 10–21, page-198 = 22–34/35. The Lead's notes at these bars are confirmed (read by OMR + cross-checked): "sky"/"shy"/"name" the Lead holds **Cb4**, "hop-ing" the Lead has **E♮4→Eb4**, "fine" the Lead holds **Eb4** (fermata cadence).

## WHAT WE TRIED — AND WHY IT FAILED (don't repeat these)
1. **Deterministic OMR-diff** (`scripts/omr/build-corrections-diff.mjs`): diffed raw Audiveris vs our engraving → flagged the 5 reconstructed bars as the high-risk rows. Correct triage, but can't recover the true pitches (the bars are simply absent from the OMR).
2. **AI vision, two independent eyes (Claude + Gemini/"Argus") on cropped staves:** FAILED on **staff identity** — the auto-generated single-staff crops silently landed on the wrong staff (read **OLIN/Bass instead of OLIVER/Baritone** on some systems). Because the Bass line sits low, this produced a false "the note reads low, our F3 is wrong" — an artifact of reading the wrong voice. **This is the #1 trap: any crop/region MUST be label-verified to be the OLIVER staff before reading a pitch from it.**
3. **Full-system labeled crops + Gemini re-read:** Gemini produced detailed-looking transcriptions but they **conflict on basics** — it disagreed with itself on the key signature (claimed 4 flats on one line, 6 flats on others), and on page-197's crop the printed voice labels weren't visible so it couldn't identify OLIVER at all. Not trustworthy.
4. **Codex (text-only reasoning):** confirmed the Baritone **cannot be determined from the Lead alone** in barbershop — you need the other voices (Tenor + Bass) to pin the chord, or the page. Verdict: *"both OMR and AI vision have already failed on staff identity, missing measures, and key-signature consistency — this is a source-of-truth problem, not a better-prompting problem."*
5. **Measure-numbering reconciliation** (`scripts/omr/build-measure-map.mjs` → `measure-map.json`): there are FOUR different measure numberings in play (our engraving 1–34, raw source per-page, two "printed manifests", and a page map). We reconciled them; an independent human-read "printed manifest" agrees with our engraving at 12 non-dropped bars — so the part mapping is probably right and the non-dropped bars are fine. Only these 5 dropped/reconstructed bars are in question.

## WHAT WOULD ACTUALLY SOLVE IT (promising, untried-or-incomplete)
- **The deterministic chord triangulation:** Audiveris DID read the other 3 voices (Tenor, Lead, Bass = OLIN) at these bars — only OLIVER was dropped. For a 4-note close-harmony barbershop chord with 3 voices known, the missing Baritone is usually forced (it supplies the missing chord tone, typically just below the Lead). Extract the Tenor/Lead/Bass pitches at each of the 5 bars from the source XML, identify the chord, and derive the Baritone. **This needs the correct voice→part mapping per page (see the 5-part page-196 caveat).** Then confirm each against the page.
- **Direct page reading with rigorous staff identification:** read the OLIVER staff off `page-196/197/198.jpg`, but ONLY after positively identifying the OLIVER staff (by its printed "(OLIVER)" label on the first system of each page, then tracking staff order downward). State the line/space for every note. Cross-check pitch against the chord triangulation above — accept a pitch only when both agree.

## CONSTRAINTS / RULES
- **Never modify** `scripts/omr/source/*.xml` or `public/score/*.jpg` (immutable evidence). Corrections go only in `scripts/omr/lida-lead-source-corrections.mjs`.
- After any correction: rebuild (`node scripts/omr/build-baritone-musicxml.mjs`), then re-run `node scripts/omr/verify-score-invariants.mjs lida-rose` (must stay green).
- Ground truth is the printed page. A pitch is "verified" only when it matches the page; corroboration from theory/chord-logic is supporting, not sufficient.

## DELIVERABLE
For each of the 5 bars: the **correct OLIVER (Baritone) pitch(es) and rhythm**, with octave (e.g. "m9 'shy' = Gb3 whole"), each justified by (a) what the printed page shows on the OLIVER staff (line/space), and (b) the 4-part chord at that bar. Then the exact edit to `lida-lead-source-corrections.mjs` to apply them. If a bar is genuinely ambiguous from the page, say so rather than guess.

## REPO
`reset-biology-website` (local). Start by opening the 3 page JPGs and the source XMLs above. The OLIVER staff identification is the make-or-break step — get it right first.
