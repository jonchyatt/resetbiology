import {
  autoGrade,
  createNote,
  reviewNote,
  type NoteMemory,
} from './fsrs'

export const FSRS_VOICE_KEY = 'pitch_fsrs_memory'
export const FSRS_EAR_KEY = 'pitch_fsrs_memory_ear'
export const FSRS_VOICE_DEBUG_KEY = 'pitch_fsrs_memory_debug'
export const FSRS_EAR_DEBUG_KEY = 'pitch_fsrs_memory_ear_debug'

const dirtyLoad = new Map<string, boolean>()

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNoteMemory(value: unknown): value is NoteMemory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const note = value as Record<string, unknown>
  return typeof note.note === 'string'
    && isFiniteNumber(note.S)
    && isFiniteNumber(note.D)
    && isFiniteNumber(note.due)
    && isFiniteNumber(note.lastReview)
    && isFiniteNumber(note.lapses)
    && (note.phase === 'new' || note.phase === 'learning' || note.phase === 'review')
    && isFiniteNumber(note.learningReps)
}

function isStore(value: unknown): value is Record<string, NoteMemory> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every(isNoteMemory)
}

/** Parse one family store without ever consulting or copying another key. */
export function migrate(key: string, raw: string | null): Record<string, NoteMemory> {
  void key
  if (raw === null) return {}
  const parsed: unknown = JSON.parse(raw)
  if (!isStore(parsed)) throw new Error('Invalid FSRS family store')
  return parsed
}

/**
 * Corrupt data remains recoverable: gameplay receives an empty store, while the
 * original bytes stay at the source key and are mirrored to `<key>.bak`.
 */
export function loadStore(key: string): Record<string, NoteMemory> {
  if (typeof localStorage === 'undefined') {
    dirtyLoad.set(key, false)
    return {}
  }

  let raw: string | null = null
  try {
    raw = localStorage.getItem(key)
    const store = migrate(key, raw)
    dirtyLoad.set(key, false)
    return store
  } catch {
    dirtyLoad.set(key, true)
    if (raw !== null) {
      try { localStorage.setItem(`${key}.bak`, raw) } catch {}
    }
    return {}
  }
}

/** Refuse to turn a corruption fallback into a silent progress wipe. */
export function saveStore(key: string, store: Record<string, NoteMemory>): boolean {
  if (dirtyLoad.get(key) || typeof localStorage === 'undefined') return false
  try {
    localStorage.setItem(key, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

function gradeStore(
  key: string,
  store: Record<string, NoteMemory>,
  note: string,
  correct: boolean,
  latencyMs: number,
): NoteMemory {
  const reviewed = reviewNote(store[note] ?? createNote(note), autoGrade(correct, latencyMs))
  store[note] = reviewed
  dirtyLoad.set(key, false)
  return reviewed
}

export function gradeVoice(
  store: Record<string, NoteMemory>,
  note: string,
  correct: boolean,
  latencyMs: number,
): NoteMemory {
  return gradeStore(FSRS_VOICE_KEY, store, note, correct, latencyMs)
}

export function gradeEar(
  store: Record<string, NoteMemory>,
  note: string,
  correct: boolean,
  latencyMs: number,
): NoteMemory {
  return gradeStore(FSRS_EAR_KEY, store, note, correct, latencyMs)
}
