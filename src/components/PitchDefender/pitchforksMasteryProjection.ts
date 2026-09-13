import type { NoteMemory } from '../../lib/fsrs'

const MASTERY_SESSION_COUNT = 3

// These are the existing source keys. The projection reads caller-provided
// snapshots only; it never opens either key or creates another one.
const VOICE_MEMORY_SOURCE_KEY = 'pitch_fsrs_memory'
const VOICE_MASTERY_SOURCE_KEY = 'pitchforks3_mastery_progress'

export type PitchforksMasteryRecord = Readonly<{
  sessionIds: readonly string[]
  masteredAt: number | null
}>

export type PitchforksMasteryProjectionInput = Readonly<{
  /** The admitted-note list supplied by the curriculum/read model. */
  admittedNotes?: readonly string[]
  voiceMemory?: Readonly<Record<string, NoteMemory>>
  earMemory?: Readonly<Record<string, NoteMemory>>
  masteryRecords?: Readonly<Record<string, PitchforksMasteryRecord>>
  /** An explicit snapshot time; this function never reads the wall clock. */
  nowMs: number
}>

export type PitchforksMasteryTrackStatus = NoteMemory['phase'] | 'missing' | 'invalid'

export type PitchforksVoiceMasteryEvidence = Readonly<{
  rawSourceKeys: readonly string[]
  sessionIds: readonly string[]
  masteredAt: number | null
}>

export type PitchforksMasteryNoteProjection = Readonly<{
  note: string
  voiceDue: boolean
  voiceStatus: PitchforksMasteryTrackStatus
  earDue: boolean
  earStatus: PitchforksMasteryTrackStatus
  /** Durable VOICE history, deliberately separate from the current due flag. */
  voiceEverMastered: boolean
  voiceMastery: PitchforksVoiceMasteryEvidence
}>

export type PitchforksMasteryProjection = Readonly<{
  notes: readonly PitchforksMasteryNoteProjection[]
  worldClear: boolean
}>

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

