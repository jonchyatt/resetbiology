import {
  createPitchforksBossRecital,
  type PitchforksBossRecitalController,
  type PitchforksBossRecitalIdentity,
  type PitchforksBossRecitalInputLane,
  type PitchforksBossRecitalLane,
  type PitchforksBossRecitalResult,
  type PitchforksBossRecitalState,
  type PitchforksBossRecitalStorage,
} from './pitchforksBossRecital'
import {
  isSongcraftPhraseProvenance,
  type SongcraftPhrase,
  type SongcraftPhraseOccurrence,
  type SongcraftPhraseProvenance,
} from './pitchforksSongcraftPhrase'
import { PITCHFORKS_RANGE_NOTES } from './pitchforksRange'

export type SongcraftPracticeLane = PitchforksBossRecitalLane
export type SongcraftPracticeOccurrenceKind = 'note' | 'rest' | 'unsupported'
export type SongcraftPracticeCurrentKind = SongcraftPracticeOccurrenceKind | 'complete' | 'cancelled'
export type SongcraftPracticeStatus = 'active' | 'pending-save' | 'complete' | 'cancelled'

export type SongcraftPracticeIgnoreReason =
  | 'invalid'
  | 'stale'
  | 'other-lane'
  | 'wrong-note'
  | 'wrong-octave'
  | 'silence'
  | 'hint'
  | 'cancelled'
  | 'navigation'
  | 'pending-save'
  | 'complete'

export interface CreatePitchforksSongcraftPracticeInput {
  readonly phrase: SongcraftPhrase
  readonly attemptId: string
  readonly lane: PitchforksBossRecitalInputLane
  /** Exact authored notes admitted by the existing comfortable-range path. */
  readonly admittedNotes: readonly string[]
  readonly storage: PitchforksBossRecitalStorage
}

export interface SongcraftPracticeOccurrenceIdentity {
  readonly attemptId: string
  readonly sourceKey: string
  readonly sourceSha256: string
  readonly normalizationVersion: string
  readonly ordinal: number
  readonly lane: SongcraftPracticeLane
  readonly kind: SongcraftPracticeOccurrenceKind
  /** Existing boss claim; null for rest/unsupported and while a note is pending. */
  readonly claimId: string | null
  /** Existing boss sequence cursor; null when this occurrence has no eligible child. */
  readonly recitalCursor: number | null
}

export interface SongcraftPracticeResolution extends SongcraftPracticeOccurrenceIdentity {
  readonly note: string
  readonly correct: boolean
  readonly latencyMs?: number
}

export interface SongcraftPracticeOutcome {
  readonly attemptId: string
  readonly sourceKey: string
  readonly sourceSha256: string
  readonly normalizationVersion: string
  readonly ordinal: number
  readonly lane: SongcraftPracticeLane
  readonly kind: SongcraftPracticeOccurrenceKind
  readonly outcome: 'persisted' | 'supported-practice' | 'acknowledged'
  readonly traversed: true
  readonly assisted: boolean
  readonly unaided: boolean
  readonly provenance: SongcraftPhraseProvenance & { readonly sourceSha256: string }
}

export type SongcraftPracticeCurrent =
  | {
      readonly kind: 'note'
      readonly occurrence: SongcraftPhraseOccurrence
      readonly identity: SongcraftPracticeOccurrenceIdentity
    }
  | {
      readonly kind: 'rest' | 'unsupported'
      readonly occurrence: SongcraftPhraseOccurrence
      readonly identity: SongcraftPracticeOccurrenceIdentity
    }
  | {
      readonly kind: 'complete' | 'cancelled'
      readonly occurrence: null
      readonly identity: null
    }

export interface SongcraftPracticeSummary {
  readonly traversalComplete: boolean
  /** False when there is no eligible note or an authored unsupported note. */
  readonly masteryEligible: boolean
  /** True only after every eligible note was persisted unaided. */
  readonly unaidedComplete: boolean
  readonly assisted: boolean
  readonly traversedCount: number
  readonly eligibleNoteCount: number
  readonly unaidedNoteCount: number
}

