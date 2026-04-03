# Pitch Defender — Product / Game Design Specification

**Status:** Pre-development design document
**Created:** 2026-04-02
**Working Title:** Pitch Defender
**Alternative names:** Note Invaders, Alien Ear Trainer, Sing to Survive, Pitch Patrol, Perfect Pitch Defense

---

## 1. Core Concept

Educational music game for children teaching note recognition, pitch matching, relative pitch, note naming, singing accuracy, staff awareness, interval recognition, treble/bass clef familiarity, melodic memory, and sequencing.

Wrapped in a space-invader / alien defense structure. Player protects a city/base from descending alien invaders. Each alien represents a musical target. Player defeats aliens by:

- Identifying the correct note from choices
- Singing the note correctly
- Reproducing a sequence of notes in order
- Singing a note shown by name
- Singing a note shown on a staff
- Adjusting voice using visual pitch guidance until matching target pitch

Should feel like a blend of: space invaders + music trainer + boss battle + skill progression + spaced repetition system.

**Fun first, but secretly a highly optimized ear-training engine.**

---

## 2. Educational Goals

### Primary
- **Absolute note recognition** — hear a note, identify its name
- **Pitch matching** — hear a note, sing it back accurately
- **Note recall from name** — see "C", produce that pitch
- **Note recall from staff** — see note on treble/bass clef, sing it
- **Relative pitch movement** — understand up/down movement
- **Sequential note reproduction** — sing short melodic patterns in order
- **Interval recognition/execution** — reproduce jumps like A->C or D->F
- **Sight-singing foundations** — convert visual notation to vocal pitch

### Secondary
- Microphone confidence
- Fast auditory reaction time
- Internal pitch memory
- Smooth vocal control
- Musical attention span
- Frustration tolerance through short rounds and visible progress

---

## 3. Target User

**Primary:** Children learning pitch and note recognition (especially younger learners needing strong visual/game-like reinforcement)

**Secondary:** Beginners of any age, parents teaching at home, vocal beginners, music students wanting engaging ear training

Design optimized for children, structured enough for older users.

---

## 4. Core Fantasy

Player is defending a city/base/planet from musical aliens. Each alien is powered by a note frequency or melodic code. Only way to destroy: decode or reproduce the note correctly.

The player is:
- Locking onto enemy frequencies
- Tuning weapons with their voice
- Matching alien harmonics
- Clearing waves of musical invaders

This framing makes repetitive ear training feel purposeful.

---

## 5. Primary Gameplay Loops

### Loop A: Hear -> Identify -> Destroy
1. Alien appears and descends
2. Note plays
3. Player chooses correct note from buttons
4. Correct = laser fires, alien destroyed
5. Incorrect = shield damage, alien descends, combo reset, optional replay

Simplest introductory mode.

### Loop B: Hear -> Sing Back -> Destroy
1. Alien appears
2. Target note plays
3. Player sings into microphone
4. Real-time pitch tracker shows too low/too high
5. Within pitch window for minimum hold time = alien explodes

Core singing/pitch-matching mode.

### Loop C: See Name -> Sing -> Destroy
1. Alien appears with note label "G"
2. No reference tone (optional help button)
3. Player sings the pitch
4. Tracker compares voice to target
5. Match destroys alien

Pushes memory and pitch recall.

### Loop D: See Staff Note -> Sing -> Destroy
1. Alien displays note on treble or bass clef
2. Player interprets notation
3. Player sings correct pitch
4. Tracker verifies
5. Alien destroyed on match

Bridges ear training with sight reading.

### Loop E: Hear Sequence -> Reproduce -> Destroy
1. Alien plays 2-3 notes in order
2. Player sings them back in order
3. Game checks pitch correctness AND sequence order
4. Alien shields break per correct note
5. Final correct note destroys alien

Advanced musical memory mechanic.

---

## 6. Game Modes

### Mode 1: Note Blaster
- Purpose: basic note recognition
- Input: tap/click note name
- Mechanic: alien plays note, multiple-choice buttons, correct answer shoots
- Best for: early levels, young kids, onboarding, SRS drilling

### Mode 2: Echo Cannon
- Purpose: pitch matching
- Input: microphone singing
- Mechanic: alien broadcasts note, player sings same pitch, live pitch reticle shows offset, hold to fire
- Best for: matching ability, singing confidence

