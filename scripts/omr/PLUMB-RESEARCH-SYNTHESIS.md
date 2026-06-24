# PLUMB — build-optimization research synthesis (2026-06-24)

Three parallel research agents swept GitHub / Stack Overflow / Reddit / docs for the "read the sheet music and play it out, dead-on" problem Jon flagged. Every claim below was verified by the agents against the actual repo/source. This is the optimization map for the timing + OMR + gate, feeding G4–G7.

---

## 0. The one fact that explains the "weird metronome"

**MusicXML `<duration>` (in `<divisions>` units) is authoritative for timing and is ALREADY tuplet-adjusted. `<type>` + `<time-modification>` are display-only.** (W3C MusicXML 4.0.) So correct timing = `duration ÷ divisions × secondsPerBeat`, computed straight from the verified score — **no audio, ever**.

Our current `build-lead-sync.mjs` does the opposite: it parses score rhythm, then **DTW-aligns to audio onsets and keeps ~24 "conductor anchors"** from a real rubato recording. *That hybrid is the timing artifact Jon hears.* Every serious engine (music21, OSMD, Verovio, partitura) derives timing purely from notation. **Deleting the audio-anchor path is the metronome fix.**

---

## 1. Timing engine — what to build (G4 + the timing rebuild)

**Recommended: generate the timing map OFFLINE → ship JSON → browser plays it (sample-accurate).** The split is right; our codebase already half-does it. Keep the output shape `{pitchMidi, startTimeSeconds, durationSeconds}[]` so nothing downstream changes.

Ranked generators (all verified pure-notation):
1. **OSMD's own cursor iterator** — *already in our stack (OSMD 1.9.7 in `ScoreEngraving.tsx`)*. `iterator.currentTimeStamp.realValue * 4 * 60/bpm` → seconds; `CurrentVoiceEntries[i]` gives **per-voice isolation** (exactly the Lead-vs-Baritone plunk primitive); follows tuplets/ties/repeats by default. Run it headless at build time (jsdom or a throwaway Hawkeye/Playwright page) and dump JSON. **No new dependency.**
2. **music21** (Python) `part.flatten().stripTies().secondsMap` — most rigorous; `Fraction` math = exact tuplets; piecewise-correct tempo. Gotcha: silently fabricates 120 BPM if no tempo at offset 0 — **assert a tempo exists**.
3. **partitura** (Python) `musicxml_to_notearray` — fast, auto-unfolds repeats; you multiply beats→seconds yourself.
4. **Verovio `renderToTimemap()`** — battle-tested ms stream; best engraving; BYO player.

Browser scheduler: our `schedulePlunkWindow` should be the **Chris Wilson "Tale of Two Clocks"** pattern — a 25 ms lookahead (worker-driven) scheduling notes due before `currentTime + 0.1s`, re-anchored on play/seek. (Tone.js `Transport` is this internally if we ever want it.)

**Tempo trap to encode:** MusicXML often omits `<sound tempo>` → tools default to 120 BPM. The build must assert a real tempo before computing seconds.

---

## 2. OMR — root-cause fix for the tuplet bug (G6 / onboarding, at scale)

**Audiveris has a per-book `Implicit tuplets` setting, OFF by default.** When a bar can't sum to full, it infers a 2/3 ratio on a voice that is exactly 3/2 of the measure — *exactly our "3-beats-not-4" m16/m18/m19 class.* The Moonlight-Sonata handbook calls turning it **ON "absolutely mandatory"** for this kind of score. (Audiveris #279.)

→ **Re-OMR the 6 barbershop + ~14 raw songs with `Implicit tuplets` ON** (book parameter, set before transcription) + harden scans (≥300 dpi, deskew, preserve lyric contrast — dropped whole notes + lyric-occluded triplets are scan-quality failures, Audiveris #119/#196). This would have prevented most of today's hand-corrections at the source.

- **Keep Audiveris + deterministic corrections** — it's the right architecture. Do NOT switch to MuseScore-import (it IS Audiveris underneath, less tunable) or oemer/homr (no tuplet handling, weaker multi-voice).
- **Fallback for pages Audiveris still fails:** PlayScore 2 or Newzik — the only engines independently shown to *infer* triplets — as a second-opinion OMR, not the default. (Scoring Notes OMR landscape review.)

---

## 3. Gate / validation — adopt prior art for "at scale" (G3 + G7)

- **`musicdiff`** (gregchapman-dev, MIT) — purpose-built OMR-evaluation diff over music21 trees; compares *visible notation* (tie vs single note, beaming). Use for **golden-file regression**: once a score is hand-verified, freeze it as reference MusicXML and gate every re-OMR with `diff(..., NotesAndRests|Ties|Voicing|Signatures) == 0`. This is the lowest-effort path to "zero re-audit at scale" — drift is caught deterministically and the typed ops list says *which* symbol regressed.
- **music21 `Measure.barDuration` vs `Measure.duration`** — exactly our I1 bar-completeness law, on a maintained foundation (`barDurationProportion()` returns the filled fraction; 2/3 = an under-read tuplet). `isWellFormedNotation()` as a pre-check.
- **MusicXML XSD** as a cheap syntactic pre-gate. **Skip Schematron** for musical invariants (arithmetic over durations beats XPath).
- **Keep our law-gate** as the *contract* layer — it encodes absolute domain truths (4/4 barbershop, every bar = 4 beats, octave-vs-source) a generic diff can't know without a reference.

**Gate blind spot found today (feeds G3):** the gate passes a bar that is a full-REST when the printed page shows the voice singing (baritone bars 5/25/29). A stronger invariant: flag a voice silent in a bar where ≥2 homophonic voices have notes, or where a per-bar expected-note-count contract says otherwise.

---

## 4. Net recommendation (maps to the gates)

| Gate | Action from research |
|---|---|
| **G3** octave-vs-source invariant | add it; ALSO add the "silent-where-singing" invariant (the baritone 5/25/29 class) |
| **G4** plunk-from-score verifier | assert sync `pitchMidi` == verified MusicXML note-for-note; **rebuild `build-lead-sync.mjs` to pure-notation timing** (delete the ~24 audio anchors) — this is the metronome fix |
| **G6** onboarding (song #2) | re-OMR with Audiveris `Implicit tuplets` ON + scan hygiene → fewer hand-corrections per song |
| **G7** end-to-end product gate | add `musicdiff` golden-file locking so a verified song stays verified at scale |

**Bottom line for Jon:** the apps that "read music and play it out" all derive timing from the notation, never from audio — which is precisely the fix for the metronome, and we already have the engine (OSMD) in the stack to do it. The engraving work we just finished is the prerequisite; the timing rebuild is the next concrete step.