export interface SongcraftPracticeState {
  readonly attemptId: string
  readonly lane: SongcraftPracticeLane
  readonly phrase: SongcraftPhrase
  readonly admittedNotes: readonly string[]
  /** Position in the authored occurrence array; never the boss note cursor. */
  readonly cursor: number
  readonly current: SongcraftPracticeCurrent
  readonly status: SongcraftPracticeStatus
  readonly outcomes: readonly SongcraftPracticeOutcome[]
  readonly summary: SongcraftPracticeSummary
  /** Present only while `current.kind === 'note'`; otherwise null. */
  readonly recitalState: PitchforksBossRecitalState | null
}

export type SongcraftPracticeResult =
  | {
      readonly kind: 'ignored'
      readonly reason: SongcraftPracticeIgnoreReason
      readonly state: SongcraftPracticeState
    }
  | {
      readonly kind: 'acknowledged'
      readonly outcome: SongcraftPracticeOutcome
      readonly state: SongcraftPracticeState
    }
  | {
      readonly kind: 'persisted'
      readonly outcome: 'success' | 'failed'
      readonly supportive: boolean
      readonly completed: boolean
      readonly receipt: Extract<PitchforksBossRecitalResult, { readonly kind: 'persisted' }>['receipt']
      readonly practiceOutcome: SongcraftPracticeOutcome | null
      readonly state: SongcraftPracticeState
    }
  | {
      readonly kind: 'supported-practice'
      readonly outcome: 'success'
      readonly supportive: true
      readonly completed: boolean
      readonly grade: null
      readonly provenance: Extract<PitchforksBossRecitalResult, { readonly kind: 'supported-practice' }>['provenance']
      readonly practiceOutcome: SongcraftPracticeOutcome
      readonly state: SongcraftPracticeState
    }
  | {
      readonly kind: 'save-failed' | 'readback-mismatch' | 'conflict'
      readonly receipt: Extract<PitchforksBossRecitalResult, { readonly kind: 'save-failed' | 'readback-mismatch' | 'conflict' }>['receipt']
      readonly state: SongcraftPracticeState
    }
  | {
      readonly kind: 'storage-error'
      readonly operation: Extract<PitchforksBossRecitalResult, { readonly kind: 'storage-error' }>['operation']
      readonly state: SongcraftPracticeState
    }
  | {
      readonly kind: 'retry-note'
      readonly state: SongcraftPracticeState
    }

export type SongcraftPracticeEvent =
  | { readonly type: 'resolve'; readonly resolution: SongcraftPracticeResolution }
  | { readonly type: 'hint'; readonly identity: SongcraftPracticeOccurrenceIdentity }
  | { readonly type: 'acknowledge'; readonly identity: SongcraftPracticeOccurrenceIdentity }
  | { readonly type: 'retry-save' | 'retry-note' | 'cancel' }

export interface SongcraftPracticeController {
  readonly state: () => SongcraftPracticeState
  readonly resolve: (resolution: SongcraftPracticeResolution) => SongcraftPracticeResult
  readonly hint: (identity: SongcraftPracticeOccurrenceIdentity) => SongcraftPracticeResult
  readonly acknowledge: (identity: SongcraftPracticeOccurrenceIdentity) => SongcraftPracticeResult
  readonly retrySave: () => SongcraftPracticeResult
  readonly retryNote: () => SongcraftPracticeResult
  readonly cancel: () => SongcraftPracticeResult
  readonly handle: (event: SongcraftPracticeEvent) => SongcraftPracticeResult
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return Object.freeze(value)
}

function normalizeLane(lane: unknown): SongcraftPracticeLane | null {
  if (lane === 'voice') return 'voice'
  if (lane === 'ear' || lane === 'buttons') return 'ear'
  return null
}

