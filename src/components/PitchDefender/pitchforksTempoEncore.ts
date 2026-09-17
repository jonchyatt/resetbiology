import type { PitchforksMasteryProjection } from './pitchforksMasteryProjection'
import type { SongcraftPracticeState } from './pitchforksSongcraftPractice'
import { isSongcraftPhraseProvenance, type SongcraftPhrase } from './pitchforksSongcraftPhrase'
import { PITCHFORKS_RANGE_NOTES } from './pitchforksRange'

/** Practice limits, not device-latency or timing-success bounds. */
export const TEMPO_ENCORE_LIMITS = Object.freeze({ minBpm: 30, maxBpm: 180, maxOccurrences: 256, maxDurationMs: 600_000 })

/** Existing note mastery plus this exact untimed attempt; no phrase certificate. */
export function canEnterTempoEncore(
  phrase: SongcraftPhrase,
  completed: SongcraftPracticeState | null,
  mastery?: PitchforksMasteryProjection,
): boolean {
  if (!completed || completed.status !== 'complete'
    || !completed.summary.unaidedComplete || !completed.summary.masteryEligible
    || completed.summary.assisted || !completed.summary.traversalComplete
    || !isSongcraftPhraseProvenance(phrase.provenance)
    || !/^[a-f0-9]{64}$/i.test(phrase.sourceSha256)
    || phrase.sourceKey !== completed.phrase.sourceKey
    || phrase.sourceSha256 !== completed.phrase.sourceSha256
    || phrase.provenance.normalizationVersion !== completed.phrase.provenance.normalizationVersion
    || phrase.occurrences.length !== completed.phrase.occurrences.length
    || phrase.occurrences.some((note, index) => Object.entries(note).some(([key, value]) =>
      value !== completed.phrase.occurrences[index][key as keyof typeof note]))
    || !mastery || phrase.occurrences.length === 0
    || phrase.occurrences.length > TEMPO_ENCORE_LIMITS.maxOccurrences) return false
  const notes = phrase.occurrences.filter(note => !note.isRest)
  return notes.length > 0 && notes.every(note => {
    const records = mastery.notes.filter(record => record.note === note.pitchName)
    return note.pitchName !== null && PITCHFORKS_RANGE_NOTES.includes(note.pitchName)
      && completed.admittedNotes.includes(note.pitchName)
      && records.length === 1 && records[0].voiceEverMastered
      && ['new', 'learning', 'review'].includes(records[0].voiceStatus)
  })
}

export interface TempoEncoreObservation {
  readonly ordinal: number
  readonly note: string | null
  readonly isRest: boolean
  /** Scheduled cue and end; actual visual commit is separately observed. */
  readonly cueAt: number
  readonly endAt: number
  readonly visualAt: number | null
  readonly detectorWindow: readonly [number, number] | null
  /** First fresh matching detector observation, not physical vocal onset. */
  readonly inputAt: number | null
  readonly holdAt: number | null
  readonly outcomeAt: number | null
}

export interface TempoEncoreState {
  readonly sourceKey: string
  readonly sourceSha256: string
  readonly sourceTempoBpm?: number
  readonly normalizationVersion: string
  readonly bpm: number
  readonly startedAt: number
  readonly observedAt: number
  readonly status: 'running' | 'complete' | 'cancelled'
  readonly observations: readonly TempoEncoreObservation[]
}

function validTime(now: number, previous: number): void {
  if (!Number.isFinite(now) || now < 0 || now < previous) throw new RangeError('A finite monotonic timestamp is required')
}

function freezeState(state: TempoEncoreState): TempoEncoreState {
  return Object.freeze({ ...state, observations: Object.freeze(state.observations.map(row => Object.freeze({
    ...row, detectorWindow: row.detectorWindow ? Object.freeze([...row.detectorWindow] as [number, number]) : null,
  }))) })
}