### Mode 3: Name-to-Note Strike
- Purpose: note recall from label
- Input: microphone singing
- Mechanic: alien displays note name, player sings it, optional hint with score penalty
- Best for: intermediate learners, internal note memory

### Mode 4: Staff Defender
- Purpose: note reading + pitch production
- Input: microphone singing
- Mechanic: alien contains staff with note, player sings it, live tracker
- Best for: music-reading children, later progression

### Mode 5: Sequence Assault
- Purpose: short melodic memory
- Input: microphone singing
- Mechanic: alien has multiple cores (one per note), sing in order, each success breaks one core
- Best for: relative pitch, memory, vocal agility

### Mode 6: Interval Hunter
- Purpose: interval awareness
- Input: microphone singing
- Mechanic: alien displays/plays two-note pattern (C->D, D->F, etc.), sing both in order
- Best for: interval training, leap control

### Mode 7: Survival / Endless
- Purpose: repeat practice with adaptive difficulty
- Input: mixed modes
- Mechanic: endless waves, game chooses from mastered/weak notes, adapts difficulty, integrates SRS
- Best for: long-term retention, score chasing, daily training

---

## 7. Difficulty Progression

### Phase 1: 2-note world (C+G or similar distinct pair)
### Phase 2: 3-note world (add one after mastery)
### Phase 3: 4-5 note sets (gradual SRS-based addition)
### Phase 4: Full diatonic set (C D E F G A B)
### Phase 5: Accidentals (sharps/flats after strong confidence)
### Phase 6: Octave awareness (same names, different octaves)
### Phase 7: Clef-specific reading (treble first, then bass)
### Phase 8: Intervals and jumps (stepwise -> skips -> leaps)
### Phase 9: Sequences (2-note -> 3-note -> mixed jumps)
### Phase 10: Mixed challenge (all skills blended)

---

## 8. Level Structure

### World 1: Sound Scouts — identify 2 notes, no mic, large buttons, forgiving timing
### World 2: Frequency Fighters — hear + sing back, simple pitch guidance, single-note
### World 3: Name Raiders — see name + sing, optional help tone
### World 4: Staff Squadron — treble clef note, sing it
### World 5: Bass Base Defense — bass clef note, sing it
### World 6: Double-Core Invaders — 2-note sequences, mostly stepwise
### World 7: Skip Ship Armada — 2-note skips (C->E, D->F, A->C)
### World 8: Triple Threat Fleet — 3-note patterns, short melodies
### World 9: Leap Lords — 4th, 5th, octave jumps
### World 10: Boss Planet — mixed challenge boss battles

---

## 9. Alien Design by Mechanic

- **Single-note aliens:** one glowing core, one target frequency
- **Two-note aliens:** two stacked pods, sequential completion
- **Three-note aliens:** three shield nodes, sequential destruction
- **Interval aliens:** visual "jump gap" between core points
- **Staff aliens:** musical staff panel embedded in body
- **Boss aliens:** multi-phase, combines identify + sing + sequence + staff

---

## 10. Real-Time Pitch Guidance Design

### Visual Concepts
- **Option A:** Vertical pitch meter on alien (target = center ring, voice marker floats above/below)
- **Option B:** Beam alignment (voice powers beam, rises/falls, locks when aligned)
- **Option C:** Heat-seeking voice missile (drifts with pitch, locks on match)

### Recommended: Simple vertical tuner-style bar
- Target center line
- Live voice dot
- Color/glow change when close
- Lock effect within tolerance

### Feedback Thresholds
- Beginner: generous pitch window
- Medium: moderate window
- Advanced: tight window
- Hold duration: 300-800ms depending on level

### Cues
- Too low -> arrow up / blue glow below target
- Too high -> arrow down / glow above target
- Close -> ring starts charging
- Matched -> laser locks, alien shakes, explosion

---

## 11. Audio / Pitch Detection

### Requirements
- Real-time microphone input
- Determine fundamental pitch
- Map to nearest note
- Show deviation
- Require stability (not accidental match)
- Ignore background noise / low-confidence input
- Avoid punishing brief tone breaks

### Child-friendly feedback: "lower" / "higher" / "locked on"
### Advanced optional: cents sharp/flat, note name, octave