function validOccurrence(occurrence: unknown, previousOrdinal: number): occurrence is SongcraftPhraseOccurrence {
  if (!isRecord(occurrence)) return false
  const ordinal = occurrence.ordinal
  if (typeof ordinal !== 'number' || !Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal <= previousOrdinal) return false
  if (typeof occurrence.isRest !== 'boolean') return false
  const beats = occurrence.beats
  if (typeof beats !== 'number' || !Number.isFinite(beats) || beats <= 0) return false
  const measureIdx = occurrence.measureIdx
  if (typeof measureIdx !== 'number' || !Number.isSafeInteger(measureIdx) || measureIdx < 1) return false
  const beatOffset = occurrence.beatOffset
  if (typeof beatOffset !== 'number' || !Number.isFinite(beatOffset) || beatOffset < 0) return false
  if (occurrence.lyric !== undefined && typeof occurrence.lyric !== 'string') return false

  if (occurrence.isRest) {
    return occurrence.semi === null && occurrence.pitchName === null
      && occurrence.octave === null && occurrence.midi === null
  }

  const pitchName = occurrence.pitchName
  const semi = occurrence.semi
  const octave = occurrence.octave
  const midi = occurrence.midi
  return typeof pitchName === 'string' && pitchName.length > 0
    && typeof semi === 'number' && Number.isSafeInteger(semi)
    && typeof octave === 'number' && Number.isSafeInteger(octave)
    && typeof midi === 'number' && Number.isSafeInteger(midi)
    && midi === semi + 60
}

function snapshotPhrase(phrase: SongcraftPhrase): SongcraftPhrase {
  if (!isRecord(phrase)
    || typeof phrase.sourceKey !== 'string' || phrase.sourceKey.length === 0
    || typeof phrase.title !== 'string'
    || typeof phrase.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(phrase.sourceSha256)
    || !isSongcraftPhraseProvenance(phrase.provenance)
    || !Array.isArray(phrase.occurrences) || phrase.occurrences.length === 0) {
    throw new TypeError('Invalid Songcraft phrase snapshot')
  }
  if (phrase.provenance.source === 'builtin'
    && phrase.sourceKey !== `builtin:practice:${phrase.provenance.packId}:${phrase.provenance.packVersion}:${phrase.provenance.presetId}`) {
    throw new TypeError('Invalid Songcraft preset identity')
  }

  let previousOrdinal = -1
  const occurrences = phrase.occurrences.map(value => {
    if (!validOccurrence(value, previousOrdinal)) throw new TypeError('Invalid Songcraft occurrence snapshot')
    previousOrdinal = value.ordinal
    return deepFreeze({
      ...value,
      ...(value.lyric === undefined ? {} : { lyric: value.lyric }),
    })
  })
  return deepFreeze({
    sourceKey: phrase.sourceKey,
    title: phrase.title,
    sourceSha256: phrase.sourceSha256,
    provenance: { ...phrase.provenance },
    occurrences,
  })
}

function currentKindFor(occurrence: SongcraftPhraseOccurrence, admitted: ReadonlySet<string>): SongcraftPracticeOccurrenceKind {
  if (occurrence.isRest) return 'rest'
  return occurrence.pitchName !== null
    && PITCHFORKS_RANGE_NOTES.includes(occurrence.pitchName)
    && admitted.has(occurrence.pitchName)
    ? 'note'
    : 'unsupported'
}

function bossIdentityFor(
  identity: SongcraftPracticeOccurrenceIdentity,
  occurrence: SongcraftPhraseOccurrence,
): PitchforksBossRecitalIdentity | null {
  if (identity.kind !== 'note' || identity.claimId === null || identity.recitalCursor === null || occurrence.pitchName === null) return null
  return {
    attempt: identity.attemptId,
    lane: identity.lane,
    note: occurrence.pitchName,
    cursor: identity.recitalCursor,
    claimId: identity.claimId,
  }
}

function sourceProvenance(phrase: SongcraftPhrase): SongcraftPhraseProvenance & { readonly sourceSha256: string } {
  return deepFreeze({
    ...phrase.provenance,
    sourceSha256: phrase.sourceSha256,
  })
}

