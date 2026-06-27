# VocalTrainer III — COMPLETE CAPABILITIES & TRUE NORTH (single source of truth)

*2026-06-27. The full system: what it does, how every part works, how the interface/mixing/library/feedback are organized, the asset model, what is built vs planned. Exhaustive on purpose — for independent (Codex) evaluation. Component: `src/components/PitchDefender/VocalTrainerIII.tsx` (+ `ScoreEngraving.tsx`, `ScoreViewer.tsx`, `extractNotesFromAudio.ts`). Route: `/pitch-defender/vocal-trainer-3`.*

---

## §1 — TRUE NORTH

A **barbershop / a-cappella vocal practice trainer** that takes a singer from "I don't know my part" to "I can sing it with the quartet, in tune, from memory," on a **phone**. First user: **Jon's son, learning Baritone** in *The Music Man*. At scale: **every voice part of every song** — a repertoire trainer the whole quartet uses with no babysitting.

The loop it must make effortless: **hear your part alone → sing it *with* the other 3 voices (your part one ear, the rest the other, your mic live) → see your pitch tracked against the right notes, scrolling the whole song → loop and drill.** Non-negotiable: **what it shows/plays must be correct** (right notes, dead-on timing) — a trainer that teaches wrong notes is worse than none.

---

## §2 — THE DICHOTIC PLAYER (the core engine, how it works today)

Three independent audio streams, each its own buffer → gain → stereo-panner chain into one AudioContext, all fired at the same `ctx.currentTime` so they stay sample-aligned:
- **Track 1 — "Vocals," hard-LEFT (pan −0.7 default).** The part you're learning. Source: `vocalBufRef`. Loaded by `loadTemplateAudio(url)` (a library item's `audioUrl`) or `loadQuickFile` (a dropped file).
- **Track 2 — "Music," CENTER (pan 0).** The backing / another voice. Source: `musicBufRef`. Loaded by `loadMusicFile(file)` (drop) **or `loadMusicFromUrl(url)` — picks any library item** (the fix that made Track 2 useful).
- **Mic — live voice, hard-RIGHT (pan +1).** Your singing, captured live, fed to the feedback meter.

**Why dichotic:** your reference part in one ear, the rest of the quartet in the other, your own voice on the right — the brain separates them and you learn to hold your line against the others.

**Per-stream mixing desk:** each stream has **volume 0–400%** (starts hot — 150% — because stems are quieter than masters) and **pan −1…+1** and a **live level meter**. Plus a **plunk** stream (below). Mic has a **profile** (usb/etc.) and echo-suppression.

**Transport:** Play / Pause / Stop / Resume. `startAudioSource` fires both buffers in lockstep from the current offset; `pausePlayback` snapshots the offset; `stopPlayback` resets to 0. A **seek bar** (click + drag to scrub anywhere, idle/paused/playing). State machine: `idle | playing | paused`.

**Loops:**
- **A/B loop** — mark A and B at the playhead; when the playhead crosses B it jumps back to A and keeps going (YouTube-style). Clearable; phrase-snap.
- **Full-song loop ("↻ Song")** — restarts from 0 at the end instead of stopping. *(shipped this session)*

**Take history / coaching:** every run saves a take summary (`ended` / `stopped` / phrase); coach stats reset per run; phrase markers + practice phrases drive A/B and the "where you are" highlight.

---

## §3 — THE PLUNK (synthesized reference tones)

A scheduler (`startPlunkScheduler` → `schedulePlunkWindow`, look-ahead windowed, ~interval-driven) plays a clean tone per note so you hear the **target pitches** dead-on, independent of any recording. Notes come from the score sync (for Lida Rose) or the template. Has its own **gain (volume %)** and **on/off** (default ON this session — you load a part to hear it). Tones are `midiToFreq(pitchMidi)` aligned to the score timeline.

---

## §4 — FEEDBACK (how the singer sees they're right)

- **Pitchforks v1 meter — the ONLY mic-feedback meter (canon, never replace).** A slider bar: a **white reference bar** = the target pitch, a **cyan dot** = your live voice, a glowing trail + connector. No numbers, no arrows, no rings. Drives off live pitch detection (FFT 2048 to resolve low barbershop/bass notes ~80Hz).
- **The Tracker (the scrolling piano-roll — currently mis-named "Note editor," must be renamed).** Horizontal piano-roll: extracted notes as bars by pitch×time, the **live pitch trace overlaid** (white target bar + cyan voice dot + trail + connector), the **active note highlighted** as the playhead passes, **auto-scrolls** to follow the playhead. (Width must span the **audio** length so it scrolls the whole song — fixed this session.) Click-to-delete cleans stray notes.
- **Engraved-score cursor.** In the Engraved view, OSMD draws the staff and **colors the active notehead amber** + advances its native cursor with `practiceTime`. (By deliberate design today it does NOT plot the live pitch onto the staff — the "coordinate trap"; the live trace lives on the piano-roll.)

---

## §5 — THE LIBRARY (how songs/parts are organized & stored)

- **Storage:** Vercel Blob. `POST /api/vocal-trainer/upload` (audio + a `template` JSON), `PUT` to rename/update, `GET /api/vocal-trainer/library` returns `{ id, title, audioUrl, notes, tempo, noteCount }[]`.
- **Naming convention (load-bearing):** `"<Part> - <Song> - <Mix>"` — the UI **parses the title** to derive part, song, mix, and a mode (`learn` if "Dominant", `sing-in` if "No <part>", else other). Break the convention → it falls into "Other."
- **Grouping & layout:** grouped by **Voice part** (or song); each group is a collapsible `<details>`; **playable items (have a melody) sort to the top**; decoy "no melody yet" items sink. Collapsed-compact by default (no auto-open). A **filter** box + item count.
- **Per item:** title, ★, note-count or "no melody yet", date, **select to load**, **extract / re-extract** button, **extract-all** for a group.
- **Extraction (in-browser):** drop or pick audio → **`@spotify/basic-pitch`** decodes to mono 22050Hz, runs the model, `outputToNotesPoly` → notes + a **264-bin pitch contour**, clamps to vocal range, melody-filters, saves a template (`notes: RawNote[] {pitchMidi,startTimeSeconds,durationSeconds,amplitude}`). (We now ALSO extract **server-side** from isolated audio — §7.)

