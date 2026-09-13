/**
 * Pure lifecycle for the staged Close Smash receipt.
 *
 * This module owns neither pitch detection nor musical resolution. The
 * caller supplies the already-earned lock, the live target key, and logical
 * times, then routes the single returned consumption intent to the existing
 * strike authority.
 */

export type PitchforksCloseSmashPhase = 'idle' | 'ready' | 'pending' | 'settle'

export type PitchforksCloseSmashConsumer = 'smash' | 'ordinary-fallback'

export type PitchforksCloseSmashReceipt = Readonly<{
  lockId: string
  targetKey: string
  pitch: string
  villagerId: string
  tineIndex: number
}>

export type PitchforksCloseSmashState = Readonly<{
  /** `ready` is the only phase that can be consumed or superseded. */
  phase: PitchforksCloseSmashPhase
  /** The earned receipt is retained through pending/settle for traceability. */
  receipt: PitchforksCloseSmashReceipt | null
  /** The one compare-and-swap winner, if a receipt has been consumed. */
  consumer: PitchforksCloseSmashConsumer | null
  /** Caller-provided contact time for a Smash action; never invented here. */
  contactAtMs: number | null
  /** True only after the one eligible contact intent has been presented. */
  contactPresented: boolean
  /** Keys and lock ids already admitted in this lifecycle. */
  seenTargetKeys: readonly string[]
  seenLockIds: readonly string[]
}>

export type PitchforksCloseSmashArmInput = Readonly<{
  receipt: unknown
  /** This is an assertion from the existing close-boundary authority. */
  existingCloseBoundaryEligible: boolean
}>

export type PitchforksCloseSmashConsumeInput = Readonly<{
  consumer: PitchforksCloseSmashConsumer
  currentTargetKey: string | null
  /** Use one logical clock supplied by the caller; wall-clock time is not read. */
  logicalTimeMs?: number
  /** Alias accepted for callers whose existing loop calls this value `nowMs`. */
  nowMs?: number
  /** Required for ordinary fallback; the caller owns the grace policy. */
  deadlineMs?: number
  /** Required for Smash; the caller owns the designated contact time. */
  contactAtMs?: number
}>

export type PitchforksCloseSmashConsumptionIntent = Readonly<{
  kind: 'smash' | 'ordinary-fallback'
  consumer: PitchforksCloseSmashConsumer
  receipt: PitchforksCloseSmashReceipt
  /** `false` makes the fallback's ordinary presentation explicit. */
  smash: boolean
  pose: 'close-smash' | 'ordinary'
  contactAtMs: number | null
}>

export type PitchforksCloseSmashConsumeReason =
  | 'consumed'
  | 'not-ready'
  | 'already-consumed'
  | 'stale-target'
  | 'before-deadline'
  | 'invalid-request'

export type PitchforksCloseSmashConsumeDecision = Readonly<{
  state: PitchforksCloseSmashState
  /** At most one consumption intent can be returned for an armed receipt. */
  intent: PitchforksCloseSmashConsumptionIntent | null
  reason: PitchforksCloseSmashConsumeReason
}>

export type PitchforksCloseSmashContactInput = Readonly<{
  currentTargetKey: string | null
  logicalTimeMs?: number
  nowMs?: number
}>

export type PitchforksCloseSmashContactIntent = Readonly<{
  kind: 'smash-contact'
  receipt: PitchforksCloseSmashReceipt
  contactAtMs: number
  smash: true
  pose: 'close-smash'
}>

export type PitchforksCloseSmashContactReason =
  | 'contact-presented'
  | 'before-contact-time'
  | 'not-pending-smash'
  | 'stale-target'
  | 'invalid-request'

export type PitchforksCloseSmashContactDecision = Readonly<{
  state: PitchforksCloseSmashState
  intent: PitchforksCloseSmashContactIntent | null
  reason: PitchforksCloseSmashContactReason
}>

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

/** Validate without coercing the already-earned receipt. */
export function isPitchforksCloseSmashReceipt(value: unknown): value is PitchforksCloseSmashReceipt {
  if (!value || typeof value !== 'object') return false
  const receipt = value as Record<string, unknown>
  return isNonEmptyString(receipt.lockId) &&
    isNonEmptyString(receipt.targetKey) &&
    isNonEmptyString(receipt.pitch) &&
    isNonEmptyString(receipt.villagerId) &&
    typeof receipt.tineIndex === 'number' &&
    Number.isSafeInteger(receipt.tineIndex) &&
    receipt.tineIndex >= 0
}

