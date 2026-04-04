# Pitch Defender — Session Handoff 2026-04-03 (Session 3)

## What Was Built (5 commits, all deployed to resetbiology.com)

### Sheet Music Studio — Production Overhaul
Rewrote `SheetMusicViewer.tsx` from spike to production-quality tool:
- **Native dark mode** — OSMD `EngravingRules` colors (background, noteheads, stems, staff lines, titles). CSS `filter:invert` hack eliminated.
- **MusicXML file upload** — drag-and-drop + file picker. Supports `.xml`, `.musicxml`, `.mxl` (compressed).
- **Part isolation** — toggle individual voices on/off via `Instrument.Visible`. Score re-renders with layout recalculation. Tested: hiding Tenor shows only Soprano/Alto/Bass.
- **Cursor/playback** — OSMD cursor API: show/hide, step forward/back, reset. Auto-play with tempo slider (30-200 BPM). Stops at end of score.
- **Sample Scores dropdown** — 5 real SATB MusicXML scores from public domain (see below).
- **Practice Mode** — Mic-based pitch tracking on sheet music (see below).

### Practice Mode (Study Overlay Prototype)
Integrated `usePitchDetection` (pitchy) into Sheet Music Studio:
- Green **Practice** button in toolbar starts mic + cursor
- Cursor guides through notes one at a time
- Sticky bottom bar shows: target note | cents deviation bar | your pitch | running score
- Notes color **green** (perfect, ≤15 cents) or **yellow** (good, ≤30 cents) after being sung
- Hold pitch for 400ms to confirm match and advance to next note
- Practice score tracks perfect/good/total
- **NOT YET TESTED WITH REAL MIC** — needs Jon to verify

### Sample Choir Scores (5 MusicXML files in `public/musicxml/`)
| File | Title | Composer | Parts | Source | Complexity |
|------|-------|----------|-------|--------|------------|
| `amazing-grace-hymn.xml` | Amazing Grace | Traditional | 2 (SA+TB staves) | Hymnary.org | Simple hymn |
| `bach-bwv-244-03-chorale.musicxml` | Herzliebster Jesu | J.S. Bach | 5 (4 Voice + Continuo) | Bach Chorale FB | Standard chorale |
| `bach-bwv-140-07-chorale.musicxml` | Wachet auf (Sleepers Wake) | J.S. Bach | 5 (4 Voice + Continuo) | Bach Chorale FB | Slightly complex |
| `barnby-crossing-the-bar-satb.musicxml` | Crossing The Bar | Barnby/Tennyson | 4 (S/A/T/B named) | Public domain | Victorian hymn-anthem |
| `mozart-requiem-kyrie-satb.musicxml` | Requiem Kyrie | Mozart | 4 (S/A/T/B) | NVIDIA/mellotron | Complex fugal |

### Navigation Fix
Connected all Pitch Defender sub-pages:
- Main menu now has "Studio & Practice" section linking to Sheet Music Studio + Note Runner
- Dev tools (Staff Tester, Pitch Benchmark) as small footer links
- CREPE benchmark back link added (was orphaned)
- All back links standardized to "← Back to Pitch Defender"

### Curriculum Research (Not Deployed — Research Doc)
Full 438-line research doc at `docs/howmusicworks-curriculum-research.md`:
- Mapped all 9 sections, ~102 topics from howmusicworks.org
- Content format analysis: text + 360 diagrams + 750 audio demos, zero interactivity
- 3-layer integration architecture: Curriculum → Notation → Exercise → FSRS
- 5-phase implementation plan
- Mapping of every section to our platform capabilities (pitch detection, OSMD, Canvas, FSRS)
- Key insight: HMW is passive reference. Our differentiator is making every "listen to this" into "now play/sing it."

## Codex Review
One boardroom consultation (0 critical, 0 high, 3 medium, 2 low):
- Part visibility fragility with multi-staff instruments (low risk for SATB)
- Cursor/playback state drift during reloads (handled in code)
- MXL parsing failures (wrapped in try/catch)

