# Spaced Repetition Reference — Pitch Recognition / Ear Training
**Created:** 2026-03-04
**Purpose:** Full technical reference for implementing FSRS-based spaced repetition in the pitch recognition game. Preserve this before any gamification work.

---

## 1. Why Our Current Implementation Is Naive

```typescript
// CURRENT — weighted random selector, not true SRS
weight = 1 / (accuracy + 0.15)  // clamped 0.3–4.0
```

This has no memory of *when* you last saw an item, no interval scheduling, no forgetting curve, and no stability model. It's equivalent to a 1970s Leitner Box — showing hard notes more often is not spaced repetition.

---

## 2. The Memory Model That Actually Works: Two Components

All modern SRS algorithms (SM-17, SM-18, FSRS) are built on the **Two-Component Model of Memory**:

### Stability (S)
- Unit: **days**
- Meaning: The number of days until recall probability decays to **90%**
- Grows with each successful review
- Grows *more* when:
  - The item is easy (low Difficulty)
  - Retrievability was low at review time ("desirable difficulty" — you almost forgot it)
  - Stability itself is not yet very high (diminishing returns)

### Retrievability (R)
- Unit: **probability [0–1]**
- Meaning: Your probability of correctly recalling the item *right now*
- Decays continuously over time (forgetting curve)
- Resets to ~1.0 after each successful review
- Decays faster for low-stability items

### Key Insight
> "Repetitions have no power to increase stability when retrievability is high."

Reviewing when R ≈ 0.99 = almost zero stability gain. Optimal gain is at R ≈ 0.80–0.90. This is *why* spacing works — it's mechanistically motivated, not empirical folklore.

---

## 3. The Forgetting Curve

