# Pitch Defender — Session Handoff 2026-04-03 (Session 2)

## What Was Built (6 commits, all deployed to resetbiology.com)

### Staff Visual Overhaul (Custom Canvas Renderer — Game Tier)
Rewrote `staffRenderer.ts` for professional music engraving quality:
- **Canvas-drawn treble & bass clefs** — bezier curve paths replacing ghost Unicode characters
- **4/4 time signature** on both treble and bass staves
- **Curly brace** connecting grand staff on the left
- **Proper filled note heads** — tilted ellipses (-18 degrees, standard engraving)
- **Correct stem direction** — references individual staff middle lines (B4 for treble, D3 for bass), not grand staff center
- **Staff lines** at 0.6 opacity, 1.8px (was 0.4 opacity, 1.5px — barely visible)
- **Middle C ledger line** at 0.5 opacity, 2px
- **Proportional layout** — clef area scales with lineSpacing (bounded 46-82px)
- **Exported `drawNoteHeadWithStem()`** — shared by NoteRunner scrolling notes

Updated `StaffDisplay.tsx` (SVG in-game staff on aliens):
- Larger clefs, better positioned, time signature added
- Proper note head proportions with correct stem direction

Updated `NoteRunner.tsx`:
- Scrolling notes are now note-head shapes (tilted ellipses + stems) instead of circles
- Match progress ring adapts to note head size

### OSMD Professional Notation Spike (Professional Tier)
**New component:** `SheetMusicViewer.tsx` wrapping OpenSheetMusicDisplay v1.9.7
- Renders MusicXML → SVG with professional engraving via VexFlow
- Dynamic import (client-only, no SSR)
- Auto-resize support
- Dark mode via CSS filter inversion (spike-level — needs proper theming for production)

**Demo score:** "Ode to Joy" SATB arrangement demonstrating ALL 4 standard clef types:
- Soprano: Treble clef (G on line 2)
- Alto: **Alto clef (C clef on line 3)** — movable C clef
- Tenor: **Tenor clef (C clef on line 4)** — second C clef position
- Bass: Bass clef (F on line 4)

**Route:** `/pitch-defender/sheet-music`

## Architecture Decision (Codex-Reviewed, Jon-Approved)

### Two-Tier Architecture
| Tier | Purpose | Renderer | Quality Bar |
|------|---------|----------|-------------|
| **Game** | Pitch Defender, NoteRunner, Pitchforks, Flappy Pitch | Custom Canvas 2D (`staffRenderer.ts`) | Fun, colorful, synesthesia, game feel |
| **Professional** | Chamber choir parts, music theory, sight-reading | OSMD (OpenSheetMusicDisplay) | Real sheet music engraving quality |

### Why OSMD over Verovio
- **Bundle size**: 296KB gzipped vs 2.4MB (10x smaller)
- **MusicXML-first**: Matches what choir directors export from Finale/Sibelius/MuseScore
- **SVG output**: Easy to overlay interactive elements (pitch tracking, note coloring)
- **Simpler integration**: Pure JS (no WASM), official React wrapper exists
- **SMuFL/Bravura**: Professional font-quality glyphs via VexFlow

### The Vision (Jon Shared This Session)
Jon's 17yo son is in chamber choir. The end goal:
1. **Import** his choir director's sheet music (MusicXML)
2. **See** professional notation with all clef types (treble, bass, alto, tenor, soprano, mezzo-soprano, octave clefs)
3. **Practice** with pitch tracking overlay — sing along, see where you're sharp/flat
4. **Learn** music theory from howmusicworks.org curriculum (9 sections, 117 topics: Sound, Major Scale, Chords, Scales, Meter, Chord-Scale Relations, Playing Chords, Playing Scales, Songwriting)
5. **Isolate** individual voice parts from SATB scores

## Codex Review Findings (2 consultations)

### Validated
- OSMD is the right choice for MusicXML-first choir study
- Two-tier architecture avoids forcing one renderer to solve two problems poorly
- All clef types work out of the box
- Client-only dynamic import is correct pattern