function copyReceipt(receipt: PitchforksCloseSmashReceipt): PitchforksCloseSmashReceipt {
  return Object.freeze({
    lockId: receipt.lockId,
    targetKey: receipt.targetKey,
    pitch: receipt.pitch,
    villagerId: receipt.villagerId,
    tineIndex: receipt.tineIndex,
  })
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)])
}

function makeState(values: {
  phase: PitchforksCloseSmashPhase
  receipt: PitchforksCloseSmashReceipt | null
  consumer: PitchforksCloseSmashConsumer | null
  contactAtMs: number | null
  contactPresented: boolean
  seenTargetKeys: readonly string[]
  seenLockIds: readonly string[]
}): PitchforksCloseSmashState {
  return Object.freeze({
    phase: values.phase,
    receipt: values.receipt,
    consumer: values.consumer,
    contactAtMs: values.contactAtMs,
    contactPresented: values.contactPresented,
    seenTargetKeys: unique(values.seenTargetKeys),
    seenLockIds: unique(values.seenLockIds),
  })
}

function copyState(
  state: PitchforksCloseSmashState,
  changes: Partial<{
    phase: PitchforksCloseSmashPhase
    receipt: PitchforksCloseSmashReceipt | null
    consumer: PitchforksCloseSmashConsumer | null
    contactAtMs: number | null
    contactPresented: boolean
    seenTargetKeys: readonly string[]
    seenLockIds: readonly string[]
  }> = {},
): PitchforksCloseSmashState {
  return makeState({
    phase: changes.phase ?? state.phase,
    receipt: changes.receipt === undefined ? state.receipt : changes.receipt,
    consumer: changes.consumer === undefined ? state.consumer : changes.consumer,
    contactAtMs: changes.contactAtMs === undefined ? state.contactAtMs : changes.contactAtMs,
    contactPresented: changes.contactPresented ?? state.contactPresented,
    seenTargetKeys: changes.seenTargetKeys ?? state.seenTargetKeys,
    seenLockIds: changes.seenLockIds ?? state.seenLockIds,
  })
}

export function createPitchforksCloseSmashState(): PitchforksCloseSmashState {
  return makeState({
    phase: 'idle',
    receipt: null,
    consumer: null,
    contactAtMs: null,
    contactPresented: false,
    seenTargetKeys: [],
    seenLockIds: [],
  })
}

/**
 * Admit one caller-asserted exact lock. No detector, pitch grading, or close
 * boundary calculation happens here.
 */
export function armPitchforksCloseSmash(
  state: PitchforksCloseSmashState,
  input: PitchforksCloseSmashArmInput,
): PitchforksCloseSmashState {
  if (
    state.phase !== 'idle' ||
    state.receipt !== null ||
    input?.existingCloseBoundaryEligible !== true ||
    !isPitchforksCloseSmashReceipt(input?.receipt)
  ) {
    return state
  }

  const receipt = copyReceipt(input.receipt)
  if (
    state.seenTargetKeys.includes(receipt.targetKey) ||
    state.seenLockIds.includes(receipt.lockId)
  ) {
    return state
  }

  return copyState(state, {
    phase: 'ready',
    receipt,
    consumer: null,
    contactAtMs: null,
    contactPresented: false,
    seenTargetKeys: [...state.seenTargetKeys, receipt.targetKey],
    seenLockIds: [...state.seenLockIds, receipt.lockId],
  })
}