// Keep note identity aligned with PitchforksIII's staffNote parser: a letter,
// optional sharp/flat, and a signed integer octave. A loose non-empty-string
// check would let arbitrary keys become admitted curriculum notes.
const NOTE_PATTERN = /^([A-G])([#b]?)(-?\d+)$/

function isPitchforksNote(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = NOTE_PATTERN.exec(value)
  return match !== null && Number.isFinite(Number(match[3]))
}

function isNoteMemory(value: unknown, note: string, nowMs: number): value is NoteMemory {
  if (!isRecord(value)) return false
  return value.note === note
    // createNote starts S at 0; reviewNote keeps stability nonnegative.
    && isFiniteNumber(value.S) && value.S >= 0
    // Difficulty is clamped to [1, 10] by the existing FSRS implementation.
    && isFiniteNumber(value.D) && value.D >= 1 && value.D <= 10
    // Persisted absolute times and counters cannot be negative.
    && isFiniteNumber(value.due) && value.due >= 0
    && isFiniteNumber(value.lastReview)
    && value.lastReview >= 0
    // `0` is the existing never-reviewed sentinel; all real reviews are now
    // or earlier in the caller-provided snapshot.
    && (value.lastReview === 0 || value.lastReview <= nowMs)
    && isFiniteNumber(value.lapses) && Number.isSafeInteger(value.lapses) && value.lapses >= 0
    && (value.phase === 'new' || value.phase === 'learning' || value.phase === 'review')
    && isFiniteNumber(value.learningReps) && Number.isSafeInteger(value.learningReps) && value.learningReps >= 0
}

function dedupeNotes(value: unknown): { notes: string[]; valid: boolean } {
  if (!Array.isArray(value)) return { notes: [], valid: false }

  const notes: string[] = []
  const seen = new Set<string>()
  let valid = true

  for (const candidate of value) {
    if (!isPitchforksNote(candidate)) {
      valid = false
      continue
    }
    if (!seen.has(candidate)) {
      seen.add(candidate)
      notes.push(candidate)
    }
  }

  return { notes, valid }
}

function readTrack(
  store: unknown,
  note: string,
  nowMs: number,
  validNow: boolean,
): Readonly<{ due: boolean; status: PitchforksMasteryTrackStatus }> {
  if (store === undefined) return { due: false, status: 'missing' }
  if (!isRecord(store)) return { due: false, status: 'invalid' }

  if (!Object.prototype.hasOwnProperty.call(store, note)) {
    return { due: false, status: 'missing' }
  }

  const memory = store[note]
  if (!validNow || !isNoteMemory(memory, note, nowMs)) {
    return { due: false, status: 'invalid' }
  }

  return {
    // Keep this aligned with fsrs.pickNextNote's existing overdue boundary.
    due: Number.isFinite(nowMs) && memory.due < nowMs,
    status: memory.phase,
  }
}

function readVoiceMastery(
  records: unknown,
  note: string,
  nowMs: number,
  validNow: boolean,
): Readonly<{ evidence: PitchforksVoiceMasteryEvidence; everMastered: boolean }> {
  const emptyEvidence = (): PitchforksVoiceMasteryEvidence => Object.freeze({
    rawSourceKeys: Object.freeze([VOICE_MEMORY_SOURCE_KEY, VOICE_MASTERY_SOURCE_KEY]),
    sessionIds: Object.freeze([]),
    masteredAt: null,
  })

  if (!isRecord(records) || !Object.prototype.hasOwnProperty.call(records, note)) {
    return { evidence: emptyEvidence(), everMastered: false }
  }

  const candidate = records[note]
  if (!isRecord(candidate) || !Array.isArray(candidate.sessionIds)) {
    return { evidence: emptyEvidence(), everMastered: false }
  }

  const sessionIds: string[] = []
  const seen = new Set<string>()
  let valid = true
  for (const candidateSessionId of candidate.sessionIds) {
    if (typeof candidateSessionId !== 'string' || candidateSessionId.trim().length === 0 || candidateSessionId.trim() !== candidateSessionId) {
      // Ignore unusable IDs in the evidence and fail the crossing closed.
      valid = false
      continue
    }
    if (!seen.has(candidateSessionId)) {
      seen.add(candidateSessionId)
      sessionIds.push(candidateSessionId)
    }
  }

  const rawMasteredAt = candidate.masteredAt
  const masteredAt = rawMasteredAt === null
    ? null
    : isFiniteNumber(rawMasteredAt) && rawMasteredAt >= 0
      ? rawMasteredAt
      : null
  if (rawMasteredAt !== null && masteredAt === null) valid = false

  const evidence: PitchforksVoiceMasteryEvidence = Object.freeze({
    rawSourceKeys: Object.freeze([VOICE_MEMORY_SOURCE_KEY, VOICE_MASTERY_SOURCE_KEY]),
    sessionIds: Object.freeze(sessionIds),
    masteredAt,
  })

  // masteredAt is the durable crossing receipt. Do not make a currently due
  // or lapsed NoteMemory erase that earned history. The receipt still needs
  // the three distinct, usable sessions required by the ratified Q1 rule.
  const everMastered = valid
    && validNow
    && masteredAt !== null
    && masteredAt <= nowMs
    && sessionIds.length >= MASTERY_SESSION_COUNT

  return { evidence, everMastered }
}

/**
 * Project the caller's already-loaded Pitchforks snapshots into read-only
 * per-note state. VOICE mastery is historical receipt evidence; EAR has no
 * mastery ledger yet and is therefore represented only by its own FSRS state.
 */
export function projectPitchforksMastery(
  input: PitchforksMasteryProjectionInput,
): PitchforksMasteryProjection {
  const rawNotes = Array.isArray(input?.admittedNotes)
    ? input.admittedNotes
    : undefined
  const { notes: admittedNotes, valid: validNoteList } = dedupeNotes(rawNotes)
  const nowMs = input?.nowMs
  const validNow = Number.isFinite(nowMs) && nowMs >= 0

  const projectedNotes = admittedNotes.map(note => {
    const voice = readTrack(input?.voiceMemory, note, nowMs, validNow)
    const ear = readTrack(input?.earMemory, note, nowMs, validNow)
    const voiceMastery = readVoiceMastery(input?.masteryRecords, note, nowMs, validNow)

    return Object.freeze({
      note,
      voiceDue: voice.due,
      voiceStatus: voice.status,
      earDue: ear.due,
      earStatus: ear.status,
      voiceEverMastered: voiceMastery.everMastered,
      voiceMastery: voiceMastery.evidence,
    })
  })

  // Q4 is every admitted note, not an empty-list shortcut. EAR does not enter
  // this predicate because no EAR mastered receipt/session ledger exists. A
  // durable receipt preserves earned history, but a corrupt/missing VOICE
  // snapshot cannot be used to assert a current world-clear read model.
  const worldClear = validNoteList
    && validNow
    && admittedNotes.length > 0
    && projectedNotes.every(note => note.voiceEverMastered
      && note.voiceStatus !== 'missing'
      && note.voiceStatus !== 'invalid')

  return Object.freeze({
    notes: Object.freeze(projectedNotes),
    worldClear,
  })
}