### Flagged for Next Phase
1. **Dark mode** — CSS invert is a spike hack. Production needs proper SVG theming (style OSMD's CSS variables or post-process SVG fill/stroke colors)
2. **Study overlay** — Must anchor to OSMD's score data structure (cursor API, note element queries), not screen coordinates. Zoom/reflow/resize will shift positions.
3. **Part isolation** — Real choir files are messy: shared staves, inconsistent voice tags, piano reductions. Needs robust MusicXML parsing.
4. **Curriculum decoupling** — Theory content should be a separate layer that references notation, not embedded in the renderer
5. **Bundle size** — 1.7MB acceptable for dedicated study screen, but lazy-load it

### Dissent (For Future Reference)
If the product thesis shifts toward publisher-grade digital scores (archival quality), Verovio deserves a second look — its MEI-centric pipeline and C++/WASM core produce more publication-like results. But for a choir study tool, OSMD is the pragmatic choice.

## Files Changed (8 files, +1445 / -157 lines)
```
app/pitch-defender/sheet-music/page.tsx         — NEW route for OSMD viewer
src/components/PitchDefender/SheetMusicViewer.tsx — NEW OSMD wrapper + demo SATB MusicXML
src/components/PitchDefender/staffRenderer.ts   — REWRITE: canvas clefs, time sig, brace, note heads, stems
src/components/PitchDefender/StaffDisplay.tsx    — IMPROVED: larger clefs, better notes, time sig
src/components/PitchDefender/NoteRunner.tsx      — UPDATED: note-head shapes replace circles
package.json / package-lock.json                — Added opensheetmusicdisplay@1.9.7
```

## Commits (6, all deployed)
```
fe3169ca spike: OSMD professional notation engine integration
277d9880 fix: stem direction uses individual staff middle lines
26566e48 fix: stem visibility, ledger line opacity, note rendering polish
1b013ccd fix: proportional clef/timesig sizing, tighter treble spiral
1848f8f0 feat: professional music staff engraving overhaul
```
(Plus 1 PitchTester layout fix from prior work)

## What's NOT Done (Carried Forward)

### From Previous Session Priorities (Not Started This Session)
- [ ] Live test staff tester with mic — verify voice orb tracks, trail renders
- [ ] Integrate PESTO into PitchFusion as third detector
- [ ] NoteRunner playtesting — verify pause mode, tune difficulty
- [ ] Mic calibration flow — silence profile + range scan + reference test

### New (From This Session's Vision)
- [ ] OSMD dark mode — proper SVG theming (replace CSS invert)
- [ ] Study overlay prototype — pitch tracking on top of OSMD notation
- [ ] MusicXML upload — let student load their choir part
- [ ] Part isolation — hide/show individual SATB voices
- [ ] OSMD cursor/playback — follow along with the music
- [ ] howmusicworks.org curriculum integration architecture
- [ ] Sample real choir MusicXML — test with actual chamber choir repertoire

## Session Prompt for Next Session

```
PRIORITY — Pitch Defender & Music Education Platform (Reset Biology):

  Read these files IN ORDER:
  1. reset-biology-website/docs/PITCH_DEFENDER_SPEC.md
  2. reset-biology-website/docs/PITCH_DEFENDER_SESSION_HANDOFF_2026-04-03-session2.md
  3. src/components/PitchDefender/SheetMusicViewer.tsx (OSMD wrapper)
  4. src/components/PitchDefender/staffRenderer.ts (custom Canvas renderer)

  CONTEXT: Two-tier architecture established and Codex-reviewed:
  - GAME tier: Custom Canvas renderer (staffRenderer.ts) for Pitch Defender, NoteRunner
  - PROFESSIONAL tier: OSMD (SheetMusicViewer.tsx) for real sheet music rendering
  
  Jon's son (17, chamber choir) is the first user of the professional tier.
  OSMD spike deployed at /pitch-defender/sheet-music — renders SATB with all 4 clef types.
  
  The custom Canvas renderer was overhauled: canvas-drawn clefs, 4/4 time sig, brace,
  proper note heads with stems, correct stem direction per staff middle line.
  
  Voice orb and pitch trail NOT YET TESTED with actual mic input.

  SESSION PRIORITIES:
  1. OSMD production-ready: proper dark mode theming (not CSS invert), MusicXML upload,
     part isolation (show/hide SATB voices), cursor/playback following
  2. Study overlay: pitch tracking visualization on top of OSMD notation —
     sing your part, see real-time accuracy feedback anchored to score semantics
  3. Live mic testing: verify voice orb, pitch trail, fusion engine on staff tester
  4. howmusicworks.org curriculum architecture: 9 sections, 117 topics —
     plan integration as interactive lessons alongside notation
  5. Test with real chamber choir MusicXML from MuseScore/CPDL

  DESIGN PRINCIPLES:
  - Professional quality for ALL ages (Jon's son is 17, not a child)
  - Game tier = fun first. Professional tier = real sheet music quality.
  - OSMD for notation, custom overlay for study tools — two systems, one experience
  - Full vocal range support, all clef types
  - Curriculum from howmusicworks.org as educational backbone

  MANDATORY WORKFLOW: Build → Codex review via boardroom CLI → Fix criticals → Deploy
  RULE: ALWAYS use boardroom CLI for Codex. NEVER spawn Agent subagents.
```