### Sustain check: pitch matches + confidence high + held steadily for minimum time

### Sequence validation: detect note 1, confirm, open note 2 window, optional replay on stall

---

## 12. Note Presentation Options

1. Audio only (hear, identify/mimic)
2. Note name only (see letter, sing it)
3. Note on staff (visual notation, sing it)
4. Both audio and visual (scaffolding)
5. Preview then memory (briefly shown, then hidden, recall)

---

## 13. Spaced Repetition Integration

Track per note/pattern:
- Total attempts, successes, recent streak
- Time since last shown
- Error frequency
- Confusion pairs (e.g., E/F confusion, A->C struggles)

SRS determines: frequency of appearance, removal/addition, introduction timing, review scheduling.

Mastery model: correct answers increase score, errors/hesitation reduce slightly.

Bias toward: under-practiced items, recently missed, near-mastery threshold, occasional mastered review.

---

## 14. Progression & Unlock System

### Unlockable
- New planets/worlds, city skins, ship/laser skins
- New alien species, note ranges, challenge types, soundtrack themes

### Educational Unlocks
- New notes after mastery
- Treble clef after note-name mastery
- Bass clef later
- Interval mode, sequence mode, boss battles

### Rewards
- Stars, coins, badges, streak flames
- Shield upgrades, combo multipliers
- "Pitch perfect" medals

---

## 15. Scoring Design

Points from: correct answer, first-try success, accurate pitch center, stable held pitch, fast response, combo streak, full wave clear, no-damage bonus.

Singing bonuses: Locked On, Perfect Lock, Steady Beam, Sequence Ace, Boss Breaker.

Errors should be informative, not punishing. Retry loops should feel encouraging.

---

## 16. Health / Pressure System

- City/shield health at bottom
- Alien descends over time
- Wrong answers / failure to respond = damage
- Success maintains/restores defenses

Younger players: slow descents, partial penalties, recovery opportunities.
Advanced: faster speed, shorter windows, tighter tolerance, multi-note attacks.

---

## 17. Boss Battles

- **Boss 1: Note Core Cruiser** — 5 single notes, hear and identify
- **Boss 2: Echo Beast** — hear and sing 5 notes
- **Boss 3: Staff Titan** — sing notes from staff
- **Boss 4: Sequence Dragon** — 2-3 note sequences
- **Boss 5: Interval Mothership** — leaps and skip intervals

Phase-based, heavily animated, visible shield cracking.

---

## 18. Accessibility Options

- Mic on/off, identification-only mode, slower gameplay
- Larger buttons, fewer choices, colorblind-safe palette
- Solfege option, octave-agnostic mode
- Strict/forgiving pitch, hint system, replay target
- Parent/teacher dashboard
- Treble only / bass only / both

### Singing support
- Hear target again, hear reference scale
- Clear too high/too low feedback
- Auto-pause descent in beginner mode

---

## 19. Parent / Teacher Controls

Controls: enabled notes, accidentals, clef selection, stepwise-only, max sequence length, interval limits, mic tolerance, session length, reward intensity.

Analytics: strongest/weakest notes, average pitch accuracy, most-missed notes, progression by date, practice streaks, mastered intervals/sequences.

---

## 20. Singing Difficulty Settings

### Beginner
- Octave-flexible, wide cents tolerance, strong guidance, long descent, short hold, frequent replays

### Intermediate
- Normal matching, moderate tolerance/hold, less intrusive guidance

### Advanced
- Tight tolerance, strict timing, less visual aid, faster enemies, fewer replays

Consider hidden adaptive model that widens tolerance when struggling.

---

## 21. Visual Style

Bright sci-fi cartoon aesthetic, friendly aliens, bold note symbols, glowing pitch energy, satisfying explosions, starfield backgrounds, musical/sci-fi hybrid UI.

Note names must be large, staff notes readable, pitch guidance intuitive, minimal clutter during singing.

---

## 22. Animation Ideas

### Alien states
- Idle hover, attack descent, target-note pulse, shield crack, lock-on shake, explosion

### Pitch feedback
- Voice marker rises/falls, target ring charges, reticle flash, beam intensifies

### Rewards
- Combo counter, medals, wave clear effects, fireworks, musical note confetti

---

## 23. Sound Design

