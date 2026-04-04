# Pitch Defender — Session Handoff 2026-04-03 (Session 3)

## What Was Built (7 commits, all deployed to resetbiology.com)

### Sheet Music Studio — Production Overhaul
Rewrote `SheetMusicViewer.tsx` from spike to production-quality tool:
- **Native dark mode** — OSMD `EngravingRules` colors (background, noteheads, stems, staff lines, titles). CSS `filter:invert` hack eliminated.
- **MusicXML file upload** — drag-and-drop + file picker. Supports `.xml`, `.musicxml`, `.mxl` (compressed).
- **Part isolation** — toggle individual voices on/off via `Instrument.Visible`. Score re-renders with layout recalculation. Tested: hiding Tenor shows only Soprano/Alto/Bass.
- **Cursor/playback** — OSMD cursor API: show/hide, step forward/back, reset. Auto-play with tempo slider (30-200 BPM). Stops at end of score.
- **Sample Scores dropdown** — 5 real SATB MusicXML scores from public domain (see below).
- **Practice Mode** with hint note playback (see below).

### Practice Mode (Study Overlay) — TESTED WITH REAL MIC
Jon tested and confirmed: **functionality works.** Pitch detection guides voice onto correct note. Feedback from testing drove refinements:
- **"Hear it" button** — tap to hear synthesized reference tone (triangle wave + sine, warm timbre). Echo cancellation filters it from mic input.
- **Auto-play** (checkbox, on by default) — reference tone plays automatically when cursor advances to new note. User hears what to sing, matches voice, cursor moves.
- **Smoothed pitch bar** — EMA smoothing (0.75 weight) reduces jitter. Wider marker, green "good zone" highlight in center.
- **More forgiving thresholds** — perfect ≤20 cents (was 15), good visual threshold ≤35 cents.
- **Clearer UX** — "Sing This" label with large target note, idle state says "tap Hear it first."
- Cursor advances after holding correct pitch for 400ms (octave-flexible matching).
- Notes color green (perfect) or yellow (good) in the score after being sung.

### Sample Choir Scores (5 MusicXML files in `public/musicxml/`)
| File | Title | Composer | Parts | Source | Complexity |
|------|-------|----------|-------|--------|------------|
| `amazing-grace-hymn.xml` | Amazing Grace | Traditional | 2 (SA+TB staves) | Hymnary.org | Simple hymn |
| `bach-bwv-244-03-chorale.musicxml` | Herzliebster Jesu | J.S. Bach | 5 (4 Voice + Continuo) | Bach Chorale FB | Standard chorale |
| `bach-bwv-140-07-chorale.musicxml` | Wachet auf (Sleepers Wake) | J.S. Bach | 5 (4 Voice + Continuo) | Bach Chorale FB | Slightly complex |
| `barnby-crossing-the-bar-satb.musicxml` | Crossing The Bar | Barnby/Tennyson | 4 (S/A/T/B named) | Public domain | Victorian hymn-anthem |
| `mozart-requiem-kyrie-satb.musicxml` | Requiem Kyrie | Mozart | 4 (S/A/T/B) | NVIDIA/mellotron | Complex fugal |

Additional sources found for future: 146 more Bach chorales (GitHub), CPDL (54K+ scores, needs Hawkeye for Cloudflare), Josquin Research Project (700+ Renaissance works via API).

### Navigation Fix
Connected all Pitch Defender sub-pages:
- Main menu now has "Studio & Practice" section linking to Sheet Music Studio + Note Runner
- Dev tools (Staff Tester, Pitch Benchmark) as small footer links
- CREPE benchmark back link added (was orphaned)
- All back links standardized to "← Back to Pitch Defender"

### Curriculum Research (Not Deployed — Research Doc)
Full 438-line research doc at `docs/howmusicworks-curriculum-research.md`:
- Mapped all 9 sections, ~102 topics from howmusicworks.org
- Content format: text + 360 diagrams + 750 audio demos, zero interactivity
- 3-layer integration architecture: Curriculum → Notation → Exercise → FSRS
- 5-phase implementation plan
- Key insight: HMW is passive reference. Our differentiator = making every "listen" into "play/sing it"

## Codex Review
One boardroom consultation (0 critical, 0 high, 3 medium, 2 low). All addressed.

