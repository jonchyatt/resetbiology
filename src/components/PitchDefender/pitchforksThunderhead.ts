/**
 * Pure single-charge Thunderhead lifecycle.
 *
 * The caller owns one latest snapshot at a serialized runtime boundary and
 * replaces it with each returned `state` before accepting another event. This
 * helper does not listen, grade, detect pitch, choose geometry, enforce
 * unlocks, or strike a tine; its strike intent is only a receipt for the
 * existing strike authority. Longer sequences and persistence are future
 * contracts and are intentionally absent.
 */

export const PITCHFORKS_THUNDERHEAD_MAX_BANK_CAPACITY = 1 as const

/** Diagnostic trace bound; consumed identity ledgers remain lossless below. */
export const PITCHFORKS_THUNDERHEAD_MAX_DIAGNOSTIC_EVENTS = 64 as const

export const PITCHFORKS_THUNDERHEAD_EVENT_SEQUENCE = Object.freeze([
  'lock_confirmed',
  'banked',
  'detached',
  'ceiling_travel',
  'target_match',
  'strike',
  'consumed',
] as const)

export type PitchforksThunderheadEventName =
  typeof PITCHFORKS_THUNDERHEAD_EVENT_SEQUENCE[number]

export type PitchforksThunderheadPhase = 'idle' | PitchforksThunderheadEventName

export type PitchforksThunderheadLockReceipt = Readonly<{
  bankId: string
  lockId: string
  targetKey: string
  pitchClass: string
  rune: string
  colorToken: string
  /** Exact note identity; `octave` is retained separately and never folded. */
  note: string
  octave: number
}>

export type PitchforksThunderheadBank = Readonly<
  PitchforksThunderheadLockReceipt & { consumedAt: number | null }
>

export type PitchforksThunderheadTarget = Readonly<{
  targetKey: string
  note: string
  octave: number
}>

export type PitchforksThunderheadEvent =
  | Readonly<{
    type: 'lock_confirmed'
    logicalTimeMs: number
    receipt: PitchforksThunderheadLockReceipt
  }>
  | Readonly<{
    type: Exclude<PitchforksThunderheadEventName, 'lock_confirmed' | 'target_match'>
    logicalTimeMs: number
  }>
  | Readonly<{
    type: 'target_match'
    logicalTimeMs: number
    target: PitchforksThunderheadTarget
  }>

export type PitchforksThunderheadEventRecord = Readonly<{
  type: PitchforksThunderheadEventName
  logicalTimeMs: number
  bankId: string | null
  lockId: string | null
  targetKey: string | null
  note: string | null
  octave: number | null
}>

type StateFields = {
  phase: PitchforksThunderheadPhase
  /** The caller-confirmed receipt, retained for replay/debug inspection. */
  receipt: PitchforksThunderheadLockReceipt | null
  bank: PitchforksThunderheadBank | null
  matchedTarget: PitchforksThunderheadTarget | null
  lastEventAtMs: number | null
  events: readonly PitchforksThunderheadEventRecord[]
  /** These IDs survive later charges and deny lifecycle replays. */
  consumedLockIds: readonly string[]
  consumedBankIds: readonly string[]
}

export type PitchforksThunderheadState = Readonly<StateFields>

export type PitchforksThunderheadStrikeIntent = Readonly<{
  kind: 'thunderhead-strike'
  bankId: string
  lockId: string
  targetKey: string
  pitchClass: string
  rune: string
  colorToken: string
  note: string
  octave: number
  consumedAt: null
}>

export type PitchforksThunderheadTransitionReason =
  | 'accepted'
  | 'invalid-event'
  | 'invalid-time'
  | 'time-regressed'
  | 'invalid-receipt'
  | 'invalid-target'
  | 'capacity-full'
  | 'insufficient-charge'
  | 'duplicate-lock'
  | 'duplicate-bank'
  | 'not-ready'
  | 'already-banked'
  | 'already-matched'
  | 'already-consumed'
  | 'stale-target'
  | 'note-mismatch'
  | 'octave-mismatch'

export type PitchforksThunderheadTransition = Readonly<{
  state: PitchforksThunderheadState
  intent: PitchforksThunderheadStrikeIntent | null
  accepted: boolean
  reason: PitchforksThunderheadTransitionReason
}>