## Files Changed (12 files, +31,300 / -66 lines)
```
src/components/PitchDefender/SheetMusicViewer.tsx   — REWRITE: dark mode, upload, parts, cursor, practice mode, sample picker
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
```

## Commits (5, all deployed)
```
ce92f266 feat: add Barnby "Crossing the Bar" SATB score + dropdown entry
2f727ad8 feat: sample choir scores + score picker dropdown
60324bb8 feat: practice mode — sing along with pitch tracking on sheet music
81e34a62 fix: connect all Pitch Defender sub-pages via navigation
87002217 feat: production OSMD sheet music viewer — dark mode, upload, parts, cursor
```

## What's NOT Done (Carried Forward)

### Needs Jon (Next Time He's Free)
- [ ] Live test Practice Mode with mic — verify pitch tracking, note advancement, accuracy grading
- [ ] Live test staff tester with mic — voice orb, pitch trail, fusion engine

### Ready to Build
- [ ] Curriculum Phase 1: JSON topic definitions for all 102 topics + prerequisite DAG
- [ ] Curriculum Phase 2: MusicXML notation assets for scales, chords, intervals
- [ ] OSMD dark mode fine-tuning — staff line colors may need contrast adjustment on some scores
- [ ] Study overlay improvements: miss tracking (timeout if no match after X seconds), replay target note audio, end-of-practice scorecard
- [ ] CPDL score acquisition via Hawkeye (Cloudflare-blocked for automated download)

### Franchise Games (Not Started)
- [ ] Pitchforks — franchise game #2 (pitch-based combat/puzzle)
- [ ] Flappy Pitch — franchise game #3 (continuous pitch control, AudioWorklet+WASM tier)

### From Previous Sessions (Not Started)
- [ ] Integrate PESTO into PitchFusion as third detector
- [ ] NoteRunner playtesting — verify pause mode, tune difficulty
- [ ] Mic calibration flow — silence profile + range scan + reference test

## Session Prompt for Next Session

```
PRIORITY — Pitch Defender & Music Education Platform (Reset Biology):

  Read these files IN ORDER:
  1. reset-biology-website/docs/PITCH_DEFENDER_SPEC.md
  2. reset-biology-website/docs/PITCH_DEFENDER_SESSION_HANDOFF_2026-04-03-session3.md
  3. src/components/PitchDefender/SheetMusicViewer.tsx (production OSMD + practice mode)
  4. docs/howmusicworks-curriculum-research.md (9 sections, 102 topics, integration plan)

  CONTEXT: Sheet Music Studio is now production-quality with:
  - Native OSMD dark mode, MusicXML upload, part isolation, cursor/playback
  - 5 sample SATB scores (Amazing Grace, Bach x2, Barnby, Mozart Requiem)
  - Practice Mode: mic-based pitch tracking, notes color green/yellow as you sing
  - All sub-pages connected via navigation

  Pitch detection confirmed working great on Jon's laptop mic (CREPE benchmark test).
  Practice mode NOT YET TESTED with real mic input — priority verification.

  howmusicworks.org curriculum fully researched: 102 topics across 9 sections.
  5-phase integration plan documented. Phase 1 (JSON data) ready to start.

  SESSION PRIORITIES:
  1. LIVE MIC TEST: Practice mode on Sheet Music Studio + Staff Tester voice orb
  2. Curriculum Phase 1: JSON topic definitions + prerequisite DAG for all 102 topics
  3. Practice mode improvements: miss detection, replay audio, end-of-practice scorecard
  4. Begin Pitchforks or Flappy Pitch franchise game design
  5. PESTO integration into PitchFusion engine

  DESIGN PRINCIPLES:
  - Fun first, educational second (games), professional quality (notation studio)
  - Jon's son (17, chamber choir) is the first user of Sheet Music Studio
  - HMW curriculum is passive reference. We make it interactive via pitch detection.
  - Game playing IS curriculum studying (FSRS connects them)

  MANDATORY WORKFLOW: Build → Codex review via boardroom CLI → Fix criticals → Deploy
  RULE: ALWAYS use boardroom CLI for Codex. NEVER spawn Agent subagents.
```