## Files Changed (13 files, +31,500 lines)
```
src/components/PitchDefender/SheetMusicViewer.tsx   — REWRITE: dark mode, upload, parts, cursor, practice mode w/ hint notes
src/components/PitchDefender/PitchDefender.tsx      — Navigation: Studio & Practice links + dev tool footer
src/components/PitchDefender/PitchTester.tsx        — Standardized back link
src/components/PitchDefender/CrepeBenchmark.tsx     — Added back link (was orphaned)
app/pitch-defender/sheet-music/page.tsx             — Updated header text
public/musicxml/amazing-grace-hymn.xml              — NEW: sample score
public/musicxml/bach-bwv-244-03-chorale.musicxml    — NEW: sample score
public/musicxml/bach-bwv-140-07-chorale.musicxml    — NEW: sample score
public/musicxml/barnby-crossing-the-bar-satb.musicxml — NEW: sample score
public/musicxml/mozart-requiem-kyrie-satb.musicxml  — NEW: sample score
docs/howmusicworks-curriculum-research.md           — NEW: curriculum research doc
docs/PITCH_DEFENDER_SESSION_HANDOFF_2026-04-03-session3.md — This file
```

## Commits (7, all deployed)
```
e804204c feat: hint note playback + smoother pitch feedback in practice mode
ce92f266 feat: add Barnby "Crossing the Bar" SATB score + dropdown entry
2f727ad8 feat: sample choir scores + score picker dropdown
60324bb8 feat: practice mode — sing along with pitch tracking on sheet music
81e34a62 fix: connect all Pitch Defender sub-pages via navigation
87002217 feat: production OSMD sheet music viewer — dark mode, upload, parts, cursor
39caf25a docs: session 3 handoff + howmusicworks curriculum research
```

## Jon's Live Feedback (This Session)
- CREPE benchmark pitch detection: "unreal good even on crappy laptop mic"
- Practice mode: "functionality is there... able to guide me onto the right note"
- Requested: hint note playback, smoother pitch bar, reference tone with echo cancellation filtering → ALL BUILT AND DEPLOYED

## What's NOT Done (Carried Forward)

### Ready to Build (No Jon Required)
- [ ] Curriculum Phase 1: JSON topic definitions for all 102 topics + prerequisite DAG
- [ ] Curriculum Phase 2: MusicXML notation assets for scales, chords, intervals
- [ ] Practice mode: miss detection (timeout after N seconds → mark miss, advance)
- [ ] Practice mode: end-of-practice scorecard with note-by-note breakdown
- [ ] Practice mode: instrument choice for hint note (piano, vocal synth, sine)
- [ ] OSMD dark mode fine-tuning — staff line contrast on some scores
- [ ] CPDL score acquisition via Hawkeye (Cloudflare-blocked)
- [ ] Staff tester: live mic test with voice orb + pitch trail

### Franchise Games (Not Started)
- [ ] Pitchforks — franchise game #2
- [ ] Flappy Pitch — franchise game #3 (AudioWorklet+WASM tier)

### From Previous Sessions
- [ ] Integrate PESTO into PitchFusion as third detector
- [ ] NoteRunner playtesting — verify pause mode, tune difficulty
- [ ] Mic calibration flow — silence profile + range scan + reference test

## Session Prompt for Next Session

```
PRIORITY — Pitch Defender & Music Education Platform (Reset Biology):

  Read these files IN ORDER:
  1. reset-biology-website/docs/PITCH_DEFENDER_SPEC.md
  2. reset-biology-website/docs/PITCH_DEFENDER_SESSION_HANDOFF_2026-04-03-session3.md
  3. src/components/PitchDefender/SheetMusicViewer.tsx (OSMD + practice mode + hint notes)
  4. docs/howmusicworks-curriculum-research.md (102 topics, 5-phase integration plan)

  CONTEXT: Sheet Music Studio is production-quality and TESTED WITH REAL MIC:
  - Native OSMD dark mode, MusicXML upload, part isolation, cursor/playback
  - 5 sample SATB scores (Amazing Grace, Bach x2, Barnby, Mozart Requiem)
  - Practice Mode with "Hear it" hint note, auto-play, smoothed pitch bar
  - Jon tested: "functionality is there, able to guide onto right note"
  - All sub-pages connected via navigation

  howmusicworks.org curriculum fully researched: 102 topics, 9 sections.
  5-phase integration plan documented. Phase 1 (JSON data) ready to start.

  SESSION PRIORITIES:
  1. Practice mode improvements: miss detection (timeout), scorecard, instrument picker
  2. Curriculum Phase 1: JSON topic definitions + prerequisite DAG
  3. Begin Pitchforks or Flappy Pitch franchise game design
  4. PESTO integration into PitchFusion engine
  5. NoteRunner playtesting + mic calibration flow

  DESIGN PRINCIPLES:
  - Fun first, educational second (games), professional quality (notation studio)
  - Jon's son (17, chamber choir) is the first user of Sheet Music Studio
  - HMW curriculum is passive reference. We make it interactive via pitch detection.
  - Game playing IS curriculum studying (FSRS connects them)

  MANDATORY WORKFLOW: Build → Codex review via boardroom CLI → Fix criticals → Deploy
  RULE: ALWAYS use boardroom CLI for Codex. NEVER spawn Agent subagents.
```
