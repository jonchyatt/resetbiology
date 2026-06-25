# LIDA ROSE — A4 COURT READ (engraving lock sign-off)

> **Status (FLW-ruled, bw7ac7zmr + b1v3xw927):** Layer-2 triage is COMPLETE. This is NOT "A2 done" and clearing the 5 below does NOT by itself flip the lock green. **ENGRAVING-LOCK stays mechanically RED until BOTH (a) the ledger-completion path is satisfied — every one of the 232 rows carries a final verdict, not just the 5 — AND (b) you sign `MANIFEST.signoff.jon`.** The 5 below are the rows where machine evidence is exhausted; the other 227 rest on Audiveris's single OMR read (see `stratified-sample.json`) and still need their verdicts before lock.

**You are the court of record.** Automated layers narrowed the engraving's 232 notes to **5 Baritone rows** machine vision cannot adjudicate (the two eyes scatter). They are anchored by **lyric word** (the unambiguous page landmark), not by measure number — see the numbering caveat at the bottom. Each crop was verified to show the correct lyric word.

**How we got to 5 (no theater):**
- Layer 1 (deterministic, `build-corrections-diff.mjs`): diffed the RAW Audiveris read vs the shipped engraving → 232 → 19 intervention rows. No vision.
- Triage (`build-triage-layer2.mjs`): 232 → 209 raw-agreement · 8 deterministic (key-normalization / homophony rhythm) · 10 intervention (cadence holds, contract-named) · **5 page-read suspects**.
- Two independent eyes (Claude + Argus/Gemini), BLIND, on tight per-measure crops of the FROZEN page → only the 5 below stay uncertain. All 5 are **Baritone (OLIVER)** phrase bars Audiveris had dropped or under-read.

> Vision is corroboration only. Where the two eyes AGREE against the engraving (m9, m25) the engraving is a real suspect. Where they SCATTER (m5, m21, m29) it's genuinely unreadable by machine. Either way → your call.

Crops: `scripts/omr/lock/lida-rose/crops/bari-mNN-tight.png` (bass clef, 6 flats, 4× upscaled, from the frozen page).

---

## 1. m9 "shy" — row 140 — engraving says **F3** — ⚠ TOP PRIORITY (likely WRONG)
- **Both eyes read it LOW:** Claude ≈ below F3 (G2–B2); Argus = **Eb2** (ledger line *below* the staff). The engraving's F3 is the **4th line** — both eyes put the page note far lower.
- Lead sings **Cb4** here. Crop: `crops/bari-m09-tight.png`.
- **Question:** On the page, where does the "shy" whole note sit — on the 4th line (F3), or low/below the staff? If low, the engraving F3 is wrong and needs the page pitch.

## 2. m25 "hop-ing" — row 200 — engraving says **Db4 + Bb3 (two HALF notes)** — PITCH suspect (rhythm OK)
- This bar was **reconstructed from silence** (Audiveris dropped it to a rest), so its PITCH is a reconstruction. Claude: pitch unclear; Argus scattered.
- **Rhythm is corroborated, NOT suspect:** the homophonic **Lead m25 is also two half-notes** (E♮4 + Eb4), and Lead's rhythm came from Audiveris's real page-read (only Lead's *pitch* was corrected). Argus's "quarters" flag is likely a mis-segmentation (it placed the whole-notes on "same", the wrong bar). So treat the two-halves as fine; only the **pitches** need you.
- Crop: `crops/bari-m25-tight.png`.
- **Question:** what are the "hop" and "ing" pitches on the page? (engraving guesses Db4 + Bb3; "ing"=Bb3 row 201 is the high-confidence Eb-triad completion, "hop"=Db4 is the reconstruction to confirm.)

## 3. m5 "sky" — row 123 — engraving says **F3** — scatter
- Claude ≈ F3 (high on staff); Argus = **Ab3** (top line). Eyes agree it's HIGH but differ on the exact line. Also restored-from-silence.
- Lead sings **Cb4** here (same Lead pitch as m9 "shy"). Crop: `crops/bari-m05-tight.png`.
- **Question:** Is "sky" F3, Ab3, or other? **Cross-check m5 vs m9:** the engraving claims F3 for BOTH, but m5 reads high and m9 reads low — are they really the same pitch?

## 4. m21 "name" — row 182 — engraving says **Cb4** — flat confirmed, line uncertain
- Both eyes SEE an **editorial "(♭)" parenthetical flat** drawn before the note (the page confirms a flatted pitch). They differ on line: Claude Cb4, Argus Ab3.
- Lead sings **Cb4** here. Crop: `crops/bari-m21-tight.png`.
- **Question:** Is the flatted "name" note Cb4 (unison with Lead) or Ab3?

## 5. m29 "fine" — row 212 — engraving says **Eb3** — wide scatter
- Claude ≈ mid-staff (D3/Eb3); Argus = **Cb4** (ledger above staff). Cadential **fermata** note. Restored-from-silence.
- Lead holds **Eb4** here (engraving's Eb3 = octave below Lead). Crop: `crops/bari-m29-tight.png`.
- **Question:** Is the "fine" fermata note Eb3 (octave under Lead), Cb4, or other?

---

## How to clear them
1. Read each on the page (`public/score/page-196..198.jpg`, or the crops).
2. For each row: engraving RIGHT → verdict `match`; WRONG → tell me the page pitch/rhythm, I fix it in `lida-lead-source-corrections.mjs` (NEVER the source xml) → rebuild → re-freeze → re-diff.
3. Clearing these 5 takes BLOCKING to 0 — but the lock also needs **the remaining 227 rows to carry final verdicts** (they currently rest on Audiveris's single read, `stratified-sample.json`) **and** your `MANIFEST.signoff.jon`. Both, then `verify-packet-ready.mjs` flips **ENGRAVING-LOCK GREEN**.

## ⚠ Open finding — measure-numbering is NOT yet locked (the next deterministic step)
The cross-check exposed **four conflicting measure numberings**: the engraving (1–34, inserts absorbed), the raw source (32 bars, no inserts), the printed-manifest (`lida-baritone-printed-manifest.mjs`, pre-insert numbering), and the lock-packet `PAGE_MAP` (a coarse guess). Consequence: the baritone `printed-score-audit` "FAILs" at m9/m18/m31 are **likely numbering artifacts, not engraving errors** — so I did NOT act on them (acting on a mis-aligned signal is the silent-offset trap). The 5 rows above are safe from this because they are **lyric-anchored** (each crop verified to show the right word) and their page labels check out. **Named next step (Codex HIGH): build one authoritative `engraving-measure → page → source-bar → lyric` map, then reconcile the printed-manifest onto it** to turn it into a real independent cross-check for the 227 raw-agreement rows.

Full triage of all 232 rows: `triage-layer2.json`. Both-eye reads: `vision-reads.json`. Raw-agreement status: `stratified-sample.json`.