export function createPitchforksSongcraftPractice(
  input: CreatePitchforksSongcraftPracticeInput,
): SongcraftPracticeController {
  if (!input || typeof input.attemptId !== 'string' || input.attemptId.trim().length === 0) {
    throw new TypeError('Invalid Songcraft practice attempt')
  }
  // Primitive attempt identity is captured once; a caller mutating its input
  // object cannot rewrite an in-flight child claim or its later outcomes.
  const attemptId = input.attemptId
  const lane = normalizeLane(input.lane)
  if (!lane) throw new TypeError('Invalid Songcraft practice lane')
  if (!input.storage
    || typeof input.storage.loadStore !== 'function'
    || typeof input.storage.saveStore !== 'function'
    || typeof input.storage.readback !== 'function') {
    throw new TypeError('Invalid Songcraft practice storage ports')
  }

  const phrase = snapshotPhrase(input.phrase)
  if (!Array.isArray(input.admittedNotes)
    || input.admittedNotes.some(note => typeof note !== 'string' || !PITCHFORKS_RANGE_NOTES.includes(note))) {
    throw new TypeError('Songcraft admitted notes must be literal comfortable-range notes')
  }
  const admittedNotes = deepFreeze([...input.admittedNotes])
  const admitted = new Set(admittedNotes)
  const kinds = phrase.occurrences.map(occurrence => currentKindFor(occurrence, admitted))
  const eligibleIndexes = kinds.flatMap((kind, index) => kind === 'note' ? [index] : [])
  const eligibleSequence = eligibleIndexes.map(index => phrase.occurrences[index].pitchName as string)
  let recital: PitchforksBossRecitalController | null = null
  if (eligibleSequence.length > 0) {
    recital = createPitchforksBossRecital({
      attempt: attemptId,
      lane,
      sequence: eligibleSequence,
      admittedNotes,
      storage: input.storage,
    })
  }

  let cursor = 0
  let status: SongcraftPracticeStatus = 'active'
  let outcomes: SongcraftPracticeOutcome[] = []

  const recitalCursorFor = (occurrenceIndex: number): number | null => {
    if (!recital) return null
    let count = 0
    for (let index = 0; index < occurrenceIndex; index += 1) {
      if (kinds[index] === 'note') count += 1
    }
    return count
  }

  const current = (): SongcraftPracticeCurrent => {
    if (status === 'cancelled') return { kind: 'cancelled', occurrence: null, identity: null }
    if (cursor >= phrase.occurrences.length) return { kind: 'complete', occurrence: null, identity: null }
    const occurrence = phrase.occurrences[cursor]
    const kind = kinds[cursor]
    const bossState = recital?.state() ?? null
    const recitalCursor = recitalCursorFor(cursor)
    const identity = deepFreeze({
      attemptId,
      sourceKey: phrase.sourceKey,
      sourceSha256: phrase.sourceSha256,
      normalizationVersion: phrase.provenance.normalizationVersion,
      ordinal: occurrence.ordinal,
      lane,
      kind,
      claimId: kind === 'note' ? bossState?.claimId ?? null : null,
      recitalCursor: kind === 'note' ? recitalCursor : null,
    })
    return deepFreeze({ kind, occurrence, identity }) as SongcraftPracticeCurrent
  }

  const summary = (): SongcraftPracticeSummary => {
    const eligibleNoteCount = kinds.filter(kind => kind === 'note').length
    const unsupportedCount = kinds.filter(kind => kind === 'unsupported').length
    const unaidedNoteCount = outcomes.filter(outcome => outcome.kind === 'note' && outcome.unaided).length
    return deepFreeze({
      traversalComplete: cursor >= phrase.occurrences.length,
      masteryEligible: eligibleNoteCount > 0 && unsupportedCount === 0,
      unaidedComplete: cursor >= phrase.occurrences.length
        && eligibleNoteCount > 0
        && unsupportedCount === 0
        && unaidedNoteCount === eligibleNoteCount,
      assisted: outcomes.some(outcome => outcome.assisted),
      traversedCount: outcomes.length,
      eligibleNoteCount,
      unaidedNoteCount,
    })
  }

  const state = (): SongcraftPracticeState => {
    const currentValue = current()
    const recitalState = currentValue.kind === 'note' ? recital?.state() ?? null : null
    const currentStatus = status === 'cancelled'
      ? 'cancelled'
      : cursor >= phrase.occurrences.length
        ? 'complete'
        : recitalState?.status === 'pending-save'
          ? 'pending-save'
          : 'active'
    return deepFreeze({
      attemptId,
      lane,
      phrase,
      admittedNotes,
      cursor,
      current: currentValue,
      status: currentStatus,
      outcomes: [...outcomes],
      summary: summary(),
      recitalState,
    })
  }

  const ignored = (reason: SongcraftPracticeIgnoreReason): SongcraftPracticeResult => ({
    kind: 'ignored',
    reason,
    state: state(),
  })

  const identityReason = (
    identity: unknown,
    expectedKind: SongcraftPracticeOccurrenceKind,
  ): SongcraftPracticeIgnoreReason | null => {
    const currentValue = current()
    if (currentValue.kind === 'cancelled') return 'cancelled'
    if (currentValue.kind === 'complete') return 'complete'
    if (!currentValue.occurrence) return 'invalid'
    if (!isRecord(identity)) return 'invalid'
    if (identity.attemptId !== attemptId
      || identity.sourceKey !== phrase.sourceKey
      || identity.sourceSha256 !== phrase.sourceSha256
      || identity.normalizationVersion !== phrase.provenance.normalizationVersion
      || identity.ordinal !== currentValue.occurrence.ordinal) return 'stale'
    if (identity.lane !== lane) return 'other-lane'
    if (identity.kind !== expectedKind || currentValue.kind !== expectedKind) return 'invalid'
    if (identity.claimId !== currentValue.identity.claimId
      || identity.recitalCursor !== currentValue.identity.recitalCursor) {
      return state().status === 'pending-save' ? 'pending-save' : 'stale'
    }
    return null
  }

  const outcomeFor = (
    occurrence: SongcraftPhraseOccurrence,
    kind: SongcraftPracticeOccurrenceKind,
    outcome: SongcraftPracticeOutcome['outcome'],
    assisted: boolean,
  ): SongcraftPracticeOutcome => deepFreeze({
    attemptId,
    sourceKey: phrase.sourceKey,
    sourceSha256: phrase.sourceSha256,
    normalizationVersion: phrase.provenance.normalizationVersion,
    ordinal: occurrence.ordinal,
    lane,
    kind,
    outcome,
    traversed: true,
    assisted,
    unaided: kind === 'note' && outcome === 'persisted' && !assisted,
    provenance: sourceProvenance(phrase),
  })

  const advance = (outcome: SongcraftPracticeOutcome): void => {
    outcomes = [...outcomes, outcome]
    cursor += 1
  }

  const mapBossResult = (result: PitchforksBossRecitalResult): SongcraftPracticeResult => {
    const before = current()
    if (result.kind === 'persisted') {
      let practiceOutcome: SongcraftPracticeOutcome | null = null
      if (result.outcome === 'success' && result.receipt.persisted && before.kind === 'note') {
        practiceOutcome = outcomeFor(before.occurrence, 'note', 'persisted', result.supportive)
        advance(practiceOutcome)
      }
      return {
        kind: 'persisted',
        outcome: result.outcome,
        supportive: result.supportive,
        completed: state().status === 'complete',
        receipt: result.receipt,
        practiceOutcome,
        state: state(),
      }
    }
    if (result.kind === 'supported-practice') {
      if (before.kind !== 'note') return ignored('invalid')
      const practiceOutcome = outcomeFor(before.occurrence, 'note', 'supported-practice', true)
      advance(practiceOutcome)
      return {
        kind: 'supported-practice',
        outcome: result.outcome,
        supportive: result.supportive,
        completed: state().status === 'complete',
        grade: result.grade,
        provenance: result.provenance,
        practiceOutcome,
        state: state(),
      }
    }
    if (result.kind === 'ignored') return ignored(result.reason)
    if (result.kind === 'save-failed' || result.kind === 'readback-mismatch' || result.kind === 'conflict') {
      return { kind: result.kind, receipt: result.receipt, state: state() }
    }
    if (result.kind === 'storage-error') return { kind: result.kind, operation: result.operation, state: state() }
    return { kind: 'retry-note', state: state() }
  }

  const resolve = (resolution: SongcraftPracticeResolution): SongcraftPracticeResult => {
    const reason = identityReason(resolution, 'note')
    if (reason) return ignored(reason)
    const currentValue = current()
    if (currentValue.kind !== 'note' || !recital) return ignored('invalid')
    if (typeof resolution.note !== 'string' || typeof resolution.correct !== 'boolean') return ignored('invalid')
    const identity = bossIdentityFor(currentValue.identity, currentValue.occurrence)
    if (!identity) return ignored('stale')
    const result = recital.resolve({
      ...identity,
      note: resolution.note,
      correct: resolution.correct,
      latencyMs: resolution.latencyMs,
    })
    return mapBossResult(result)
  }

  const hint = (identity: SongcraftPracticeOccurrenceIdentity): SongcraftPracticeResult => {
    const reason = identityReason(identity, 'note')
    if (reason) return ignored(reason)
    const currentValue = current()
    if (currentValue.kind !== 'note' || !recital) return ignored('invalid')
    const bossIdentity = bossIdentityFor(currentValue.identity, currentValue.occurrence)
    if (!bossIdentity) return ignored('stale')
    return mapBossResult(recital.hint(bossIdentity))
  }

  const acknowledge = (identity: SongcraftPracticeOccurrenceIdentity): SongcraftPracticeResult => {
    const currentValue = current()
    const reason = identityReason(identity, currentValue.kind === 'rest' || currentValue.kind === 'unsupported'
      ? currentValue.kind
      : 'rest')
    if (reason) return ignored(reason)
    if (currentValue.kind !== 'rest' && currentValue.kind !== 'unsupported') return ignored('invalid')
    const outcome = outcomeFor(currentValue.occurrence, currentValue.kind, 'acknowledged', false)
    advance(outcome)
    return { kind: 'acknowledged', outcome, state: state() }
  }

  const retrySave = (): SongcraftPracticeResult => {
    if (status === 'cancelled') return ignored('cancelled')
    if (cursor >= phrase.occurrences.length) return ignored('complete')
    if (kinds[cursor] !== 'note' || !recital) return ignored('invalid')
    return mapBossResult(recital.retrySave())
  }

  const retryNote = (): SongcraftPracticeResult => {
    if (status === 'cancelled') return ignored('cancelled')
    if (cursor >= phrase.occurrences.length) return ignored('complete')
    if (kinds[cursor] !== 'note' || !recital) return ignored('invalid')
    return mapBossResult(recital.retryNote())
  }

  const cancel = (): SongcraftPracticeResult => {
    if (status === 'cancelled') return ignored('cancelled')
    if (status === 'complete' || cursor >= phrase.occurrences.length) return ignored('complete')
    status = 'cancelled'
    if (recital) recital.cancel()
    return ignored('cancelled')
  }

  const handle = (event: SongcraftPracticeEvent): SongcraftPracticeResult => {
    if (!event || typeof event !== 'object') return ignored('invalid')
    switch (event.type) {
      case 'resolve': return resolve(event.resolution)
      case 'hint': return hint(event.identity)
      case 'acknowledge': return acknowledge(event.identity)
      case 'retry-save': return retrySave()
      case 'retry-note': return retryNote()
      case 'cancel': return cancel()
      default: return ignored('invalid')
    }
  }

  return { state, resolve, hint, acknowledge, retrySave, retryNote, cancel, handle }
}