export type PitchforksThunderheadDebugProjection = Readonly<{
  capacity: typeof PITCHFORKS_THUNDERHEAD_MAX_BANK_CAPACITY
  phase: PitchforksThunderheadPhase
  receipt: PitchforksThunderheadLockReceipt | null
  bank: PitchforksThunderheadBank | null
  matchedTarget: PitchforksThunderheadTarget | null
  lastEventAtMs: number | null
  /** Recent trace sequence only; consumed ID ledgers are the replay history. */
  eventSequence: readonly PitchforksThunderheadEventName[]
  events: readonly PitchforksThunderheadEventRecord[]
  consumedLockIds: readonly string[]
  consumedBankIds: readonly string[]
}>

type UnknownRecord = Record<string, unknown>

type ParsedPitch = Readonly<{
  pitchClass: string
  octave: number
}>

const PITCH_NOTE_PATTERN = /^([A-G](?:#|b)?)(-?\d+)$/

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isSafeOctave(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function isValidLogicalTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isEventName(value: unknown): value is PitchforksThunderheadEventName {
  return typeof value === 'string'
    && (PITCHFORKS_THUNDERHEAD_EVENT_SEQUENCE as readonly string[]).includes(value)
}

function copyReceipt(value: PitchforksThunderheadLockReceipt): PitchforksThunderheadLockReceipt {
  return Object.freeze({
    bankId: value.bankId,
    lockId: value.lockId,
    targetKey: value.targetKey,
    pitchClass: value.pitchClass,
    rune: value.rune,
    colorToken: value.colorToken,
    note: value.note,
    octave: value.octave,
  })
}

function copyBank(value: PitchforksThunderheadBank): PitchforksThunderheadBank {
  return Object.freeze({ ...copyReceipt(value), consumedAt: value.consumedAt })
}

function copyTarget(value: PitchforksThunderheadTarget): PitchforksThunderheadTarget {
  return Object.freeze({
    targetKey: value.targetKey,
    note: value.note,
    octave: value.octave,
  })
}

function parsePitch(note: unknown, octave: unknown): ParsedPitch | null {
  if (!isNonEmptyString(note) || !isSafeOctave(octave)) return null
  const match = PITCH_NOTE_PATTERN.exec(note)
  if (match === null) return null

  const parsedOctave = Number(match[2])
  if (!Number.isSafeInteger(parsedOctave) || parsedOctave !== octave) return null

  return Object.freeze({ pitchClass: match[1], octave: parsedOctave })
}

function parseReceipt(value: unknown): PitchforksThunderheadLockReceipt | null {
  if (!isRecord(value)) return null
  if (
    !isNonEmptyString(value.bankId)
    || !isNonEmptyString(value.lockId)
    || !isNonEmptyString(value.targetKey)
    || !isNonEmptyString(value.pitchClass)
    || !isNonEmptyString(value.rune)
    || !isNonEmptyString(value.colorToken)
    || !isNonEmptyString(value.note)
    || !isSafeOctave(value.octave)
  ) return null
  const parsedPitch = parsePitch(value.note, value.octave)
  if (parsedPitch === null || value.pitchClass !== parsedPitch.pitchClass) return null

  return copyReceipt({
    bankId: value.bankId,
    lockId: value.lockId,
    targetKey: value.targetKey,
    pitchClass: value.pitchClass,
    rune: value.rune,
    colorToken: value.colorToken,
    note: value.note,
    octave: value.octave,
  })
}

function parseTarget(value: unknown): PitchforksThunderheadTarget | null {
  if (!isRecord(value)) return null
  if (!isNonEmptyString(value.targetKey)) {
    return null
  }
  if (!isNonEmptyString(value.note)) {
    return null
  }
  const parsedPitch = parsePitch(value.note, value.octave)
  if (parsedPitch === null) {
    return null
  }
  return copyTarget({ targetKey: value.targetKey, note: value.note, octave: parsedPitch.octave })
}

function eventRecord(
  type: PitchforksThunderheadEventName,
  logicalTimeMs: number,
  source: Pick<PitchforksThunderheadLockReceipt, 'bankId' | 'lockId' | 'targetKey' | 'note' | 'octave'> | null = null,
  target: PitchforksThunderheadTarget | null = null,
): PitchforksThunderheadEventRecord {
  return Object.freeze({
    type,
    logicalTimeMs,
    bankId: source?.bankId ?? null,
    lockId: source?.lockId ?? null,
    targetKey: target?.targetKey ?? source?.targetKey ?? null,
    note: target?.note ?? source?.note ?? null,
    octave: target?.octave ?? source?.octave ?? null,
  })
}

function retainDiagnosticEvents(
  events: readonly PitchforksThunderheadEventRecord[],
): readonly PitchforksThunderheadEventRecord[] {
  const recent = events.slice(-PITCHFORKS_THUNDERHEAD_MAX_DIAGNOSTIC_EVENTS)
  const firstLifecycle = recent.findIndex(event => event.type === 'lock_confirmed')
  return firstLifecycle > 0 ? recent.slice(firstLifecycle) : recent
}

function makeState(values: StateFields): PitchforksThunderheadState {
  return Object.freeze({
    phase: values.phase,
    receipt: values.receipt === null ? null : copyReceipt(values.receipt),
    bank: values.bank === null ? null : copyBank(values.bank),
    matchedTarget: values.matchedTarget === null ? null : copyTarget(values.matchedTarget),
    lastEventAtMs: values.lastEventAtMs,
    events: Object.freeze([...values.events]),
    consumedLockIds: Object.freeze([...values.consumedLockIds]),
    consumedBankIds: Object.freeze([...values.consumedBankIds]),
  })
}

export function createPitchforksThunderheadState(): PitchforksThunderheadState {
  return makeState({
    phase: 'idle',
    receipt: null,
    bank: null,
    matchedTarget: null,
    lastEventAtMs: null,
    events: [],
    consumedLockIds: [],
    consumedBankIds: [],
  })
}

type StatePatch = Partial<Omit<StateFields, 'events' | 'lastEventAtMs'>>

function nextState(
  state: PitchforksThunderheadState,
  patch: StatePatch,
  record: PitchforksThunderheadEventRecord,
): PitchforksThunderheadState {
  return makeState({
    phase: patch.phase ?? state.phase,
    receipt: patch.receipt === undefined ? state.receipt : patch.receipt,
    bank: patch.bank === undefined ? state.bank : patch.bank,
    matchedTarget: patch.matchedTarget === undefined ? state.matchedTarget : patch.matchedTarget,
    lastEventAtMs: record.logicalTimeMs,
    events: retainDiagnosticEvents([...state.events, record]),
    consumedLockIds: patch.consumedLockIds ?? state.consumedLockIds,
    consumedBankIds: patch.consumedBankIds ?? state.consumedBankIds,
  })
}

function accept(
  state: PitchforksThunderheadState,
  patch: StatePatch,
  record: PitchforksThunderheadEventRecord,
  intent: PitchforksThunderheadStrikeIntent | null = null,
): PitchforksThunderheadTransition {
  return { accepted: true, reason: 'accepted', intent, state: nextState(state, patch, record) }
}

function reject(
  state: PitchforksThunderheadState,
  reason: Exclude<PitchforksThunderheadTransitionReason, 'accepted'>,
): PitchforksThunderheadTransition {
  return { accepted: false, reason, intent: null, state }
}

/** Apply exactly one explicitly named lifecycle event. */
export function advancePitchforksThunderhead(
  state: PitchforksThunderheadState,
  event: PitchforksThunderheadEvent,
): PitchforksThunderheadTransition {
  if (!isRecord(event) || !isEventName(event.type)) return reject(state, 'invalid-event')
  if (!isValidLogicalTime(event.logicalTimeMs)) return reject(state, 'invalid-time')
  if (state.lastEventAtMs !== null && event.logicalTimeMs < state.lastEventAtMs) {
    return reject(state, 'time-regressed')
  }

  const time = event.logicalTimeMs

  if (event.type === 'lock_confirmed') {
    if (state.phase !== 'idle' && state.phase !== 'consumed') return reject(state, 'capacity-full')
    const receipt = parseReceipt(event.receipt)
    if (receipt === null) return reject(state, 'invalid-receipt')
    if (state.consumedLockIds.includes(receipt.lockId)) return reject(state, 'duplicate-lock')
    if (state.consumedBankIds.includes(receipt.bankId)) return reject(state, 'duplicate-bank')
    return accept(
      state,
      { phase: 'lock_confirmed', receipt, bank: null, matchedTarget: null },
      eventRecord('lock_confirmed', time, receipt),
    )
  }

  if (event.type === 'banked') {
    if (state.phase === 'idle') return reject(state, 'insufficient-charge')
    if (state.phase === 'consumed') return reject(state, 'already-consumed')
    if (state.phase === 'banked') return reject(state, 'already-banked')
    if (state.phase !== 'lock_confirmed' || state.receipt === null) return reject(state, 'not-ready')
    const bank = copyBank({ ...state.receipt, consumedAt: null })
    return accept(state, { phase: 'banked', bank }, eventRecord('banked', time, bank))
  }

  if (event.type === 'detached') {
    if (state.phase !== 'banked' || state.bank === null) return reject(state, 'not-ready')
    return accept(state, { phase: 'detached' }, eventRecord('detached', time, state.bank))
  }

  if (event.type === 'ceiling_travel') {
    if (state.phase !== 'detached' || state.bank === null) return reject(state, 'not-ready')
    return accept(state, { phase: 'ceiling_travel' }, eventRecord('ceiling_travel', time, state.bank))
  }

  if (event.type === 'target_match') {
    if (state.phase === 'target_match') return reject(state, 'already-matched')
    if (state.phase !== 'ceiling_travel' || state.bank === null) return reject(state, 'not-ready')
    const target = parseTarget(event.target)
    if (target === null) return reject(state, 'invalid-target')
    if (target.targetKey !== state.bank.targetKey) return reject(state, 'stale-target')
    if (target.note !== state.bank.note) return reject(state, 'note-mismatch')
    if (target.octave !== state.bank.octave) return reject(state, 'octave-mismatch')
    return accept(
      state,
      { phase: 'target_match', matchedTarget: target },
      eventRecord('target_match', time, state.bank, target),
    )
  }

  if (event.type === 'strike') {
    if (state.phase === 'strike' || state.phase === 'consumed') return reject(state, 'already-consumed')
    if (state.phase !== 'target_match' || state.bank === null || state.matchedTarget === null) {
      return reject(state, 'not-ready')
    }
    const intent: PitchforksThunderheadStrikeIntent = Object.freeze({
      kind: 'thunderhead-strike',
      bankId: state.bank.bankId,
      lockId: state.bank.lockId,
      targetKey: state.matchedTarget.targetKey,
      pitchClass: state.bank.pitchClass,
      rune: state.bank.rune,
      colorToken: state.bank.colorToken,
      note: state.matchedTarget.note,
      octave: state.matchedTarget.octave,
      consumedAt: null,
    })
    return accept(state, { phase: 'strike' }, eventRecord('strike', time, state.bank, state.matchedTarget), intent)
  }

  if (state.phase === 'consumed') return reject(state, 'already-consumed')
  if (state.phase !== 'strike' || state.bank === null || state.matchedTarget === null) {
    return reject(state, 'not-ready')
  }
  const consumedBank = copyBank({ ...state.bank, consumedAt: time })
  return accept(
    state,
    {
      phase: 'consumed',
      bank: consumedBank,
      consumedLockIds: [...state.consumedLockIds, consumedBank.lockId],
      consumedBankIds: [...state.consumedBankIds, consumedBank.bankId],
    },
    eventRecord('consumed', time, consumedBank, state.matchedTarget),
  )
}

/** Alias for reducer-oriented callers; both names share the same pure reducer. */
export const transitionPitchforksThunderhead = advancePitchforksThunderhead

/** Return a frozen read-only projection with all bank identity fields. */
export function projectPitchforksThunderheadDebug(
  state: PitchforksThunderheadState,
): PitchforksThunderheadDebugProjection {
  return Object.freeze({
    capacity: PITCHFORKS_THUNDERHEAD_MAX_BANK_CAPACITY,
    phase: state.phase,
    receipt: state.receipt,
    bank: state.bank,
    matchedTarget: state.matchedTarget,
    lastEventAtMs: state.lastEventAtMs,
    eventSequence: Object.freeze(state.events.map(event => event.type)),
    events: state.events,
    consumedLockIds: state.consumedLockIds,
    consumedBankIds: state.consumedBankIds,
  })
}

export const getPitchforksThunderheadDebugProjection = projectPitchforksThunderheadDebug