export function startTempoEncore(phrase: SongcraftPhrase, completed: SongcraftPracticeState | null,
  mastery: PitchforksMasteryProjection | undefined, bpm: number, now: number): TempoEncoreState {
  validTime(now, 0)
  if (!canEnterTempoEncore(phrase, completed, mastery)) throw new Error('Complete this exact phrase unaided with existing note mastery first')
  if (!Number.isFinite(bpm) || bpm < TEMPO_ENCORE_LIMITS.minBpm || bpm > TEMPO_ENCORE_LIMITS.maxBpm) throw new RangeError('Choose 30–180 beats per minute')
  let at = now + 4 * 60_000 / bpm
  let previousOrdinal = -1
  const observations = phrase.occurrences.map(note => {
    if (!Number.isSafeInteger(note.ordinal) || note.ordinal <= previousOrdinal || !Number.isFinite(note.beats) || note.beats <= 0) throw new Error('Invalid authored duration or occurrence')
    previousOrdinal = note.ordinal
    const cueAt = at
    at += note.beats * 60_000 / bpm
    if (!Number.isFinite(at) || at - now > TEMPO_ENCORE_LIMITS.maxDurationMs) throw new RangeError('Choose a phrase under ten minutes including count-in')
    return { ordinal: note.ordinal, note: note.pitchName, isRest: note.isRest, cueAt, endAt: at,
      visualAt: null, detectorWindow: null, inputAt: null, holdAt: null, outcomeAt: null }
  })
  return freezeState({ sourceKey: phrase.sourceKey, sourceSha256: phrase.sourceSha256,
    ...(phrase.sourceTempoBpm === undefined ? {} : { sourceTempoBpm: phrase.sourceTempoBpm }),
    normalizationVersion: phrase.provenance.normalizationVersion, bpm, startedAt: now,
    observedAt: now, status: 'running', observations })
}

export function tempoEncoreInitialBpm(phrase: SongcraftPhrase): number {
  return phrase.sourceTempoBpm ?? 60
}

export function tempoEncoreCurrent(state: TempoEncoreState): TempoEncoreObservation | undefined {
  return state.status === 'running' ? state.observations.find(row => state.observedAt >= row.cueAt && state.observedAt < row.endAt) : undefined
}

export type TempoEncoreEvent =
  | { readonly type: 'tick'; readonly now: number }
  | { readonly type: 'cancel'; readonly now: number }
  | { readonly type: 'visual'; readonly now: number; readonly ordinal: number }
  | { readonly type: 'detector'; readonly now: number; readonly ordinal: number; readonly matching: boolean; readonly held: boolean }

/** Pure observations only: no storage, grading, clock reads, or progress writes. */
export function advanceTempoEncore(state: TempoEncoreState, event: TempoEncoreEvent): TempoEncoreState {
  validTime(event.now, state.observedAt)
  if (state.status !== 'running') return state
  const observations = state.observations.map(row => {
    if (row.outcomeAt !== null) return row
    if (event.type === 'cancel' || event.now >= row.endAt) return { ...row, outcomeAt: event.now }
    if (event.type === 'tick' || event.ordinal !== row.ordinal || event.now < row.cueAt) return row
    if (event.type === 'visual') return { ...row, visualAt: row.visualAt ?? event.now }
    if (row.visualAt === null || row.isRest) return row
    return { ...row, detectorWindow: [row.detectorWindow?.[0] ?? event.now, event.now] as const,
      inputAt: event.matching ? row.inputAt ?? event.now : row.inputAt,
      holdAt: event.matching && event.held && row.inputAt !== null ? row.holdAt ?? event.now : row.holdAt }
  })
  return freezeState({ ...state, observedAt: event.now, observations,
    status: event.type === 'cancel' ? 'cancelled' : observations.every(row => row.outcomeAt !== null) ? 'complete' : 'running' })
}

export function tempoEncoreRawOffsets(row: TempoEncoreObservation) {
  return Object.freeze({ visualOffsetMs: row.visualAt === null ? null : row.visualAt - row.cueAt,
    inputOffsetMs: row.inputAt === null ? null : row.inputAt - row.cueAt,
    holdOffsetMs: row.holdAt === null ? null : row.holdAt - row.cueAt })
}

/** The browser can download this without giving the leaf any persistence port. */
export function tempoEncoreReceipt(state: TempoEncoreState, runId: string, evidence: 'software-observation' | 'synthetic-test' = 'software-observation'): string {
  return JSON.stringify({ schema: 'pitchforks-tempo-encore/1', runId, evidence,
    label: 'Uncalibrated practice timing', clock: 'performance.now', deviceLatency: 'unmeasured',
    physicalRhythmVerification: false, ...state,
    observations: state.observations.map(row => ({ ...row, ...tempoEncoreRawOffsets(row) })),
  }, null, 2)
}