function logicalTime(input: { logicalTimeMs?: number; nowMs?: number }): number | null {
  const value = input.logicalTimeMs ?? input.nowMs
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function noConsumption(
  state: PitchforksCloseSmashState,
  reason: PitchforksCloseSmashConsumeReason,
): PitchforksCloseSmashConsumeDecision {
  return { state, intent: null, reason }
}

function voidStaleReceipt(state: PitchforksCloseSmashState): PitchforksCloseSmashState {
  return copyState(state, {
    phase: 'idle',
    receipt: null,
    consumer: null,
    contactAtMs: null,
    contactPresented: false,
  })
}

/**
 * Choose Smash or ordinary fallback for the armed receipt at one serialized
 * owner boundary. The caller must replace its latest state with the returned
 * state before processing the next queued click/per-frame fallback. This pure
 * helper intentionally does not protect a caller that replays an old snapshot.
 */
export function consumePitchforksCloseSmash(
  state: PitchforksCloseSmashState,
  input: PitchforksCloseSmashConsumeInput,
): PitchforksCloseSmashConsumeDecision {
  if (state.phase !== 'ready' || state.receipt === null) {
    return noConsumption(state, state.phase === 'pending' || state.phase === 'settle' ? 'already-consumed' : 'not-ready')
  }

  if (
    !input ||
    (input.consumer !== 'smash' && input.consumer !== 'ordinary-fallback') ||
    (typeof input.currentTargetKey !== 'string' && input.currentTargetKey !== null)
  ) {
    return noConsumption(state, 'invalid-request')
  }

  // A missing/mismatched live key voids the receipt and produces no gameplay
  // intent. It cannot be carried to another villager or tine.
  if (input.currentTargetKey === null || input.currentTargetKey !== state.receipt.targetKey) {
    return {
      state: voidStaleReceipt(state),
      intent: null,
      reason: 'stale-target',
    }
  }

  const time = logicalTime(input)
  if (time === null) return noConsumption(state, 'invalid-request')

  let contactAtMs: number | null = null
  if (input.consumer === 'smash') {
    if (typeof input.contactAtMs !== 'number' || !Number.isFinite(input.contactAtMs)) {
      return noConsumption(state, 'invalid-request')
    }
    contactAtMs = input.contactAtMs
  } else {
    if (typeof input.deadlineMs !== 'number' || !Number.isFinite(input.deadlineMs)) {
      return noConsumption(state, 'invalid-request')
    }
    if (time < input.deadlineMs) return noConsumption(state, 'before-deadline')
  }

  const receipt = state.receipt
  const intent: PitchforksCloseSmashConsumptionIntent = Object.freeze({
    kind: input.consumer,
    consumer: input.consumer,
    receipt,
    smash: input.consumer === 'smash',
    pose: input.consumer === 'smash' ? 'close-smash' : 'ordinary',
    contactAtMs,
  })
  return {
    state: copyState(state, {
      phase: 'pending',
      consumer: input.consumer,
      contactAtMs,
      contactPresented: false,
    }),
    intent,
    reason: 'consumed',
  }
}

function noContact(
  state: PitchforksCloseSmashState,
  reason: PitchforksCloseSmashContactReason,
): PitchforksCloseSmashContactDecision {
  return { state, intent: null, reason }
}

/** Return the single Smash contact intent, but never before its supplied time. */
export function presentPitchforksCloseSmashContact(
  state: PitchforksCloseSmashState,
  input: PitchforksCloseSmashContactInput,
): PitchforksCloseSmashContactDecision {
  if (
    state.phase !== 'pending' ||
    state.consumer !== 'smash' ||
    state.receipt === null ||
    state.contactAtMs === null
  ) {
    return noContact(state, 'not-pending-smash')
  }

  if (state.contactPresented) return noContact(state, 'contact-presented')
  if (
    !input ||
    (typeof input.currentTargetKey !== 'string' && input.currentTargetKey !== null)
  ) {
    return noContact(state, 'invalid-request')
  }
  if (input.currentTargetKey === null || input.currentTargetKey !== state.receipt.targetKey) {
    return {
      state: voidStaleReceipt(state),
      intent: null,
      reason: 'stale-target',
    }
  }

  const time = logicalTime(input)
  if (time === null) return noContact(state, 'invalid-request')
  if (time < state.contactAtMs) return noContact(state, 'before-contact-time')

  const intent: PitchforksCloseSmashContactIntent = Object.freeze({
    kind: 'smash-contact',
    receipt: state.receipt,
    contactAtMs: state.contactAtMs,
    smash: true,
    pose: 'close-smash',
  })
  return {
    state: copyState(state, { contactPresented: true }),
    intent,
    reason: 'contact-presented',
  }
}

/** Mark the caller-owned action animation as entering its spent/settle state. */
export function settlePitchforksCloseSmash(state: PitchforksCloseSmashState): PitchforksCloseSmashState {
  if (state.phase !== 'pending') return state
  if (state.consumer === 'smash' && !state.contactPresented) return state
  return copyState(state, { phase: 'settle' })
}

/** Release the spent receipt after the caller's existing action has settled. */
export function completePitchforksCloseSmashSettle(
  state: PitchforksCloseSmashState,
): PitchforksCloseSmashState {
  return state.phase === 'settle'
    ? copyState(state, {
      phase: 'idle',
      receipt: null,
      consumer: null,
      contactAtMs: null,
      contactPresented: false,
    })
    : state
}
