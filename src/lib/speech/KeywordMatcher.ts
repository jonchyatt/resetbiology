// src/lib/speech/KeywordMatcher.ts

export type VoiceAnswer =
  | { type: 'direction'; value: 'up' | 'down' | 'left' | 'right' }
  | { type: 'letter'; value: string }
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

/**
 * Match a Whisper transcript to a valid chart answer.
 * Extracts the LAST word (most recent utterance) and fuzzy-matches it.
 *
 * @param mode - 'e-directional' matches directions, 'letters' matches letter names
 */
export function matchTranscript(
  transcript: string,
  mode: 'e-directional' | 'letters'
): VoiceAnswer {
  const cleaned = transcript.trim().toLowerCase().replace(/[^a-z\s]/g, '')
  if (!cleaned) return null

  const words = cleaned.split(/\s+/)
  const lastWord = words[words.length - 1]

  if (mode === 'e-directional') {
    const dir = DIRECTION_MAP[lastWord]
    if (dir) return { type: 'direction', value: dir }
    // Also check second-to-last word in case of filler
    if (words.length >= 2) {
      const prevWord = words[words.length - 2]
      const dir2 = DIRECTION_MAP[prevWord]
      if (dir2) return { type: 'direction', value: dir2 }
    }
    return null
  }

  // Letter mode — check last word, also try single-char match
  if (mode === 'letters') {
    // Direct single-letter match (Whisper sometimes returns just "B")
    if (lastWord.length === 1 && LETTER_MAP[lastWord]) {
      return { type: 'letter', value: LETTER_MAP[lastWord] }
    }
    // Phonetic match
    const letter = LETTER_MAP[lastWord]
    if (letter) return { type: 'letter', value: letter }
    // Check previous word
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

  return null
}
