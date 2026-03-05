# Pitch Recognition Game — Ideas Reference & Analysis
**Created:** 2026-03-04
**Sources:** ChatGPT suggestions, Gemini suggestions, internal discussion
**Status:** Pre-planning brainstorm — nothing built yet

---

## CONTEXT: What We Already Have (Don't Recreate)

Before reading any suggestions, these are already built in `src/components/NBack/PitchRecognition.tsx`:

- ✅ Progressive note unlocking (INTRO_ORDER: C4→A4→G4→E4→D4→F4→B4→C5)
- ✅ Identify game with Easy / Hard / Extra Hard difficulty
- ✅ Easy mode: piano key highlights when note plays
- ✅ Hard mode: no highlight, keyboard visible
- ✅ Extra Hard mode: keyboard hidden entirely, ears only
- ✅ N-Back Pitch Memory game (1/2/3-back, warmup phase, memory window)
- ✅ Spaced repetition (currently naive weighted-random — FSRS upgrade planned)
- ✅ localStorage persistence for progress
- ✅ Note mastery progress grid display
- ✅ Audio via WAV files in `/public/sounds/nback/piano/`
- ✅ Response latency already measured (used for FSRS grade auto-classification)
- ✅ 8 notes: A4, B4, C4, C5, D4, E4, F4, G4

---

## CHATGPT SUGGESTIONS — Full Capture

### 1. "Note Hunter" Progression System
Each note = a character to capture. Gradual unlock:
```
Level 1: C
Level 2: C D
Level 3: C D E
Level 4: C D E F
Level 5: Full scale
```
**Already have this via INTRO_ORDER. Skip.**

### 2. Spaced Repetition Data Model
SM-2 based data model (Note { pitch, ease, interval, lastReviewed, nextReview, successRate })
**We are going further with FSRS. Skip the SM-2 suggestion.**

### 3. Streak System (Extremely Addictive)
```
🔥 5 correct  → multiplier ×2
🔥 10 correct → multiplier ×3
🔥 20 correct → lightning round
Miss → streak resets
```
**NOT built. Excellent engagement mechanic. Keep.**

### 4. Speed Bonus Scoring
```
Correct < 1.5s → +10 pts
Correct < 3s   → +5 pts
Correct > 3s   → +2 pts
Wrong          → 0 pts
```
**Partially built (latency measured for FSRS grading) but not shown as a score to user. Keep as scoring display.**

### 5. "Pitch Monsters"
Each note = a monster you defeat. Correct = attack. Wrong = monster attacks.
```
C4 = Red Dragon
D4 = Blue Owl
E4 = Yellow Tiger
```
**Not built. Sounds childish but proven to work for retention. Flagged as possible — depends on brand tone.**

### 6. Relative Pitch Trap / Mode Variants
- Absolute Mode: single note, random, no context
- Distractor Mode: play a chord first, then ask for note (must resist relative pitch anchoring)
- Instrument Mode: switch between piano, violin, guitar, sine wave, voice
  - True pitch recognition survives timbre change — this is the real test
**Not built. The Instrument/Timbre variation idea is EXCELLENT and scientifically valid. Keep.**

### 7. Ear Calibration
Before gameplay, play a reference note repeatedly:
```
Daily calibration tone: A4 = 440Hz
Then begin training.
```
**Not built. Simple, scientifically sound (anchors the listener), good UX ritual. Keep.**

### 8. "Pitch Radar" (Circular Pitch Wheel UI)
Instead of buttons, show a circular chromatic wheel. User taps where they think the note lies. Visually teaches the chromatic circle layout.
```
        C
   B         C#
 A             D
 G#           D#
   G         E
        F
```
**Not built. Genuinely interesting UI — spatial memory encoding. Adds a visual-motor dimension to the task. Keep.**

### 9. Multiplayer Mode
Two players hear same note. Fastest correct answer wins. Scoreboard.
**Not built. Longer term idea — requires infrastructure. Flagged as future.**

### 10. Audio Visual Feedback
- Correct: green flash, note name appears, piano key lights up, replay note
- Wrong: show correct note, play it twice, animate key
**Partially built (Easy mode shows key). Richer feedback on wrong answers is a good addition. Keep.**

