/**
 * Pure, run-local accounting for the normal Bell power.
 *
 * The caller owns pitch detection, exact-octave grading, admission, effects,
 * and persistence. It must pass only caller-confirmed ordinary voice combat
 * results here, install the returned state, then route the one pending
 * receipt to pitchforksBellWave. There is no FSRS, storage, tine, or renderer
 * dependency in this module.
 */

export type PitchforksBellPowerPhase = 'charging' | 'ready' | 'activating' | 'pending'

export type PitchforksBellPowerNotePair = readonly [string, string]

/** All balance and teaching choices are required; this controller supplies no defaults. */
export type PitchforksBellPowerConfig = Readonly<{
  runId: string
  requiredResponses: number
  /** The caller's current exact, admitted note set. */
  admittedNotes: readonly string[]
  /** Ordered, distinct, literal notes used by the activation lesson. */
  taughtPair: PitchforksBellPowerNotePair
}>

/**
 * A normal voice combat result. `correct: true` is still checked at runtime;
 * the type prevents a well-typed caller from accidentally sending a miss.
 * Optional exclusion flags are accepted only when explicitly false.
 */
export type PitchforksBellPowerCombatResponse = Readonly<{
  runId: string
  eventId: string
  note: string
  lane: 'voice'
  source: 'combat'
  correct: true
  demo?: boolean
  simulated?: boolean
  stale?: boolean
}> 

/** A caller-confirmed note from the two-note activation lesson. */
export type PitchforksBellPowerActivationNote = Readonly<{
  runId: string
  eventId: string
  note: string
  confirmed: true
}>

/**
 * A receipt is structurally compatible with the existing Bell Wave contract:
 * the wave consumes its unique `receiptId`; the extra fields are provenance.
 */
export type PitchforksBellPowerReceipt = Readonly<{
  receiptId: string
  runId: string
  taughtPair: PitchforksBellPowerNotePair
}>

/** The caller's release result; false keeps the receipt available for retry. */
export type PitchforksBellPowerWaveReleaseAcknowledgement = Readonly<{
  runId: string
  receiptId: string
  released: boolean
}>

export type PitchforksBellPowerState = Readonly<{
  runId: string
  requiredResponses: number
  admittedNotes: readonly string[]
  taughtPair: PitchforksBellPowerNotePair
  /** Earned normal responses, saturated at `requiredResponses`. */
  charge: number
  phase: PitchforksBellPowerPhase
  /** All same-run response/activation event identities consumed by this run. */
  consumedEventIds: readonly string[]
  /** Notes confirmed in the current activation attempt (zero, one, or two). */
  activationNotes: readonly string[]
  /** Exactly one receipt may be pending until a successful release acknowledgement. */
  pendingReceipt: PitchforksBellPowerReceipt | null
  /** Receipt identities remain spent/issued for the lifetime of this run. */
  issuedReceiptIds: readonly string[]
  spentReceiptIds: readonly string[]
  nextReceiptSequence: number
}> 

export type PitchforksBellPowerCombatReason =
  | 'accepted'
  | 'saturated'
  | 'invalid-response'
  | 'stale-run'
  | 'duplicate-event'
  | 'not-normal-voice'
  | 'not-correct'
  | 'invalid-note'
  | 'unadmitted-note'

export type PitchforksBellPowerCombatDecision = Readonly<{
  state: PitchforksBellPowerState
  accepted: boolean
  charged: boolean
  reason: PitchforksBellPowerCombatReason
}> 

export type PitchforksBellPowerActivationReason =
  | 'started'
  | 'first-note-confirmed'
  | 'receipt-pending'
  | 'not-ready'
  | 'activation-active'
  | 'pending-receipt'
  | 'cancelled'
  | 'not-activating'
  | 'stale-run'
  | 'duplicate-event'
  | 'not-confirmed'
  | 'invalid-note'
  | 'unadmitted-note'
  | 'wrong-octave'
  | 'wrong-order'
  | 'wrong-note'

export type PitchforksBellPowerActivationDecision = Readonly<{
  state: PitchforksBellPowerState
  accepted: boolean
  advanced: boolean
  completed: boolean
  receipt: PitchforksBellPowerReceipt | null
  reason: PitchforksBellPowerActivationReason
}> 

