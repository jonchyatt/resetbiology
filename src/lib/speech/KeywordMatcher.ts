// src/lib/speech/KeywordMatcher.ts

export type VoiceAnswer =
  | { type: 'direction'; value: 'up' | 'down' | 'left' | 'right' }
  | { type: 'letter'; value: string }
  | { type: 'note'; value: string }
  | null

// Direction synonyms — Whisper often transcribes these variants
const DIRECTION_MAP: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  up: 'up', top: 'up', above: 'up', app: 'up', uhp: 'up', uh: 'up',
  down: 'down', bottom: 'down', below: 'down', don: 'down', doubt: 'down',
  left: 'left', lift: 'left', laughed: 'left', lft: 'left',
  right: 'right', write: 'right', wright: 'right', rite: 'right', light: 'right', ride: 'right',
}

// Letters used in the Snellen chart — map phonetic variants
// The chart uses: O, Q, C, D, H, M, N, K, X, R, S, Z, V
const LETTER_MAP: Record<string, string> = {
  o: 'O', oh: 'O', zero: 'O',
  q: 'Q', cue: 'Q', queue: 'Q', cute: 'Q',
  c: 'C', see: 'C', sea: 'C', si: 'C',
  d: 'D', dee: 'D', the: 'D',
  h: 'H', age: 'H', ache: 'H', aitch: 'H',
  m: 'M', em: 'M', am: 'M',
  n: 'N', en: 'N', and: 'N', in: 'N',
  k: 'K', kay: 'K', okay: 'K', cake: 'K',
  x: 'X', ex: 'X', acts: 'X', eggs: 'X',
  r: 'R', are: 'R', our: 'R', er: 'R',
  s: 'S', es: 'S', as: 'S', ass: 'S', yes: 'S',
  z: 'Z', zee: 'Z', zed: 'Z', said: 'Z',
  v: 'V', vee: 'V', we: 'V', ve: 'V', bee: 'V',
}

// Piano note phonetic mappings — covers all 8 notes used in pitch training
// Strategy: single-letter shorthand AND letter+number AND spoken phonetics
// Uses multi-word keys (checked before single-word) so "see four" beats "see"→C
const NOTE_MAP: Record<string, string> = {
  // ── C4 ──
  'c4': 'C4', 'see four': 'C4', 'sea four': 'C4', 'c four': 'C4', 'c-4': 'C4',
  'c': 'C4', 'see': 'C4', 'sea': 'C4', 'si': 'C4',

  // ── D4 ──
  'd4': 'D4', 'dee four': 'D4', 'd four': 'D4', 'd-4': 'D4',
  'd': 'D4', 'dee': 'D4', 'de': 'D4',

  // ── E4 ──
  'e4': 'E4', 'e four': 'E4', 'ee four': 'E4', 'e-4': 'E4',
  'e': 'E4', 'ee': 'E4',

  // ── F4 ──
  'f4': 'F4', 'ef four': 'F4', 'eff four': 'F4', 'f four': 'F4', 'f-4': 'F4',
  'f': 'F4', 'ef': 'F4', 'eff': 'F4',

  // ── G4 ──
  'g4': 'G4', 'gee four': 'G4', 'g four': 'G4', 'g-4': 'G4',
  'g': 'G4', 'gee': 'G4', 'ji': 'G4', 'jee': 'G4',

  // ── A4 ──
  'a4': 'A4', 'a four': 'A4', 'ay four': 'A4', 'eh four': 'A4', 'a-4': 'A4',
  'a': 'A4', 'ay': 'A4', 'eh': 'A4',

  // ── B4 — HARDEST: "B" sounds like "be/bee/before" ──
  'b4': 'B4', 'bee four': 'B4', 'be four': 'B4', 'b four': 'B4', 'b-4': 'B4',
  'before': 'B4',   // classic Web Speech transcription of "B-Four" spoken quickly
  'b': 'B4', 'bee': 'B4', 'be': 'B4',

  // ── C5 — must come after C4 entries; multi-word checked first ──
  'c5': 'C5', 'see five': 'C5', 'sea five': 'C5', 'c five': 'C5', 'c-5': 'C5',
  'high c': 'C5', 'high see': 'C5', 'high sea': 'C5',
}

/**
 * Match a Web Speech transcript to a valid answer.
 *
 * For 'notes' mode, tries progressively narrower matches:
 *   1. Full cleaned transcript  (catches "before" → B4, "high c" → C5)
 *   2. Last two words joined    (catches "see four" → C4, "bee four" → B4)
 *   3. Last word alone          (catches "e4", "gee", single letters)
 *   4. Second-to-last word      (catches filler at end like "gee um")
 */
export function matchTranscript(
  transcript: string,
  mode: 'e-directional' | 'letters' | 'notes'
): VoiceAnswer {
  const cleaned = transcript.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '')
  if (!cleaned) return null

  const words = cleaned.split(/\s+/)
  const lastWord = words[words.length - 1]

  if (mode === 'e-directional') {
    const dir = DIRECTION_MAP[lastWord]
    if (dir) return { type: 'direction', value: dir }
    if (words.length >= 2) {
      const prevWord = words[words.length - 2]
      const dir2 = DIRECTION_MAP[prevWord]
      if (dir2) return { type: 'direction', value: dir2 }
    }
    return null
  }

  if (mode === 'letters') {
    if (lastWord.length === 1 && LETTER_MAP[lastWord]) {
      return { type: 'letter', value: LETTER_MAP[lastWord] }
    }
    const letter = LETTER_MAP[lastWord]
    if (letter) return { type: 'letter', value: letter }
    if (words.length >= 2) {
      const prevWord = words[words.length - 2]
      if (prevWord.length === 1 && LETTER_MAP[prevWord]) {
        return { type: 'letter', value: LETTER_MAP[prevWord] }
      }
      const letter2 = LETTER_MAP[prevWord]
      if (letter2) return { type: 'letter', value: letter2 }
    }
    return null
  }

  if (mode === 'notes') {
    // 1. Full transcript (handles "before", "high c", etc.)
    const full = words.join(' ')
    if (NOTE_MAP[full]) return { type: 'note', value: NOTE_MAP[full] }

    // 2. Last two words (handles "see four", "bee four", "high c")
    if (words.length >= 2) {
      const lastTwo = words.slice(-2).join(' ')
      if (NOTE_MAP[lastTwo]) return { type: 'note', value: NOTE_MAP[lastTwo] }
    }

    // 3. Last word (handles "e4", "gee", "c5", single letter)
    if (NOTE_MAP[lastWord]) return { type: 'note', value: NOTE_MAP[lastWord] }

    // 4. Second-to-last word (filler at end: "gee uh" → G4)
    if (words.length >= 2) {
      const prev = words[words.length - 2]
      if (NOTE_MAP[prev]) return { type: 'note', value: NOTE_MAP[prev] }
    }

    return null
  }

  return null
}
