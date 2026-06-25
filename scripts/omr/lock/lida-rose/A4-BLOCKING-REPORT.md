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
- Lead "name"=**Cb4** is now **independently corroborated** (printed-manifest) → a Baritone Cb4 would be a unison with Lead (natural barbershop). So the engraving's Cb4 is harmonically supported; just confirm it's Cb4 not Ab3. Crop: `crops/bari-m21-tight.png`. *(lower priority)*

## 5. m29 "fine" — row 212 — engraving says **Eb3** — wide scatter
- Claude ≈ mid-staff (D3/Eb3); Argus = **Cb4** (ledger above staff). Cadential **fermata** note. Restored-from-silence.
- Lead "fine"=**Eb4** is now **independently corroborated** (printed-manifest) → the engraving's Baritone Eb3 = the octave-double of Lead (classic barbershop cadence), so it's harmonically natural. Crop: `crops/bari-m29-tight.png`.
- **Question:** confirm the "fine" fermata note is Eb3 (octave under the confirmed Lead Eb4). *(Argus's Cb4 read is the scatter to resolve.)*

---

## How to clear them
1. Read each on the page (`public/score/page-196..198.jpg`, or the crops).
2. For each row: engraving RIGHT → verdict `match`; WRONG → tell me the page pitch/rhythm, I fix it in `lida-lead-source-corrections.mjs` (NEVER the source xml) → rebuild → re-freeze → re-diff.
3. Clearing these 5 takes BLOCKING to 0 — but the lock also needs **the remaining 227 rows to carry final verdicts** (they currently rest on Audiveris's single read, `stratified-sample.json`) **and** your `MANIFEST.signoff.jon`. Both, then `verify-packet-ready.mjs` flips **ENGRAVING-LOCK GREEN**.

## ✓ Measure-numbering — now LOCKED (was the #1 silent-offset risk; resolved this run)
The cross-check exposed four conflicting numberings (engraving / raw source / printed-manifest / lock-packet PAGE_MAP). I built the authoritative map (`measure-map.json`, replayed from the build): **page-196 = eng m1–9, page-197 = eng m10–21, page-198 = eng m22–34** — which CONFIRMS the page labels for all 5 rows above (no offset). I then reconciled BOTH independent printed page-reads (`lida-baritone-printed-manifest.mjs` + `lida-lead-printed-manifest.mjs`) onto it by MIDI: **all 12 audit points AGREE with the engraving** (Lead eng m9/13/14/15/21/29/34/35 + Baritone eng m4/10/20/34). The baritone "m9/m18/m31 FAILs" were numbering+spelling artifacts, not errors. Consequences for you: (a) **the 5 rows above are the complete BLOCKING set** — no hidden suspects; (b) 12 bars now carry independent human-read corroboration (not just Audiveris); (c) **harmonic context narrows the 5:** the Lead held notes at "shy"(Cb4), "name"(Cb4), "fine"(Eb4) are independently confirmed — so the questions below are about the lower Baritone voice *under a known Lead note*. (Loose end, not yours: `build-baritone-score-health.mjs` still prints 3 false FAILs until migrated to the new map — a named code fix; the engraving is fine.)

Full triage of all 232 rows: `triage-layer2.json`. Both-eye reads: `vision-reads.json`. Raw-agreement status: `stratified-sample.json`.
