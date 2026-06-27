# VocalTrainer — TRUE NORTH VISION (single source of truth, 2026-06-27)

*For independent evaluation. This is the complete intended product, the asset model, the architecture, what is built, and what remains. Written to be judged against — if a claim isn't here, it isn't a goal.*

---

## §1 — THE TRUE NORTH (why this exists)

A **barbershop / a-cappella vocal practice trainer** that takes a singer from "I don't know my part" to "I can sing my part with the quartet, in tune, from memory." The first user is **Jon's son, learning the Baritone part** of *The Music Man* barbershop numbers, on a **phone**. At scale it is **every voice part of every song** in the book — a repertoire trainer the whole quartet (and any future singer) can use without anyone babysitting it.

The practice loop the product must make effortless:
1. **Hear your part alone** (the isolated reference).
2. **Sing your part *with* the other three voices** (the quartet minus you) — your part in one ear, the rest in the other, your live mic blended.
3. **See your pitch tracked in real time** against the correct notes / the score, scrolling the whole song.
4. **Loop the whole song** (or any A/B section) and drill until it's locked.

**The non-negotiable:** what the trainer shows and plays must be **correct** — the right notes, dead-on timing — because a trainer that teaches the wrong notes is worse than none. (This is why the note source matters; see §3.)

---

## §2 — THE ASSET MODEL (what we have to build from)

For **each song**, for **each of the 4 voices** (Tenor, Lead, Baritone, Bass — plus "Marian"/melody where it applies), the studio provides:
- **`<Part>.mp3`** — a **stereo** mix with **that part isolated on the LEFT channel, the rest of the quartet on the RIGHT** (quieter). This is itself a built-in headphone dichotic ("Original").
- **`<Part> Minus.mp3`** — the full quartet **without** that part (the proper sing-along backing).
- **`Demo.mp3`** — the full mix (all voices), the reference.
- **Per-song score PDF** (e.g. Lida Rose pp.193-203) + the 248-page book already rendered to per-page images.

Two ground truths, and they are different:
- **Audio is ground truth for the *performed notes and timing*** — extract the melody from the isolated part audio. (This sidesteps the OMR failure mode where a score reader drops or mangles notes.)
- **Score/PDF is ground truth for *notation*** — staff, spelling, measures, where things sit visually.