export type PitchforksBellPowerReleaseReason =
  | 'acknowledged'
  | 'release-failed'
  | 'invalid-acknowledgement'
  | 'stale-run'
  | 'duplicate-acknowledgement'
  | 'no-pending-receipt'
  | 'receipt-mismatch'

export type PitchforksBellPowerReleaseDecision = Readonly<{
  state: PitchforksBellPowerState
  accepted: boolean
  spent: boolean
  reason: PitchforksBellPowerReleaseReason
}> 

type UnknownRecord = Record<string, unknown>
type ParsedNote = Readonly<{ pitchClass: string; octave: number }>

const NOTE_PATTERN = /^([A-G](?:#|b)?)(-?\d+)$/
const PITCH_CLASS_SEMITONES: Readonly<Record<string, number>> = Object.freeze({
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
})

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function parseLiteralNote(value: unknown): ParsedNote | null {
  if (typeof value !== 'string') return null
  const match = NOTE_PATTERN.exec(value)
  if (!match) return null
  const pitchClass = match[1]
  const octave = Number(match[2])
  if (!(pitchClass in PITCH_CLASS_SEMITONES) || !Number.isSafeInteger(octave)) return null
  return Object.freeze({ pitchClass, octave })
}

function isLiteralNote(value: unknown): value is string {
  return parseLiteralNote(value) !== null
}

function noteDistance(left: string, right: string): number | null {
  const leftNote = parseLiteralNote(left)
  const rightNote = parseLiteralNote(right)
  if (!leftNote || !rightNote) return null
  return Math.abs(
    (leftNote.octave * 12 + PITCH_CLASS_SEMITONES[leftNote.pitchClass]) -
    (rightNote.octave * 12 + PITCH_CLASS_SEMITONES[rightNote.pitchClass]),
  )
}

function copyPair(pair: readonly [string, string]): PitchforksBellPowerNotePair {
  return Object.freeze([pair[0], pair[1]]) as PitchforksBellPowerNotePair
}

function copyReceipt(receipt: PitchforksBellPowerReceipt | null): PitchforksBellPowerReceipt | null {
  if (receipt === null) return null
  return Object.freeze({
    receiptId: receipt.receiptId,
    runId: receipt.runId,
    taughtPair: copyPair(receipt.taughtPair),
  })
}

function validateConfig(config: unknown): asserts config is PitchforksBellPowerConfig {
  if (!isRecord(config)
    || !isIdentifier(config.runId)
    || typeof config.requiredResponses !== 'number'
    || !Number.isSafeInteger(config.requiredResponses)
    || config.requiredResponses <= 0
    || !Array.isArray(config.admittedNotes)
    || !Array.isArray(config.taughtPair)
    || config.taughtPair.length !== 2) {
    throw new TypeError('Invalid Bell power configuration: explicit runId, positive requiredResponses, admittedNotes, and two-note taughtPair are required')
  }

  const admitted = config.admittedNotes
  const admittedSet = new Set<string>()
  for (const note of admitted) {
    if (!isIdentifier(note) || !isLiteralNote(note) || admittedSet.has(note)) {
      throw new TypeError('Invalid Bell power configuration: admittedNotes must contain distinct literal notes')
    }
    admittedSet.add(note)
  }

  const first = config.taughtPair[0]
  const second = config.taughtPair[1]
  if (!isIdentifier(first) || !isIdentifier(second)
    || !isLiteralNote(first) || !isLiteralNote(second)
    || first === second
    || !admittedSet.has(first)
    || !admittedSet.has(second)
    || (noteDistance(first, second) ?? Number.POSITIVE_INFINITY) >= 12) {
    throw new TypeError('Invalid Bell power configuration: taughtPair must be two distinct nearby admitted literal notes')
  }
}

function makeState(values: {
  runId: string
  requiredResponses: number
  admittedNotes: readonly string[]
  taughtPair: readonly [string, string]
  charge: number
  phase: PitchforksBellPowerPhase
  consumedEventIds: readonly string[]
  activationNotes: readonly string[]
  pendingReceipt: PitchforksBellPowerReceipt | null
  issuedReceiptIds: readonly string[]
  spentReceiptIds: readonly string[]
  nextReceiptSequence: number
}): PitchforksBellPowerState {
  return Object.freeze({
    runId: values.runId,
    requiredResponses: values.requiredResponses,
    admittedNotes: Object.freeze([...values.admittedNotes]),
    taughtPair: copyPair(values.taughtPair),
    charge: values.charge,
    phase: values.phase,
    consumedEventIds: Object.freeze([...values.consumedEventIds]),
    activationNotes: Object.freeze([...values.activationNotes]),
    pendingReceipt: copyReceipt(values.pendingReceipt),
    issuedReceiptIds: Object.freeze([...values.issuedReceiptIds]),
    spentReceiptIds: Object.freeze([...values.spentReceiptIds]),
    nextReceiptSequence: values.nextReceiptSequence,
  })
}

function evolve(
  state: PitchforksBellPowerState,
  changes: Partial<{
    charge: number
    phase: PitchforksBellPowerPhase
    consumedEventIds: readonly string[]
    activationNotes: readonly string[]
    pendingReceipt: PitchforksBellPowerReceipt | null
    issuedReceiptIds: readonly string[]
    spentReceiptIds: readonly string[]
    nextReceiptSequence: number
  }>,
): PitchforksBellPowerState {
  return makeState({
    runId: state.runId,
    requiredResponses: state.requiredResponses,
    admittedNotes: state.admittedNotes,
    taughtPair: state.taughtPair,
    charge: changes.charge ?? state.charge,
    phase: changes.phase ?? state.phase,
    consumedEventIds: changes.consumedEventIds ?? state.consumedEventIds,
    activationNotes: changes.activationNotes ?? state.activationNotes,
    pendingReceipt: changes.pendingReceipt === undefined ? state.pendingReceipt : changes.pendingReceipt,
    issuedReceiptIds: changes.issuedReceiptIds ?? state.issuedReceiptIds,
    spentReceiptIds: changes.spentReceiptIds ?? state.spentReceiptIds,
    nextReceiptSequence: changes.nextReceiptSequence ?? state.nextReceiptSequence,
  })
}

function phaseForCharge(charge: number, requiredResponses: number): PitchforksBellPowerPhase {
  return charge >= requiredResponses ? 'ready' : 'charging'
}

function combatDecision(
  state: PitchforksBellPowerState,
  accepted: boolean,
  charged: boolean,
  reason: PitchforksBellPowerCombatReason,
): PitchforksBellPowerCombatDecision {
  return Object.freeze({ state, accepted, charged, reason })
}

function activationDecision(
  state: PitchforksBellPowerState,
  accepted: boolean,
  advanced: boolean,
  completed: boolean,
  reason: PitchforksBellPowerActivationReason,
  receipt: PitchforksBellPowerReceipt | null = null,
): PitchforksBellPowerActivationDecision {
  return Object.freeze({ state, accepted, advanced, completed, receipt: copyReceipt(receipt), reason })
}

function releaseDecision(
  state: PitchforksBellPowerState,
  accepted: boolean,
  spent: boolean,
  reason: PitchforksBellPowerReleaseReason,
): PitchforksBellPowerReleaseDecision {
  return Object.freeze({ state, accepted, spent, reason })
}

/** Create an empty immutable ledger for one explicit run and teaching pair. */
export function createPitchforksBellPowerState(
  config: PitchforksBellPowerConfig,
): PitchforksBellPowerState {
  validateConfig(config)
  return makeState({
    runId: config.runId,
    requiredResponses: config.requiredResponses,
    admittedNotes: config.admittedNotes,
    taughtPair: [config.taughtPair[0], config.taughtPair[1]],
    charge: 0,
    phase: 'charging',
    consumedEventIds: [],
    activationNotes: [],
    pendingReceipt: null,
    issuedReceiptIds: [],
    spentReceiptIds: [],
    nextReceiptSequence: 0,
  })
}

function isExplicitlyFalseOrMissing(value: unknown): boolean {
  return value === undefined || value === false
}

/**
 * Consume one normal voice combat identity. Even a valid response received at
 * the cap consumes its event ID, so it cannot be replayed after a later spend.
 */
export function acceptPitchforksBellPowerCombatResponse(
  state: PitchforksBellPowerState,
  response: PitchforksBellPowerCombatResponse,
): PitchforksBellPowerCombatDecision {
  if (!isRecord(response)) return combatDecision(state, false, false, 'invalid-response')
  if (response.runId !== state.runId) return combatDecision(state, false, false, 'stale-run')
  if (!isIdentifier(response.eventId)) return combatDecision(state, false, false, 'invalid-response')
  if (state.consumedEventIds.includes(response.eventId)) {
    return combatDecision(state, false, false, 'duplicate-event')
  }

  const consumedEventIds = [...state.consumedEventIds, response.eventId]
  const rejectAfterConsume = (reason: PitchforksBellPowerCombatReason): PitchforksBellPowerCombatDecision =>
    combatDecision(evolve(state, { consumedEventIds }), false, false, reason)

  if (response.lane !== 'voice' || response.source !== 'combat') {
    return rejectAfterConsume('not-normal-voice')
  }
  if (response.correct !== true
    || !isExplicitlyFalseOrMissing(response.demo)
    || !isExplicitlyFalseOrMissing(response.simulated)
    || !isExplicitlyFalseOrMissing(response.stale)) {
    return rejectAfterConsume('not-correct')
  }
  if (!isLiteralNote(response.note)) return rejectAfterConsume('invalid-note')
  if (!state.admittedNotes.includes(response.note)) return rejectAfterConsume('unadmitted-note')

  const nextCharge = Math.min(state.requiredResponses, state.charge + 1)
  const charged = nextCharge > state.charge
  const phase = state.phase === 'activating' || state.phase === 'pending'
    ? state.phase
    : phaseForCharge(nextCharge, state.requiredResponses)
  return combatDecision(
    evolve(state, { charge: nextCharge, phase, consumedEventIds }),
    true,
    charged,
    charged ? 'accepted' : 'saturated',
  )
}

/** Begin the ordered two-note activation attempt once charge is ready. */
export function startPitchforksBellPowerActivation(
  state: PitchforksBellPowerState,
): PitchforksBellPowerActivationDecision {
  if (state.pendingReceipt !== null || state.phase === 'pending') {
    return activationDecision(state, false, false, false, 'pending-receipt')
  }
  if (state.phase === 'activating') {
    return activationDecision(state, false, false, false, 'activation-active')
  }
  if (state.charge < state.requiredResponses) {
    return activationDecision(state, false, false, false, 'not-ready')
  }
  return activationDecision(
    evolve(state, { phase: 'activating', activationNotes: [] }),
    true,
    false,
    false,
    'started',
  )
}

/** Cancel only the current activation attempt; earned charge remains intact. */
export function cancelPitchforksBellPowerActivation(
  state: PitchforksBellPowerState,
): PitchforksBellPowerActivationDecision {
  if (state.phase !== 'activating') {
    return activationDecision(
      state,
      false,
      false,
      false,
      state.pendingReceipt !== null || state.phase === 'pending' ? 'pending-receipt' : 'not-activating',
    )
  }
  return activationDecision(
    evolve(state, { phase: 'ready', activationNotes: [] }),
    true,
    false,
    false,
    'cancelled',
  )
}

function activationWrongReason(
  expected: string,
  actual: string,
  taughtPair: PitchforksBellPowerNotePair,
): 'wrong-octave' | 'wrong-order' | 'wrong-note' {
  const expectedParsed = parseLiteralNote(expected)
  const actualParsed = parseLiteralNote(actual)
  if (expectedParsed && actualParsed
    && expectedParsed.pitchClass === actualParsed.pitchClass
    && expectedParsed.octave !== actualParsed.octave) {
    return 'wrong-octave'
  }
  if (taughtPair.includes(actual)) return 'wrong-order'
  return 'wrong-note'
}

/**
 * Accept one caller-confirmed activation note. Wrong input clears only the
 * attempt, not charge; a completed pair mints exactly one pending receipt.
 */
export function acceptPitchforksBellPowerActivationNote(
  state: PitchforksBellPowerState,
  input: PitchforksBellPowerActivationNote,
): PitchforksBellPowerActivationDecision {
  if (!isRecord(input)) return activationDecision(state, false, false, false, 'invalid-note')
  if (input.runId !== state.runId) return activationDecision(state, false, false, false, 'stale-run')
  if (!isIdentifier(input.eventId)) return activationDecision(state, false, false, false, 'invalid-note')
  if (state.consumedEventIds.includes(input.eventId)) {
    return activationDecision(state, false, false, false, 'duplicate-event')
  }
  if (input.confirmed !== true) return activationDecision(state, false, false, false, 'not-confirmed')
  if (state.pendingReceipt !== null || state.phase === 'pending') {
    return activationDecision(state, false, false, false, 'pending-receipt')
  }
  if (state.phase !== 'activating') {
    return activationDecision(state, false, false, false, 'not-activating')
  }

  const consumedEventIds = [...state.consumedEventIds, input.eventId]
  const clearAttempt = (reason: PitchforksBellPowerActivationReason): PitchforksBellPowerActivationDecision =>
    activationDecision(
      evolve(state, { phase: 'ready', activationNotes: [], consumedEventIds }),
      false,
      false,
      false,
      reason,
    )

  if (!isLiteralNote(input.note)) return clearAttempt('invalid-note')

  const index = state.activationNotes.length
  const expected = state.taughtPair[index]
  if (!expected) return clearAttempt('wrong-note')

  if (input.note !== expected) {
    return clearAttempt(activationWrongReason(expected, input.note, state.taughtPair))
  }
  if (!state.admittedNotes.includes(input.note)) return clearAttempt('unadmitted-note')

  const activationNotes = [...state.activationNotes, input.note]
  if (activationNotes.length < 2) {
    return activationDecision(
      evolve(state, { activationNotes, consumedEventIds }),
      true,
      true,
      false,
      'first-note-confirmed',
    )
  }

  const receiptId = `bell-power:${state.runId}:${state.nextReceiptSequence + 1}`
  const receipt: PitchforksBellPowerReceipt = Object.freeze({
    receiptId,
    runId: state.runId,
    taughtPair: copyPair(state.taughtPair),
  })
  const nextState = evolve(state, {
    phase: 'pending',
    activationNotes,
    consumedEventIds,
    pendingReceipt: receipt,
    issuedReceiptIds: [...state.issuedReceiptIds, receiptId],
    nextReceiptSequence: state.nextReceiptSequence + 1,
  })
  return activationDecision(nextState, true, true, true, 'receipt-pending', receipt)
}

/**
 * Close the caller-owned wave handoff. Failure keeps charge and the same
 * pending receipt for retry; success spends exactly once.
 */
export function acknowledgePitchforksBellPowerWaveRelease(
  state: PitchforksBellPowerState,
  input: PitchforksBellPowerWaveReleaseAcknowledgement,
): PitchforksBellPowerReleaseDecision {
  if (!isRecord(input)
    || !isIdentifier(input.runId)
    || !isIdentifier(input.receiptId)) {
    return releaseDecision(state, false, false, 'invalid-acknowledgement')
  }
  if (input.runId !== state.runId) return releaseDecision(state, false, false, 'stale-run')

  if (typeof input.released !== 'boolean') return releaseDecision(state, false, false, 'invalid-acknowledgement')
  if (state.spentReceiptIds.includes(input.receiptId)) {
    return releaseDecision(state, false, false, 'duplicate-acknowledgement')
  }
  const pending = state.pendingReceipt
  if (pending === null) return releaseDecision(state, false, false, 'no-pending-receipt')
  if (pending.receiptId !== input.receiptId) {
    return releaseDecision(state, false, false, 'receipt-mismatch')
  }
  if (!input.released) return releaseDecision(state, true, false, 'release-failed')

  return releaseDecision(
    evolve(state, {
      phase: 'charging',
      charge: 0,
      pendingReceipt: null,
      spentReceiptIds: [...state.spentReceiptIds, pending.receiptId],
    }),
    true,
    true,
    'acknowledged',
  )
}
