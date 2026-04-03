// src/lib/fsrs.ts
// FSRS-4.5 spaced repetition engine for pitch recognition training.
// Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm

// Default FSRS-4.5 parameter weights (w0–w16)
export const W = [
  0.4072, 1.1829, 3.1262, 15.4722,  // w0-w3: initial stability per grade (Again/Hard/Good/Easy)
  7.2102, 0.5316, 1.0651, 0.0589,   // w4-w7: difficulty init + mean-reversion
  1.5060, 0.1544, 1.0040, 1.9813,   // w8-w11: stability recall + lapse formulas
  0.0953, 0.2975, 2.2042,            // w12-w14: lapse formula (continued)
  0.2407, 2.9466,                    // w15-w16: Hard modifier, Easy modifier
]

// ─── Types ────────────────────────────────────────────────────────────────────

export type FsrsGrade = 1 | 2 | 3 | 4  // 1=Again 2=Hard 3=Good 4=Easy

export interface NoteMemory {
  note: string
  S: number            // stability — days until recall probability = 90%
  D: number            // difficulty — [1–10], lower = easier, grows less stable per review
  due: number          // Date.now() ms when next review is scheduled
  lastReview: number   // Date.now() ms of last review (0 = never reviewed)
  lapses: number       // lifetime count of "Again" (forgot) responses
  phase: 'new' | 'learning' | 'review'
  learningReps: number // consecutive correct in current learning phase (needs 2 to graduate)
}

// ─── Synesthesia color map ────────────────────────────────────────────────────
// Each note → an HSL hue. Intensity driven by FSRS retrievability at runtime.
// Based on documented synesthesia associations + Western music color tradition.
export const NOTE_COLORS: Record<string, { hue: number; name: string }> = {
  // Octave 3 — related hues to octave 4 (same letter = similar color family)
  'C3': { hue: 350, name: 'Ruby'     },
  'D3': { hue: 20,  name: 'Rust'     },
  'E3': { hue: 50,  name: 'Bronze'   },
  'F3': { hue: 130, name: 'Forest'   },
  'G3': { hue: 175, name: 'Teal'     },
  'A3': { hue: 210, name: 'Steel'    },
  'B3': { hue: 260, name: 'Indigo'   },
  // Octave 4
  'C4': { hue: 0,   name: 'Crimson'  },
  'D4': { hue: 30,  name: 'Amber'    },
  'E4': { hue: 60,  name: 'Gold'     },
  'F4': { hue: 140, name: 'Emerald'  },
  'G4': { hue: 185, name: 'Cyan'     },
  'A4': { hue: 220, name: 'Cobalt'   },
  'B4': { hue: 270, name: 'Violet'   },
  'C5': { hue: 320, name: 'Rose'     },
}

