// ─── composerExtract — read pd_composed_* compositions in any format ──────
//
// Composer's data shape evolved. The CURRENT format is `comp.measures[]` with
// each measure holding an array of MNote objects (`keys`, `accidentals`,
// `duration`, `dotted`, `tripletGroup`, etc.). The LEGACY format had a flat
// `comp.notes` array with `semitones`, `pitchName`, `beats` fields directly
// on each note.
//
// Synthesia migrated to the new format. NoteRunner and ChoirPractice did NOT,
// so they reported "bad format" when reading compositions saved by the
// modern Composer. This module is the single source of truth for extracting
// a playable melody line from EITHER format. Every consumer of `pd_composed_*`
// should call extractMelodyFromComposition() and stop hand-rolling parsers.
//
// 2026-04-08 — created during the great composer-format-mismatch fix.

export interface ExtractedNote {
  /** Semitones from C4 (negative = below middle C, positive = above) */
  semi: number
  /** Duration in beats (1 = quarter note, 0.5 = eighth, 4 = whole, etc.) */
  beats: number
  /** Scientific pitch name e.g. "C4", "F#5", "Bb3" */
  pitchName: string
  /** True for rest events; semi/pitchName are meaningless when true */
  isRest: boolean
  /** Optional syllable shown under the note (Composer's `lyric` field) */
  lyric?: string
  /** Which measure this note came from (1-indexed for human display) */
  measureIdx: number
  /** Cumulative beat offset from the start of the song (sum of preceding beats) */
  beatOffset: number
}

const DUR_BEATS: Record<string, number> = {
  w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25, '32': 0.125,
}

const STEP_TO_SEMI: Record<string, number> = {
  c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
}

const SEMI_TO_NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * Convert a VexFlow key like "c/4" or "f#/5" to semitones from C4.
 * Honors both inline accidentals and the per-key Accid array.
 */
function vexKeyToSemiC4(key: string, accidental?: string): number {
  const m = key.match(/^([a-g])(#|b)?\/(-?\d+)$/i)
  if (!m) return 0
  const step = m[1].toLowerCase()
  const inline = m[2]
  const oct = parseInt(m[3], 10)
  let semi = (STEP_TO_SEMI[step] ?? 0) + (oct - 4) * 12
  if (inline === '#') semi += 1
  if (inline === 'b') semi -= 1
  if (accidental === '#') semi += 1
  if (accidental === 'b') semi -= 1
  // Handle double sharp/flat from Composer's Accid type
  if (accidental === '##') semi += 2
  if (accidental === 'bb') semi -= 2
  return semi
}

/** semitones-from-C4 → scientific pitch name (e.g. 0 → "C4", 14 → "D5") */
function semiToPitchName(semi: number): string {
  const idx = ((Math.round(semi) % 12) + 12) % 12
  const oct = 4 + Math.floor(semi / 12)
  return `${SEMI_TO_NAME[idx]}${oct}`
}

/**
 * Extract a melody line from a Composer-saved composition. Returns an empty
 * array if the composition has neither `measures` nor a flat `notes` array.
 *
 * Behavior:
 * - For chords (multiple keys per MNote), takes the TOPMOST pitch (melody line).
 * - Honors `dotted` (×1.5) and `tripletGroup` (×2/3) duration modifiers.
 * - **Includes rests** by default — pass `{ skipRests: true }` for melody-only.
 * - Computes `beatOffset` cumulatively so consumers can position notes in time
 *   without re-walking the array.
 * - Tolerates the legacy flat `comp.notes` format as a fallback (returns the
 *   same shape so consumers don't need separate code paths).
 */
export function extractMelodyFromComposition(
  comp: any,
  opts: { skipRests?: boolean } = {},
): ExtractedNote[] {
  const skipRests = opts.skipRests === true
  const out: ExtractedNote[] = []
  let beatOffset = 0

  // ── New canonical format: walk measures → notes ──
  if (comp && Array.isArray(comp.measures)) {
    for (let mi = 0; mi < comp.measures.length; mi++) {
      const m = comp.measures[mi]
      if (!Array.isArray(m?.notes)) continue
      for (const n of m.notes) {
        // Compute the duration first so even rests advance time correctly
        let beats = DUR_BEATS[n.duration] ?? 1
        if (n.dotted) beats *= 1.5
        if (n.tripletGroup != null) beats *= 2 / 3

        const isRest = n.isRest === true
        if (isRest) {
          if (!skipRests) {
            out.push({
              semi: 0,
              beats,
              pitchName: '',
              isRest: true,
              lyric: n.lyric,
              measureIdx: mi + 1,
              beatOffset,
            })
          }
          beatOffset += beats
          continue
        }

        if (!Array.isArray(n.keys) || n.keys.length === 0) {
          // Malformed note — skip but advance time
          beatOffset += beats
          continue
        }

        // Topmost pitch in a chord = melody line
        let bestSemi = -Infinity
        for (let i = 0; i < n.keys.length; i++) {
          const s = vexKeyToSemiC4(n.keys[i], n.accidentals?.[i])
          if (s > bestSemi) bestSemi = s
        }

        out.push({
          semi: bestSemi,
          beats,
          pitchName: semiToPitchName(bestSemi),
          isRest: false,
          lyric: n.lyric,
          measureIdx: mi + 1,
          beatOffset,
        })
        beatOffset += beats
      }
    }
    return out
  }

  // ── Legacy flat format kept as fallback ──
  if (comp && Array.isArray(comp.notes)) {
    for (const n of comp.notes) {
      const beats = typeof n.beats === 'number' ? n.beats : 1
      const isRest = n.isRest === true
      if (isRest && skipRests) {
        beatOffset += beats
        continue
      }
      const semi = typeof n.semitones === 'number' ? n.semitones : 0
      out.push({
        semi,
        beats,
        pitchName: n.pitchName || semiToPitchName(semi),
        isRest,
        lyric: n.lyric,
        measureIdx: 1,
        beatOffset,
      })
      beatOffset += beats
    }
    return out
  }

  return out
}

/**
 * Quick existence check — returns true if the composition has any playable
 * notes in either format. Used by song pickers to filter out empty saves.
 */
export function compositionHasNotes(comp: any): boolean {
  if (!comp) return false
  if (Array.isArray(comp.measures)) {
    for (const m of comp.measures) {
      if (!Array.isArray(m?.notes)) continue
      for (const n of m.notes) {
        if (!n.isRest && Array.isArray(n.keys) && n.keys.length > 0) return true
      }
    }
    return false
  }
  if (Array.isArray(comp.notes) && comp.notes.length > 0) return true
  return false
}