FSRS uses a **power law** (not exponential, not Ebbinghaus's log formula):

```
R(t, S) = (1 + (19/81) × t/S)^(−0.5)
```

Where:
- `t` = days since last review
- `S` = current stability (days)
- At `t = 0`: R = 1.0
- At `t = S`: R = 0.9 exactly (this defines what S means)
- At `t >> S`: R decays toward 0

**Scheduling rule:** Show the item again when R drops to the desired retention threshold (default 90%).

**Interval from this:**
```
I = (9 × S) × (R_desired^(−2) − 1)
// At R_desired = 0.90: I = S (interval equals stability)
// At R_desired = 0.80: shorter interval (more frequent reviews)
```

---

## 4. FSRS Algorithm (Free Spaced Repetition Scheduler)

FSRS is the current gold standard — Anki switched to it in October 2023. It replaced SM-2 which was used for 20+ years. It is open source and optimizable per user via ML.

### Grade Scale (1–4)
```
1 = Again  (forgot completely)
2 = Hard   (correct but slow/effortful)
3 = Good   (correct, normal effort)
4 = Easy   (correct, effortless — instant recognition)
```

For pitch recognition: auto-classify by response latency:
- Wrong → Again (1)
- Correct + >4s → Hard (2)
- Correct + 1.5–4s → Good (3)
- Correct + <1.5s → Easy (4)

### Per-Item State
Each note/item tracks: `{ S, D, R, due, lastReview, lapses }`

### Initial Stability (First Review)
```
S₀(Again) = w₀  ≈ 0.40 days
S₀(Hard)  = w₁  ≈ 1.40 days
S₀(Good)  = w₂  ≈ 3.71 days
S₀(Easy)  = w₃  ≈ 13.82 days
```

### Initial Difficulty
```
D₀(G) = w₄ − e^(w₅ × (G−1)) + 1
// Clamped to [1, 10]
// Good → mid-range; Easy → lower D; Again → higher D
```

### Difficulty Update (after each review)
Three-stage update prevents D from getting stuck:
```
ΔD = −w₆ × (G−3)           // grade-based delta
D' = D + ΔD × (10−D)/9     // linear damping (prevents extremes)
D'' = w₇ × D₀(4) + (1−w₇) × D'  // mean reversion toward Easy baseline
```
This means even a very hard note gradually becomes manageable with consistent "Easy" grades.

### Stability After Successful Recall (G ≥ 2)
```
S'_r = S × [e^(w₈) × (11−D) × S^(−w₉) × (e^(w₁₀×(1−R)) − 1) × modifier + 1]

where modifier:
  × w₁₅ if G=2 (Hard penalty, < 1)
  × w₁₆ if G=4 (Easy bonus, > 1)
  × 1    if G=3 (Good, no modifier)
```

Three effects encoded:
1. `(11−D)` — easy notes gain more stability
2. `S^(−w₉)` — diminishing returns at high stability
3. `(e^(w₁₀×(1−R)} − 1)` — maximum gain when you almost forgot it

### Stability After Forgetting / Lapse (G = 1)
```
S'_f = w₁₁ × D^(−w₁₂) × ((S+1)^(w₁₃) − 1) × e^(w₁₄×(1−R))
```

Properties:
- Post-lapse stability never exceeds pre-lapse (you can't gain from failing)
- Easier items recover faster after a lapse
- Higher pre-lapse stability → slightly higher post-lapse stability

### Default FSRS-4.5 Parameters (w₀–w₁₆)
```javascript
const W = [0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589,
           1.506,  0.1544, 1.004,  1.9813,  0.0953, 0.2975, 2.2042, 0.2407, 2.9466]
```

---

## 5. SM-2 (For Reference — What Anki Used Before FSRS)

Simple, widely used, but lacks explicit stability/retrievability modeling.

```
// Grade: 0–5 (0=blackout, 5=perfect)
// EF = Easiness Factor, starts at 2.5

EF' = EF + (0.1 − (5−Q) × (0.08 + (5−Q) × 0.02))
EF' = max(1.3, EF')

// Interval:
n=1 → I=1 day
n=2 → I=6 days
n>2 → I = I_prev × EF

// If Q < 3: reset to n=0, I=1
```

SM-2 weaknesses vs FSRS:
- No explicit retrievability tracking
- All cards start with identical EF=2.5 (no per-item difficulty seeding)
- Exponential growth without bound (overestimates at long intervals)
- No handling of overdue cards

---

## 6. Optimal Scheduling Science (Cepeda et al., 2008)

Landmark study (N=1,350+):
- Optimal gap ≈ **20% of desired retention interval** for short periods (weeks)
- Decreases to ≈ **5%** for long periods (one year)
- Expanding intervals beat fixed intervals and far beat massed practice
- Reviewing at R=90% maximizes learning per minute of study time

---

## 7. Ear Training Specific Research Findings

### The Good News
The spacing effect is **strong for the labeling/categorization task** — hearing a sound and naming it. This is exactly what pitch recognition does. FSRS applies fully.

### The Nuance
Spacing is weaker (or absent) for low-level perceptual discrimination (e.g., "can you hear these two frequencies are different?"). That's not what we're training — we're training symbol-to-percept mapping (interval name → sound).

### Sleep Consolidation
Post-training sleep produces measurable gains in auditory pitch memory. **Implication:** first review should be the *next day*, not the same session, to allow sleep consolidation.

### Interleaving
Mixing different intervals during a session (C4 → E4 → G4 → C4...) beats blocking by type (all C4s, then all E4s). Interleaving forces discrimination and prevents context overfitting.

### Confusion Pairs
Some intervals are acoustically confusable regardless of training:
- Minor 2nd ↔ Major 2nd
- Minor 3rd ↔ Major 3rd
- Perfect 4th ↔ Tritone
- Perfect 5th ↔ Minor 6th

These pairs should be tracked and scheduled close together deliberately for discrimination training.

---

## 8. Pre-Seeded Difficulty Values for Pitch Recognition

Before any review history exists, seed initial D based on known perceptual difficulty:

| Note / Interval | Pre-Seeded D | Reason |
|---|---|---|
| C4 (reference / tonic) | 2 | Most salient, learned first |
| A4 (perfect 5th from D) | 3 | Common, sonorous |
| G4 (perfect 5th from C) | 3 | |
| E4 (major 3rd) | 4 | |
| D4 (major 2nd) | 5 | Close to C, easily confused |
| F4 (perfect 4th) | 5 | |
| B4 (major 7th) | 6 | Dissonant, unusual |
| C5 (octave) | 4 | Obvious to experienced, hard for beginners |

For full chromatic interval training, add:
| Interval | Pre-Seeded D |
|---|---|
| Tritone (aug 4th) | 8 | Most confusable |
| Minor 2nd | 7 | |
| Minor 7th | 6 | |
| Major 7th | 7 | |

---

## 9. Learning Phase Design (New Items)

New items should go through a **learning phase** before entering the main FSRS queue:

1. Item introduced for first time
2. Play note → user answers
3. If wrong: immediate corrective feedback, replay, ask again (same session)
4. If correct twice in same session: **graduate to FSRS** with `S₀(Good)` ≈ 3.7 days
5. First FSRS review scheduled **next day** minimum (sleep consolidation)
6. If correct only once: schedule for later in same session

This mirrors Anki's "learning steps" (1min → 10min → graduate).

---

## 10. Implementation Plan for PitchRecognition.tsx

### Per-Note State Structure
```typescript
interface NoteMemory {
  note: string          // e.g. "C4"
  S: number             // stability in days
  D: number             // difficulty 1–10
  due: number           // timestamp when next review is due
  lastReview: number    // timestamp of last review
  lapses: number        // total times forgotten
  phase: 'learning' | 'review'  // learning phase vs main queue
  learningStep: number  // 0, 1 = learning; 2+ = graduated
}
```

### Scheduling Logic
```typescript
function scheduleNext(mem: NoteMemory, grade: 1|2|3|4): NoteMemory {
  const now = Date.now()
  const t = (now - mem.lastReview) / 86400000  // days since last review
  const R = retrievability(t, mem.S)

  let newS: number
  let newD: number = updateDifficulty(mem.D, grade)

  if (grade === 1) {
    newS = stabilityAfterLapse(mem.S, mem.D, R)
  } else {
    newS = stabilityAfterRecall(mem.S, mem.D, R, grade)
  }

  const interval = nextInterval(newS, 0.90)  // 90% desired retention
  const due = now + interval * 86400000

  return { ...mem, S: newS, D: newD, due, lastReview: now }
}
```

### Response Latency → Grade
```typescript
function autoGrade(correct: boolean, latencyMs: number): 1|2|3|4 {
  if (!correct) return 1
  if (latencyMs > 4000) return 2   // Hard
  if (latencyMs > 1500) return 3   // Good
  return 4                          // Easy
}
```

### Display: Real Retrievability
Instead of showing vague "accuracy" percentages, the UI can show actual R values — e.g. a note card showing "87% recall confidence" based on the real forgetting curve.

---

## 11. Gamification Integration Strategy

**Core principle:** The FSRS scheduler determines *which* notes need attention. The game determines *how* the user encounters them.

The game is a **skin on top of the SRS engine**:
- SRS generates the queue: "C4 is due, E4 is due, G4 is 3 days overdue"
- Game translates the queue into gameplay events: "you encounter a door, you must name the note to open it"
- User's performance grades the review (correct/incorrect + latency)
- SRS updates the schedule

The game difficulty auto-adjusts because the SRS queue composition changes:
- Early learner: mostly learning-phase notes (frequent, basic notes)
- Intermediate: a mix of well-known and struggling notes
- Advanced: only genuinely hard items remain frequent; easy ones drift to long intervals

**Ideas discussed for gamification:**
- Maze game: encounter a door → hear a note → name it to open the door
- Difficulty of maze could correlate with how many overdue/hard notes are in the queue
- Wrong answers → "monster" appears or path closes
- Correct answers → progress through the maze

---

## 12. Sources

- SM-2 Algorithm: https://super-memory.com/archive/help16/smalg.htm
- FSRS Algorithm Full Spec: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
- FSRS Technical Explanation: https://expertium.github.io/Algorithm.html
- Implementing FSRS in 100 Lines: https://borretti.me/article/implementing-fsrs-in-100-lines
- SM-17 Algorithm: https://supermemo.guru/wiki/Algorithm_SM-17
- Cepeda et al. 2008 (Optimal Retention): https://www.yorku.ca/ncepeda/publications/CVRWP2008.html
- Duolingo HLR: https://research.duolingo.com/papers/settles.acl16.pdf
- Auditory Training Spacing Study (PMC5829807): https://pmc.ncbi.nlm.nih.gov/articles/PMC5829807/
- Sleep + Auditory Pitch Memory (PMC4234907): https://pmc.ncbi.nlm.nih.gov/articles/PMC4234907/
- Song Learning Spacing Effect (PMC8665960): https://pmc.ncbi.nlm.nih.gov/articles/PMC8665960/
- Anki FSRS FAQ: https://faqs.ankiweb.net/what-spaced-repetition-algorithm