Files staged: 4 songs (Lida Rose, Sincere, It's You, Goodnight Ladies), all parts, in Drive + `data/studio-baritone/` + `data/studio-zips/`.

---

## §3 — THE PRODUCT (every feature, organized)

### A. Library (the song/part catalog)
- Every **part of every song** is a loadable item: **Isolated** (the part alone, from the left channel), **Minus/No-<Part>** (the backing), **Original** (the stereo headphone-dichotic mix). Clearly labeled so a kid knows which is which.
- Grouped by voice part (or song); playable items first; collapsed-compact by default (no auto-open).

### B. Note extraction (audio → the trainer's notes)
- From the **isolated part audio** (left channel only, clean & monophonic), extract a **clean single-voice line** — pitch + timing — to drive the plunk reference tones and the pitch tracker. Must be a real line, not over-segmented garbage (no octave jumps, no semitone wobble). Monophonic-appropriate (loudest fundamental / a true mono tracker), not polyphonic over-detection.

### C. The multi-track mixer (the heart of the practice tool)
- **N tracks, each loadable from the same library** — stack Baritone + Lead + Tenor + Bass (or any subset) — not two hardwired channels.
- Per track: **volume, pan, solo, mute**, add/remove. All tracks start/stop/seek/**loop in perfect sync**. The live **mic** is its own track (Pitchforks v1 meter = the only feedback meter).
- **Dichotic by design:** your part one ear, the quartet the other, mic live.
- **Note display opacity = each track's fader level** — when you stack voices, each voice's notes overlay dimmed to its mix volume, so the loud/active part is highlighted and the quiet ones recede.

### D. Playback / transport
- **Full-song loop** (not just A/B) + the existing A/B loop.
- **Movable, drag-drop player controls** (orb-style, like the Woden app's orb) — always reachable, not pinned to the bottom requiring a scroll.
- Seek bar, play/pause/stop, per-stream mixing desk.

### E. The pitch tracker (currently mis-named "note editor")
- A **tracking device**, not an editor — rename it. It shows the **live pitch trace vs the correct notes**, scrolling the whole song (must scroll for the full audio length, not freeze when the recording is longer than the notes).

### F. The score view
- The **per-song PDF cut**, and when you **choose a song it defaults to that song's pages** (don't dump the 248-page book and make the user navigate).
- Phone-usable: **swipe to turn pages**, always-visible page arrows, big viewport (shipped).
- A **timing slider across the PDF** showing where you should be in the song.
- (Stretch) **live voice-feedback overlaid on the PDF / score** — PDF underneath, pitch feedback on top. (Hard: needs a stable time→page/measure coordinate map; do last.)

### G. Engraving (the staff notation — separate, harder track)
- A truly correct engraved staff for each part comes from the **score**, not the audio. This is the "PLUMB" problem (OMR drops notes; verification must equal the printed page). It is a parallel effort; the audio-driven trainer above does **not** block on it.

### H. Platform
- **Phone-first.** Verify every change on the live hosted page at phone size. Never localhost.

---

## §4 — ARCHITECTURE

- **Audio pipeline:** `<Part>.mp3` → ffmpeg decode **left channel only** @ 22050Hz mono → `@spotify/basic-pitch` (tfjs-cpu, server-side) → continuity/mono post-processing → notes JSON → upload to library (template `notes: RawNote[]`, audio to Vercel Blob).
- **Library:** Vercel Blob (`/api/vocal-trainer/upload` POST/PUT, `/library` GET). Items = `{title, audioUrl, notes, tempo}`.
- **Player:** `VocalTrainerIII.tsx` — currently three fixed buffer→gain→pan chains (Vocals-L / Music-C / Mic-R); **target = an N-track array** with synced transport. `ScoreEngraving.tsx` (OSMD) renders the staff; the piano-roll/tracker renders notes + the live trace.
- **Score view:** `ScoreViewer.tsx` over `public/score/page-NNN.jpg` (248 pages exist).
- **Deploy:** `git push origin master` only (Vercel). Never the `vercel` CLI.

---

## §5 — CURRENT STATE (what is live / built, honestly)

**Live & working:**
- All 4 songs' **Baritone in the library** with clean left-channel-extracted notes: Lida Rose [313], Sincere [100], It's You [80], Goodnight Ladies [70]. Labeled **"BARITONE ONLY (isolated · left ear)"**, **"Original (stereo)"**, and **"No Baritone"** backings.
- All 5 **Lida Rose voices** isolated in the library (Baritone + Tenor/Lead/Bass/Marian).
- **Track 2 picks from the library** (the dichotic backing) — the "Track 1/2 only linked Drive files" gap is fixed.
- **Full-song loop** ("↻ Song").
- **Tracker scroll fix** — sizes to the audio length so it no longer freezes partway when the recording is longer than the notes.
- Library **collapsed/compact by default** (auto-open reverted per Jon).
- Score viewer: swipe + always-visible arrows + bigger mobile viewport (shipped earlier).

**Built but partial / needs work:**
- Note extraction quality is *good* on the isolated audio but not perfect (some warble) — a true monophonic tracker (CREPE/pYIN) would tighten it.

**Not built yet (the real roadmap, §6).**

---

## §6 — ROADMAP (prioritized, what "done" needs)

1. **Multi-track mixer engine** — the 3 fixed channels → N library-loadable tracks with synced transport + per-track vol/pan/solo/mute + add/remove. *(Build in an isolated worktree; must not regress the working dichotic player.)*
2. **Per-track note overlay with opacity = fader level.**
3. **Rename "note editor" → tracker**; restore/clarify pitch-on-score feedback.
4. **Score view defaults to the selected song's pages** + the **timing slider**.
5. **Movable orb-style player controls** + **draggable part containers.**
6. **Note-quality v2** — monophonic tracker (CREPE) for cleaner lines; set `durationSec` on templates.
7. **Scale the asset pipeline** — every part of every song uploaded (isolated + minus + original), batched.
8. **(Parallel, separate) Engraving correctness (PLUMB)** — the score-truth staff.

---

## §7 — PRINCIPLES / GUARDRAILS

- **Correctness over polish** — wrong notes teach wrong; the audio is the note-truth, the score is the notation-truth, and a human (Jon) is the final court on the engraving.
- **Never strip working features** — the player your son uses must keep working through every change (worktree-isolate risky refactors; verify on the live phone).
- **Phone-first, verify live** — build → deploy → look on the phone, never localhost.
- **Each step proven against the real artifact** — the notes match the audio; the loop actually loops; the tracker actually scrolls the whole song.