- Clear piano/synth note playback (instrument choices)
- Laser sounds, alien explosions, reward chimes
- Soft failure sounds (not humiliating)
- Subtle soundtrack that ducks during listening/singing tasks

---

## 24. Training Content Ladder

1. Single note recognition (hear C, pick C)
2. Single note mimic (hear C, sing C)
3. Named note recall (see C, sing C)
4. Staff note recall (see middle C on staff, sing it)
5. Two-note step sequences (C->D, D->E, E->F)
6. Two-note skip sequences (C->E, D->F, E->G)
7. Larger interval jumps (C->G, D->A, G->D)
8. Three-note patterns (C->D->E, G->F->E, C->E->G)
9. Mixed sight/audio sequences

---

## 25. Skill Tree

- **Ear Branch** — hear and identify
- **Voice Branch** — sing back accurately
- **Reading Branch** — staff note reading
- **Interval Branch** — jumps and skips
- **Melody Branch** — sequences and memory

Each branch unlocks advanced levels and cosmetic rewards.

---

## 26. Daily Practice

5-10 minute sessions: one daily challenge, one review wave, one new concept wave, one reward moment, optional endless mode.

---

## 27. Relationship to Existing System

### Keep from current
- Note database / note objects
- Spaced repetition logic (FSRS engine)
- Mastery tracking
- Current quiz logic
- Existing web app structure

### Add on top
- Arcade wave system
- Alien objects linked to note targets
- Microphone pitch detection
- Real-time pitch HUD
- Level/world progression
- Reward layer, visual skins, effects
- Note-sequence entity support
- Treble/bass visual rendering
- Parent settings and analytics

### Architecture: Separate
1. Music training engine
2. Gameplay presentation layer
3. Progression / rewards layer

Same core note logic powers: quiz mode, alien shooter mode, singing mode, sight-reading mode, boss mode.

---

## 28. Design Principle

**Do not make it just a quiz with aliens.**

Needs: waves, animations, tension, score, unlocks, combos, cosmetic rewards, bosses, city defense stakes, flow and escalation.

The learning mechanic is the weapon, not the whole identity.

---

## 29. MVP Feature Set

### Phase 1 (MVP)
- Alien descent gameplay loop
- Note recognition multiple-choice mode (Note Blaster)
- Hear-and-sing-back mode (Echo Cannon)
- Simple real-time higher/lower pitch meter
- Spaced repetition integration (existing FSRS)
- Basic scoring and combos
- 3-5 worlds or level groups
- Progression that adds notes over time
- Child-friendly visuals and sound effects
- Parent setting to control note pool

### Phase 2
- Note name to sing (Name-to-Note Strike)
- Staff note to sing (Staff Defender)
- 2-note sequences
- Boss battles
- Unlockables

### Phase 3
- Bass clef
- Interval training
- 3-note patterns
- Analytics dashboard
- Adaptive difficulty
- Cosmetic progression

---

## 30. Architecture Notes (Implementation Guidance)

### Existing assets to leverage
- `src/lib/fsrs.ts` — FSRS-4.5 spaced repetition engine (complete)
- `src/components/NBack/PitchRecognition.tsx` — current game UI
- Piano WAV samples in `/public/sounds/nback/piano/`
- `NOTE_COLORS` synesthesia color map
- `SEED_DIFFICULTY` pre-seeded difficulty values
- Progressive unlock system with scaled thresholds
- Voice input via WhisperService

### Key technical decisions — RESOLVED

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| Background rendering | **Star Nest WebGL shader via Three.js** | Already ported to R3F in ethereal-flame-studio; `three`, `@react-three/fiber`, `@react-three/drei` already installed in this project |
| Game element rendering | **DOM overlay with CSS animations** for Phase 0.5 | Simpler for MVP; Star Nest background provides the visual wow factor; can migrate to Canvas 2D in later phases if needed |
| Pitch detection | **Deferred to Phase 1** (Echo Cannon) | Technical risk — needs spike for children's voice detection; don't block Phase 0.5 on this |
| Game loop | **requestAnimationFrame** for alien descent + React state for UI | Hybrid approach: rAF drives smooth animation, React handles interaction |
| State management | **React useState/useRef** (same pattern as PitchRecognition.tsx) | Proven pattern in this codebase; no need for Zustand/Redux for single-component game |
| Mobile | **Touch-first design** with 48px+ tap targets | Primary audience is children, many on tablets |

