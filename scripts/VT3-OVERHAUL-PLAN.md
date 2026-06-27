# VocalTrainer III — OVERHAUL (Gorr instance, 2026-06-27)

**TRUE NORTH:** Jon's son (and Jon) practice their barbershop parts on a trainer that is *accurate, playable, full-song-loopable, and usable on a phone* — studio audio in → correct notes + plunk + on-score feedback out.

**THE REFRAME (Jon's insight, correct):** stop reconstructing dropped notes off the SCORE (OMR's weakness). The new assets are **isolated studio-quality part audio** — feed each MP3 through **@spotify/basic-pitch SERVER-SIDE in Node (tfjs-cpu)** = accurate notes. The audio IS the ground truth; no OMR dropped-bar problem. (Old failure was a short/full-mix recording + reading the bitmap; the new isolated full-length tracks extract clean.)

**NEW ASSETS (`data/studio-baritone/`):** isolated Baritone MP3s — Lida Rose (4:10), Sincere (~2:40), It's You (~1:33), Goodnight Ladies (~1:00) — + per-song PDFs (Lida Rose pp193-203, Pick-a-Little/Goodnight pp97-108, Ice Cream/Sincere pp86-89).

## THE 8 ASKS
1. **[FOUNDATION]** 4 studio tracks → in the library, ENGRAVED (real notes), PLAYABLE. *(extraction running)*
2. **Full-song loop** — loop the whole song, not just an A/B segment.
3. **Library-backed Track 1 / Track 2** — the dichotic stems must select from the SAME library we pick songs from (today they only link Drive files = "almost worthless").
4. **Movable drag-drop player controls** — an orb-style floating control (like the Woden orb), not pinned to the bottom requiring scroll.
5. **Draggable part containers** — parts in containers Jon can drag.
6. **PDF timing slider** — a position slider across the PDF showing where you should be.
7. **Voice-feedback overlay on the PDF** — PDF underneath, live pitch feedback on top.
8. **Pitch feedback drawn ON the score** — (he thinks it existed; verify / restore).

## SEQUENCE (value-per-step; revise per FLW)
- **A (foundation, in progress):** Node basic-pitch extract each isolated MP3 → upload to library WITH notes (full playable+engraved items, NOT "no melody yet" decoys). Tool: `scripts/extract-vocal-notes.mjs`.
- **B:** Library-backed Track 1/Track 2 (fixes the "worthless" dichotic selectors) + full-song loop — both are player-core wins.
- **C:** Movable orb player controls + draggable part containers (the UI structural overhaul; ui-specialist + FLW first).
- **D:** PDF page-images for the new songs (from the PDFs) → Sheet Music viewer; then timing slider + pitch overlay on the PDF; restore on-score feedback.

## STATUS
- STUDY: ✅ files downloaded + tooling validated (basic-pitch runs in Node tfjs-cpu).
- PLAN: this doc. FLW + Argus consulting.
- EXECUTE: extraction running (Lida Rose first). Then library upload → B → C → D.

## RULES (Gorr/Mythos)
- Verify every UI change on the LIVE hosted page (phone viewport), never localhost. ui-specialist gate before PitchDefender UI edits. Deploy = `git push origin master` only.
- Each step: real artifact verified (the notes match the audio; the control actually moves; the loop actually loops). No "it works" without proof.