---

## §6 — SCORE VIEWS

- **Engraved view** — OSMD renders the part's MusicXML staff (e.g. Lida Rose Baritone), with the active-notehead highlight + cursor synced to `practiceTime`.
- **Pages view (`ScoreViewer`)** — the real printed score as page images (`/score/page-NNN.jpg`, all 248 book pages exist). **Jump-to-song dropdown**, page number input, **swipe left/right to turn pages**, **always-visible ‹ › overlay arrows** (stay put while you scroll to read), **bigger mobile viewport**, zoom (fit-width / natural). **Defaults to the selected song's pages** when you pick a song *(shipped this session)*.

---

## §7 — THE ASSET MODEL & THE AUDIO→NOTE PIPELINE (how we get correct notes)

For **each song × each voice** (Tenor, Lead, Baritone, Bass [+ Marian]): an **`<Part>.mp3`** stereo file with **that part isolated LEFT, the quartet RIGHT** (a built-in headphone dichotic = "Original"); a **`<Part> Minus.mp3`** (quartet without that part = the sing-along backing); a **`Demo.mp3`** (full mix); and a per-song **score PDF**.

**Two ground truths, different:** **audio = truth for the performed notes/timing** (extract from the isolated part); **score/PDF = truth for notation** (staff, spelling, measures).

**Server-side extraction (the reliable note source):** `<Part>.mp3` → ffmpeg decode **LEFT channel only** @22050 mono (isolating the part; downmixing both channels pollutes it with the other voices — the bug that made it jump) → `@spotify/basic-pitch` (tfjs-cpu) → **continuity mono-tracker** (pick the loudest fundamental, penalize octave jumps, median-smooth, octave-correct, hysteresis on held notes) → a clean single-voice line → upload as a library item with notes. Scripts: `extract-vocal-notes.mjs`, `mono-track-notes.mjs`, `clean-extracted-notes.mjs`.

---

## §8 — INTERFACE LAYOUT (how the screen is organized)

Vertical, phone-first, sectioned (`order-N`): **header** → **"How to practice" guide** → **Library** → **Upload + Extract** → **Score view (Engraved / Pages toggle)** → **Tracker (piano-roll)** → **Dichotic Player / mixing desk** (currently the transport sits at the bottom). Sections are collapsible. *(Planned: movable orb-style transport + draggable section containers — §10.)*

---

## §9 — CURRENT STATE (built & live, honest)

- All 4 songs' **Baritone in the library** with clean left-channel notes: Lida Rose [313], Sincere [100], It's You [80], Goodnight Ladies [70]. Labeled **"BARITONE ONLY (isolated · left ear)"**, **"Original (stereo)"**, **"No Baritone"** backings.
- All 5 **Lida Rose voices** isolated (Baritone + Tenor/Lead/Bass/Marian).
- **Track 2 picks from the library** (dichotic backing). **Full-song loop.** **Tracker scrolls the full audio.** **Library closed by default.** **Pages view defaults to the selected song.** Score viewer swipe + arrows + big viewport.
- Mixing desk (per-stream vol/pan/meters), plunk, Pitchforks v1 mic feedback, A/B loop, seek, take history — all pre-existing and intact.

---

## §10 — ROADMAP (planned, prioritized — how it becomes "done")

1. **Multi-track mixer engine** — the 3 fixed channels → an **N-track array**, each track **loadable from the library** (any voice part), each with **volume / pan / solo / mute**, add/remove, all on one synced transport + loop. The mic is its own track. *(Build worktree-isolated; never regress the working player.)*
2. **Per-track note overlay, opacity = that track's fader level** — stacked voices' notes overlay dimmed to their mix volume; the loud/active part highlighted, quiet ones recede.
3. **Rename "Note editor" → Tracker**; (decision pending) optional live pitch feedback drawn on the score.
4. **PDF timing slider** across the page showing where you should be; (stretch) **voice-feedback overlaid on the PDF** (hard: needs a time→page/measure coordinate map; do last).
5. **Movable orb-style player controls** (like the Woden orb) + **draggable section containers.**
6. **Note-quality v2** — a true monophonic tracker (CREPE/pYIN) for even cleaner lines; set `durationSec` on templates.
7. **Scale the asset pipeline** — every part of every song (isolated + minus + original) uploaded, batched.
8. **(Parallel, separate) Engraving correctness ("PLUMB")** — the score-truth staff; OMR drops notes, so verification must equal the printed page with a human as final court. Does NOT block the audio-driven trainer.

---

## §11 — PRINCIPLES / GUARDRAILS

- **Correctness over polish** — wrong notes teach wrong; audio = note-truth, score = notation-truth, a human is the final court on the engraving.
- **Never strip working features** — the player your son uses keeps working through every change (worktree-isolate risky refactors).
- **Phone-first, verify live** — build → deploy → look on the phone; never localhost; deploy by `git push origin master` only (never the `vercel` CLI).
- **Pitchforks v1 is the only mic meter.** Title convention is load-bearing. Each step proven against the real artifact (notes match the audio; loop loops; tracker scrolls the whole song).