### 11. Note Familiarity Meter
```
C4  ██████████ 100%
D4  ███████░░░  70%
E4  ███░░░░░░░  30%
```
**Partially built (progress grid). Can be enhanced with real FSRS R values (actual recall probability %). Keep.**

### 12. Daily Challenge
"Today's Challenge: Identify 20 notes in under 30 seconds"
Rewards: badges, new instrument sounds
**Not built. Good retention hook. Keep.**

### 13. Hardcore Mode
No multiple choice. User types the note name.
```
You hear: *note*
Type answer: ___
```
**Not built. For advanced users. Keep as future mode.**

### 14. Long-Term Progress Metrics / Graphs
```
Pitch Recognition Speed:
Week 1: 3.2s average
Week 2: 2.4s average
Week 3: 1.7s average
```
**Not built. Requires API/DB persistence. Keep — motivating for brain optimization audience.**

### 15. "Mystery Note" Bonus Event
Rare event — special note appears. Correct = big XP + unlock reward. Wrong = miss the rare drop.
**Not built. Dopamine mechanics. Keep.**

### 16. "Guess the Song Key" Mode
Play a short melody. User guesses the key.
**Not built. Advanced mode — connects training to real music. Longer term. Flag as future.**

---

## GEMINI SUGGESTIONS — Full Capture

### 1. Virtual Pet Ecosystem ("Pitch Pets")
Each note = a creature/spirit. The SRS scheduling = hunger timer. When the algorithm says the note is due, the pet gets "hungry" and plays its pitch. Correct identification = feed it. Consistent correct answers = pet evolves.

**Analysis: Conceptually the most elegant mapping of SRS to game mechanics I've seen from any source.**
- Due for review = hungry (emotional urgency to review)
- Hard notes = sick/neglected pets (guilt mechanics = powerful engagement)
- Mastery = healthy thriving creature (positive reinforcement)
- The SRS becomes a *living world* not a study schedule

**Concern: Brand fit.** Reset Biology is adult brain optimization — a "virtual pet" may feel too juvenile. However a version where the pets are cosmic/neural entities (not cute animals) could work. Flag as: **possibly transformable into brand-appropriate version.**

### 2. Sonar Submarine (Exploration & Survival)
Pilot a sub through dark ocean trenches. Your sonar sends pings, echoes return as notes. Identify the pitch → determine what lies ahead (treasure, hazard, or enemy). Notes you struggle with = aggressive creatures pursuing you.

**Analysis: Excellent thematic fit for pitch training.**
- The metaphor is genuine: sonar IS pitch-based navigation
- Auditory-first by design (dark environment = visual is secondary)
- Notes you struggle with become physical threats (SRS queue = threat roster)
- Adult tone, tension-based, scientific aesthetic
**Rating: GREAT. High potential for Reset Biology brand.**

### 3. Magical RPG Battler (Sonic Mage / Bard)
You defend a tower. Enemies approach playing a pitch. Identify the note → cast the counter-spell. SRS queue = enemy roster. Weak notes = faster, harder enemies. Mastered notes = easy minions. Wrong answers = tower takes damage.

**Analysis: Direct mechanical translation of SRS into gameplay.**
- The SRS "difficulty" becomes literal game difficulty
- "Boss monsters" = notes you consistently struggle with
- Natural tension without needing timers
- Proven game loop (tower defense + identification)
**Rating: GREAT. Most direct SRS-to-gameplay translation.**

### 4. Synthwave Hacker
Crack audio-encrypted security vaults. Rapid sequences of tones = passwords. Identify pitches to unlock nodes. Currency to buy new synthesizer patches (timbre unlocks).

**Analysis: Interesting aesthetic but weaker SRS metaphor.**
- The hacker/tech aesthetic could fit the bio-optimization brand (brain as system to optimize)
- Timbre-as-unlock is an excellent progression mechanic
- The "sequences" mechanic is interesting (bridges Pitch Recognition and N-Back)
**Rating: GOOD. The sequence-cracking idea is novel. Timbre unlock is excellent.**

### 5. "Synesthesia" Reward System
As accuracy with a note increases, associate that note with a color. The color becomes a visual reinforcement — when C plays, a subtle red glow. The color fades if the note is forgotten (SRS decay).

**Analysis: Scientifically excellent.**
- Synesthetic encoding is a real memory technique used by some perfect pitch holders
- The color fading as the note is forgotten = visual representation of FSRS retrievability
- Could be applied across ALL game skins, not just one
**Rating: GREAT. Should be in every version as a cross-cutting feature.**