---

## 31. Star Nest Skybox Background — Integration Plan

### Source
- **Original:** Pablo Roman Andrioli (Shadertoy), Unity port by Jonathan Cohen
- **R3F Port:** `C:\Users\jonch\Projects\ethereal-flame-studio\src\components\canvas\StarNestSkybox.tsx`
- **Shader:** `C:\Users\jonch\Projects\ethereal-flame-studio\src\lib\shaders\starnest.frag.glsl`
- **Reference doc:** `docs/STAR_NEST_SKYBOX_REFERENCE.md` (parameter documentation, all 39 material presets)

### What gets extracted
- Fragment shader (GLSL ES volumetric ray marching) — copied verbatim
- Vertex shader (inline, 5 lines)
- All 23 R3F presets (darkWorld1, purple, galaxies, crazyFractal variants, HSV animated, etc.)
- Preset type definition

### What gets stripped (not needed for game background)
- Audio reactivity system (useAudioStore) — game doesn't have audio analysis
- Render mode system (useRenderMode) — no headless rendering
- Camera position tracking — fixed background, no user camera control

### Standalone component: `StarNestBackground.tsx`
- Props: `preset` (select from 23 presets), `rotationSpeed`, `driftSpeed`
- Renders as full-screen absolute-positioned Canvas behind the game DOM
- Uses `<Canvas>` from @react-three/fiber with a sphere + BackSide shader material
- Simple accumulated time via useFrame — smooth, never jumps

### Recommended presets for game contexts
| Game context | Preset | Why |
|-------------|--------|-----|
| Default / menu | `darkWorld1` | "THE ONE" — gorgeous, dark, subtle movement |
| Boss battle | `crazyFractal` | Intense red fractals, dramatic |
| Wave cleared | `hsvRainbow` | Color cycling celebration |
| Hard mode | `darkWorld3` | Dark, ominous, negative brightness |
| Calm / tutorial | `galaxies` | Gentle, spacious feel |

### Dependencies (all already installed)
- `three` (^0.181.2) — in package.json
- `@react-three/fiber` (9.4.2) — installed
- `@react-three/drei` (10.7.7) — installed
- GLSL webpack loader — needs adding to next.config.ts

### File structure
```
src/lib/shaders/starnest.frag.glsl          — fragment shader
src/components/PitchDefender/StarNestBackground.tsx  — standalone R3F component + presets
```

---

## 32. Phase 0.5 Implementation Architecture

### Component tree
```
app/pitch-defender/page.tsx                  — route (dynamic import, SSR=false)
src/components/PitchDefender/
  PitchDefender.tsx                          — main game orchestrator
  StarNestBackground.tsx                     — WebGL shader background
  GameHUD.tsx                                — score, combo, wave, health bar
  Alien.tsx                                  — single alien (animated descent)
  NoteButtons.tsx                            — tap-to-identify note grid
  WaveIntro.tsx                              — "Wave 3" title card between waves
  GameOver.tsx                               — game over / summary screen
  gameEngine.ts                              — wave spawning, scoring, state machine
  types.ts                                   — AlienState, GameState, WaveConfig, etc.
  animations.css                             — CSS keyframes for aliens, explosions
```

### Game flow
1. Menu → select difficulty → Start
2. Star Nest background fades in
3. Wave intro ("Wave 1 — Sound Scouts")
4. Aliens spawn one at a time, descend smoothly (CSS transform + rAF)
5. Active alien plays its note (piano WAV)
6. Player taps note button → correct = explosion + XP, wrong = damage + replay
7. FSRS grades response (correct/wrong + latency)
8. Wave complete → brief stats → next wave
9. City health reaches 0 → Game Over → summary with FSRS memory health bars
10. Progressive unlock: 2 notes → 8 notes via FSRS + consecutive-correct thresholds

### Reused from existing codebase
- `src/lib/fsrs.ts` — all FSRS logic, NoteMemory type, NOTE_COLORS, autoGrade, calcXP
- Piano WAV cache pattern from PitchRecognition.tsx
- Sound effects synthesis (correct/wrong/levelup/milestone beeps)
- `PortalHeader` component