// Pre-seeded difficulty before any review history (based on perceptual research)
// Lower D = easier to build stable memory for; higher D = more review sessions needed
export const SEED_DIFFICULTY: Record<string, number> = {
  'C4': 2,  // tonic reference — easiest
  'A4': 3,  // perfect 5th above D — very salient
  'G4': 3,  // perfect 5th above C — strong
  'E4': 4,  // major 3rd
  'D4': 5,  // major 2nd — close to C, easily confused
  'F4': 5,  // perfect 4th
  'C5': 4,  // octave — obvious once reference is learned
  'B4': 6,  // major 7th — dissonant, unusual
  // Octave 3 — harder because cross-octave discrimination is advanced
  'C3': 5,  'D3': 6,  'E3': 6,  'F3': 7,
  'G3': 5,  'A3': 5,  'B3': 7,
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Power-law forgetting curve.
 * R = 1.0 at t=0 (just reviewed), R = 0.9 at t=S (definition of stability).
 */
export function retrievability(daysSinceLast: number, S: number): number {
  if (S <= 0) return 1
  return Math.pow(1 + (19 / 81) * daysSinceLast / S, -0.5)
}

/** Scheduled interval in days (at 90% desired retention: interval = stability) */
export function nextIntervalDays(S: number): number {
  return Math.max(1, Math.round(S))
}

function initialS(grade: FsrsGrade): number { return W[grade - 1] }

function initialD(grade: FsrsGrade): number {
  return clamp(W[4] - Math.exp(W[5] * (grade - 1)) + 1, 1, 10)
}

function updateDifficulty(D: number, grade: FsrsGrade): number {
  const delta = -W[6] * (grade - 3)
  const d1 = D + delta * (10 - D) / 9
  return clamp(W[7] * initialD(4) + (1 - W[7]) * d1, 1, 10)
}

function stabilityAfterRecall(S: number, D: number, R: number, grade: 2 | 3 | 4): number {
  const mod = grade === 2 ? W[15] : grade === 4 ? W[16] : 1
  const gain = Math.exp(W[8]) * (11 - D) * Math.pow(Math.max(S, 0.1), -W[9])
             * (Math.exp(W[10] * (1 - R)) - 1) * mod
  return Math.max(S * (gain + 1), S)   // stability only goes up on recall
}

function stabilityAfterLapse(S: number, D: number, R: number): number {
  return W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createNote(note: string): NoteMemory {
  return {
    note,
    S: 0,
    D: SEED_DIFFICULTY[note] ?? 5,
    due: Date.now(),
    lastReview: 0,
    lapses: 0,
    phase: 'new',
    learningReps: 0,
  }
}

/** Process a review and return the updated NoteMemory */
export function reviewNote(mem: NoteMemory, grade: FsrsGrade): NoteMemory {
  const now = Date.now()
  const daysSince = mem.lastReview > 0 ? (now - mem.lastReview) / 86400000 : 0
  const R = mem.S > 0 ? retrievability(daysSince, mem.S) : 1
  const newD = updateDifficulty(mem.D, grade)

  // ── Learning / New phase ──────────────────────────────────────────────────
  if (mem.phase === 'new' || mem.phase === 'learning') {
    if (grade === 1) {
      // Failed — reset reps, retry in 10 minutes
      return {
        ...mem, D: newD, S: initialS(1),
        due: now + 10 * 60 * 1000,
        lastReview: now, phase: 'learning', learningReps: 0,
      }
    }
    const reps = mem.learningReps + 1
    const graduating = reps >= 2
    const newS = initialS(grade)
    return {
      ...mem, D: newD, S: newS,
      due: graduating
        ? now + nextIntervalDays(newS) * 86400000   // real interval from today
        : now + 10 * 60 * 1000,                      // another learning step
      lastReview: now,
      phase: graduating ? 'review' : 'learning',
      learningReps: reps,
    }
  }

  // ── Review phase ─────────────────────────────────────────────────────────
  if (grade === 1) {
    const newS = stabilityAfterLapse(mem.S, mem.D, R)
    return {
      ...mem, D: newD, S: Math.max(newS, 0.1),
      due: now + 10 * 60 * 1000,
      lastReview: now, lapses: mem.lapses + 1, phase: 'learning', learningReps: 0,
    }
  }

  const newS = stabilityAfterRecall(mem.S, mem.D, R, grade as 2 | 3 | 4)
  return {
    ...mem, D: newD, S: newS,
    due: now + nextIntervalDays(newS) * 86400000,
    lastReview: now,
  }
}

/** Auto-classify grade from whether correct and response latency */
export function autoGrade(correct: boolean, latencyMs: number): FsrsGrade {
  if (!correct) return 1
  if (latencyMs > 4000) return 2
  if (latencyMs > 1500) return 3
  return 4
}

/** Current retrievability (0–1) — 1.0 means just reviewed, 0.9 means it's due */
export function currentR(mem: NoteMemory): number {
  if (mem.phase === 'new' || mem.lastReview === 0) return 0.95
  const days = (Date.now() - mem.lastReview) / 86400000
  return retrievability(days, mem.S)
}

/** Pick which note to show next — prioritises overdue, then lowest R */
export function pickNextNote(
  pool: string[],
  memory: Record<string, NoteMemory>,
  exclude: string | null,
): string {
  const candidates = pool.length > 1 ? pool.filter(n => n !== exclude) : pool
  const now = Date.now()

  // Overdue notes first (due < now)
  const overdue = candidates.filter(n => (memory[n]?.due ?? 0) < now)
  if (overdue.length > 0) {
    // Lowest R among overdue = most urgent
    return overdue.reduce((a, b) =>
      (currentR(memory[a] ?? createNote(a))) < (currentR(memory[b] ?? createNote(b))) ? a : b
    )
  }

  // No overdue — weighted random by inverse R (low R = more likely)
  const weights = candidates.map(n => {
    const r = currentR(memory[n] ?? createNote(n))
    return Math.max(0.2, 1 - r + 0.1)
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let rand = Math.random() * total
  for (let i = 0; i < candidates.length; i++) {
    rand -= weights[i]
    if (rand <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

/** XP earned for a correct answer */
export function calcXP(grade: FsrsGrade, streak: number): number {
  const base = 10
  const gradeBonus = grade === 4 ? 1.5 : grade === 2 ? 0.8 : 1.0
  const multiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1
  return Math.round(base * gradeBonus * multiplier)
}
