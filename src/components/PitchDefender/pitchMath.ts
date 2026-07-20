// ─── pitchMath — shared frequency / cents helpers ──────────────────────────
//
// Used by every game that runs a "sing the target note" charge mechanic
// (RetroBlaster, DrillMode, and the singing games to come). The math is
// trivial; the value of this file is having ONE definition of "what does
// 'how far off pitch is the singer' mean" so games stay consistent.
//
// Octave-folded cents = how far off the singer is from the target, ignoring
// which octave they sang in. A kid singing C5 to a C4 target reads 0 cents.

const NOTE_NAMES_CHROMA = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const NOTE_FREQ_LOOKUP: Record<string, number> = {}
for (let octave = 2; octave <= 6; octave++) {
  for (let i = 0; i < 12; i++) {
    NOTE_FREQ_LOOKUP[`${NOTE_NAMES_CHROMA[i]}${octave}`] =
      440 * Math.pow(2, (octave - 4) + (i - 9) / 12)
  }
}

export function noteToFreq(name: string): number {
  return NOTE_FREQ_LOOKUP[name] ?? 440
}

/**
 * Absolute signed cents distance between two frequencies. Unlike
 * octaveFoldedCents, this preserves octave displacement: C3 against a C4
 * target is -1200 cents and C5 is +1200 cents.
 */
export function exactCents(detectedFreq: number, targetFreq: number): number {
  if (detectedFreq <= 0 || targetFreq <= 0) return 0
  return 1200 * Math.log2(detectedFreq / targetFreq)
}

export type ExactPitchSampleState = 'unavailable' | 'match' | 'wrong'

interface PitchSampleObservation {
  frequency: number
  confidence: number
  isActive: boolean
}

export function exactPitchSampleState(
  source: PitchSampleObservation | null | undefined,
  targetFreq: number,
  confidenceFloor: number,
  toleranceCents: number,
): ExactPitchSampleState {
  if (!source?.isActive || source.confidence < confidenceFloor || source.frequency <= 0 || targetFreq <= 0) {
    return 'unavailable'
  }
  return Math.abs(exactCents(source.frequency, targetFreq)) <= toleranceCents ? 'match' : 'wrong'
}

interface ExactPitchHoldState {
  heldMs: number
  matched: boolean
}

export function advanceExactPitchHold(
  current: ExactPitchHoldState,
  sampleState: ExactPitchSampleState,
  deltaMs: number,
  requiredHoldMs: number,
): ExactPitchHoldState {
  if (current.matched || sampleState === 'unavailable') return current
  if (sampleState === 'wrong') return { heldMs: 0, matched: false }

  const required = Math.max(0, requiredHoldMs)
  const heldMs = Math.min(required, Math.max(0, current.heldMs) + Math.max(0, deltaMs))
  return { heldMs, matched: heldMs >= required }
}

/**
 * Cents distance between two frequencies, folded into [-600, 600] so
 * octave-equivalent pitches read as 0. Returns negative if detected is
 * below target (singer is flat), positive if detected is above (sharp).
 */
export function octaveFoldedCents(detectedFreq: number, targetFreq: number): number {
  if (detectedFreq <= 0 || targetFreq <= 0) return 0
  let cents = 1200 * Math.log2(detectedFreq / targetFreq)
  while (cents > 600) cents -= 1200
  while (cents < -600) cents += 1200
  return cents
}

// Default tolerance for "on pitch" detection across all games
export const PITCH_ON_TOLERANCE_CENTS = 50