### 6. Combo Multipliers
Rapid correct answers in succession multiply points.
**Standard gamification. Already noted from ChatGPT. Keep.**

### 7. Timbre Variations as Unlockables
Piano → unlock guitar → violin → 8-bit → human voice → distorted guitar.
Each timbre = new unlock in the progression system. True pitch test = recognition across all timbres.

**Analysis: Scientifically validated progression path.**
- Research: recognizing pitch across timbres is what distinguishes true absolute pitch
- Unlocking timbres as progression reward = built-in mastery gating
- Also technically interesting (WebAudio synthesis or additional WAV sets)
**Rating: GREAT. Best long-term progression mechanic of all suggestions.**

---

## INTERNAL IDEAS (Pre-AI Discussion)

### Maze Game Concept
- Top-down or corridor maze
- Encounters = notes due for FSRS review
- Door types by FSRS state:
  - Green door = well-known note (high S, just due)
  - Yellow door = shaky note (medium S, slightly overdue)
  - Red door = hard/overdue note (learning phase or lapse)
- Wrong answer = backtrack / hazard / lose a life
- Maze complexity scales with total active notes in queue
- Early learner: small maze, few note types
- Advanced: large maze, all 8+ notes in circulation

**Analysis: Our best idea. Spatially encodes the SRS queue into an explorable world.**
- The maze is a visualization of your knowledge state
- More mastered notes = more pathways (knowledge opens the world)
- FSRS and game difficulty are the same variable, not two separate systems

---

## SYNTHESIS: Best Ideas by Category

### Core SRS Mechanic Translation (Pick One Game Skin)
**Top 3 options:**
1. **Maze** — our idea, spatially elegant, SRS queue = map topology
2. **RPG Battler** — Gemini, direct SRS-to-enemy mapping, most proven game loop
3. **Sonar Submarine** — Gemini, best thematic fit for audio-first training, adult tone

### Cross-Cutting Features (Add to Any Skin)
- ✅ Streak multipliers (ChatGPT #3)
- ✅ Speed scoring displayed to user (ChatGPT #4)
- ✅ Synesthesia color-per-note system (Gemini #5) — **builds real memory associations**
- ✅ Timbre variations as progression unlocks (Gemini #7, ChatGPT #6)
- ✅ Note familiarity meter showing real FSRS R values (ChatGPT #11)
- ✅ Ear calibration at session start (ChatGPT #7)
- ✅ Daily challenge (ChatGPT #12)

### Future / Advanced Modes
- Hardcore: type the note name (no buttons)
- Guess the Song Key
- Multiplayer
- Long-term progress graphs (requires API persistence)

### Ideas That Don't Fit Our Brand
- Pitch Monsters (cute animals) — too juvenile, unless redesigned as cosmic/neural entities
- Virtual Pets — same concern, but the *mechanic* is great

---

## KEY PRINCIPLE (Preserve This)

**The game is a skin on top of the FSRS engine. The SRS determines what notes need attention. The game determines how the player encounters them. Wrong answer has both a game consequence (lose life/backtrack) and an SRS consequence (lapse logged, stability resets). These are separate and both happen.**

The game difficulty auto-adjusts emergently:
- Early: few notes, high R, easy encounters
- Struggling: low R notes dominate the queue → harder encounters more frequent
- Mastered: high S notes barely appear → encounters become rare and trivial

You do not need a separate difficulty slider. The SRS IS the difficulty system.

---

## OPEN QUESTIONS (For User to Answer)

1. **Brand tone:** Full adult (submarine, RPG mage) or playful-but-sophisticated (maze with atmospheric design)?
2. **Scope of v1:** One game skin fully built, or a framework that multiple skins can plug into?
3. **Monetization angle:** Is this a free feature, a subscriber-only feature, or an upsell?
4. **Timbre expansion:** Are we recording/sourcing new WAV sets for other instruments, or using WebAudio synthesis?
5. **User's own variations** mentioned in conversation — add these once shared.

---

## NOTES ON WHAT USER MENTIONED WANTING TO EXPLORE

- The maze game with auto-adjusting difficulty via SRS
- Variations on the AI suggestions that came to mind during reading (TBD — user to add)
