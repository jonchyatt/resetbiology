/**
 * Pure Galvanic Sweep accounting. The caller must validate the current
 * snapshot/version, publish `nextState`, then dispatch returned intents to
 * the existing musical/recoil effects. This helper has no callbacks and
 * cannot make effect execution stale-safe by itself.
 */
import type { PitchforksThunderheadLockReceipt, PitchforksThunderheadTarget } from './pitchforksThunderhead'

export type PitchforksGalvanicTarget = Pick<PitchforksThunderheadTarget, 'targetKey' | 'note' | 'octave'>
export type PitchforksGalvanicLock = Readonly<
  Pick<PitchforksThunderheadLockReceipt, 'lockId' | 'targetKey' | 'note' | 'octave'> & { battleId: string }
>
export type PitchforksGalvanicState = Readonly<{
  battleId: string; version: number
  consumedLockIds: readonly string[]; processedAttackIds: readonly string[]
}>
export type PitchforksGalvanicRequest = Readonly<{
  battleId: string; attackId: string; expectedVersion: number
  tines: readonly PitchforksGalvanicTarget[]; locks: readonly PitchforksGalvanicLock[]; cancelled?: boolean
}>
export type PitchforksGalvanicStrikeIntent = Readonly<{
  kind: 'strike'; targetKey: string; note: string; octave: number; lockId: string
}>
export type PitchforksGalvanicRecoilIntent = Readonly<{
  kind: 'recoil'; targetKey: string; note: string; octave: number; reason: 'unbacked'
}>
export type PitchforksGalvanicOutcome = PitchforksGalvanicStrikeIntent | PitchforksGalvanicRecoilIntent
export type PitchforksGalvanicPlanReason =
  | 'accepted' | 'invalid-state' | 'invalid-request' | 'invalid-battle-id' | 'battle-mismatch'
  | 'invalid-attack-id' | 'invalid-version' | 'stale-version' | 'duplicate-attack' | 'cancelled'
  | 'version-exhausted' | 'invalid-tines' | 'invalid-target' | 'duplicate-target'
  | 'invalid-locks' | 'invalid-lock' | 'duplicate-lock'
export type PitchforksGalvanicPlan = Readonly<{
  accepted: boolean; reason: PitchforksGalvanicPlanReason; expectedVersion: number
  nextState: PitchforksGalvanicState; outcomes: readonly PitchforksGalvanicOutcome[]
}>

type UnknownRecord = Record<string, unknown>
const NOTE_PATTERN = /^([A-G](?:#|b)?)(-?\d+)$/
const EMPTY_OUTCOMES = Object.freeze([]) as readonly PitchforksGalvanicOutcome[]
const isRecord = (value: unknown): value is UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const isIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.trim() === value
const isSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value)
const isVersion = (value: unknown): value is number => isSafeInteger(value) && value >= 0
const hasDuplicate = (values: readonly string[]) => new Set(values).size !== values.length
function hasOnlyIdentifiers(values: readonly unknown[]): values is readonly string[] {
  for (let index = 0; index < values.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(values, index) || !isIdentifier(values[index])) return false
  }
  return true
}

function parsePitch(note: unknown, octave: unknown): { note: string; octave: number } | null {
  if (typeof note !== 'string' || !isSafeInteger(octave)) return null
  const match = NOTE_PATTERN.exec(note)
  const parsedOctave = match === null ? Number.NaN : Number(match[2])
  return match !== null && Number.isSafeInteger(parsedOctave) && parsedOctave === octave ? { note, octave } : null
}

function copyTarget(value: UnknownRecord): PitchforksGalvanicTarget | null {
  const targetKey = value.targetKey
  if (!isIdentifier(targetKey)) return null
  const pitch = parsePitch(value.note, value.octave)
  return pitch === null ? null : Object.freeze({ targetKey, ...pitch })
}

function copyLock(value: UnknownRecord): PitchforksGalvanicLock | null {
  const lockId = value.lockId
  const battleId = value.battleId
  const targetKey = value.targetKey
  if (!isIdentifier(lockId) || !isIdentifier(battleId) || !isIdentifier(targetKey)) return null
  const pitch = parsePitch(value.note, value.octave)
  return pitch === null ? null : Object.freeze({
    lockId, battleId, targetKey, ...pitch,
  })
}

function isValidState(value: unknown): value is PitchforksGalvanicState {
  if (!isRecord(value) || !isIdentifier(value.battleId) || !isVersion(value.version)) return false
  const locks = value.consumedLockIds
  const attacks = value.processedAttackIds
  if (!Array.isArray(locks) || !Array.isArray(attacks)) return false
  if (!hasOnlyIdentifiers(locks) || !hasOnlyIdentifiers(attacks)) return false
  return !hasDuplicate(locks) && !hasDuplicate(attacks)
}

function makeState(
  battleId: string, version: number, consumedLockIds: readonly string[], processedAttackIds: readonly string[],
): PitchforksGalvanicState {
  return Object.freeze({
    battleId, version,
    consumedLockIds: Object.freeze([...consumedLockIds]),
    processedAttackIds: Object.freeze([...processedAttackIds]),
  })
}

function makePlan(
  state: PitchforksGalvanicState, accepted: boolean, reason: PitchforksGalvanicPlanReason,
  expectedVersion: number, nextState = state, outcomes: readonly PitchforksGalvanicOutcome[] = EMPTY_OUTCOMES,
): PitchforksGalvanicPlan {
  return Object.freeze({ accepted, reason, expectedVersion, nextState, outcomes: Object.freeze([...outcomes]) })
}

const compareIds = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0

/** Create an empty immutable ledger for one battle only. */
export function createPitchforksGalvanicState(battleId: string): PitchforksGalvanicState {
  if (!isIdentifier(battleId)) throw new TypeError('battleId must be a non-empty identifier')
  return makeState(battleId, 0, [], [])
}

/** Match exact requested tines to distinct earned locks; never create a lock. */
export function planPitchforksGalvanicSweep(
  state: PitchforksGalvanicState, request: PitchforksGalvanicRequest,
): PitchforksGalvanicPlan {
  const stateVersion = isRecord(state) && isVersion(state.version) ? state.version : 0
  if (!isValidState(state)) return makePlan(state, false, 'invalid-state', stateVersion)
  if (!isRecord(request)) return makePlan(state, false, 'invalid-request', state.version)
  const expectedVersion = isVersion(request.expectedVersion) ? request.expectedVersion : state.version
  if (!isIdentifier(request.battleId)) return makePlan(state, false, 'invalid-battle-id', expectedVersion)
  if (request.battleId !== state.battleId) return makePlan(state, false, 'battle-mismatch', expectedVersion)
  if (!isIdentifier(request.attackId)) return makePlan(state, false, 'invalid-attack-id', expectedVersion)
  if (!isVersion(request.expectedVersion)) return makePlan(state, false, 'invalid-version', expectedVersion)
  if (request.cancelled !== undefined && typeof request.cancelled !== 'boolean') {
    return makePlan(state, false, 'invalid-request', expectedVersion)
  }
  if (request.cancelled === true) return makePlan(state, false, 'cancelled', expectedVersion)
  if (request.expectedVersion !== state.version) return makePlan(state, false, 'stale-version', expectedVersion)
  if (state.processedAttackIds.includes(request.attackId)) return makePlan(state, false, 'duplicate-attack', expectedVersion)
  if (!Array.isArray(request.tines)) return makePlan(state, false, 'invalid-tines', expectedVersion)
  if (!Array.isArray(request.locks)) return makePlan(state, false, 'invalid-locks', expectedVersion)

  const tines: PitchforksGalvanicTarget[] = []
  const targetKeys = new Set<string>()
  for (const rawTine of request.tines) {
    if (!isRecord(rawTine)) return makePlan(state, false, 'invalid-target', expectedVersion)
    const parsed = copyTarget(rawTine)
    if (parsed === null) return makePlan(state, false, 'invalid-target', expectedVersion)
    if (targetKeys.has(parsed.targetKey)) return makePlan(state, false, 'duplicate-target', expectedVersion)
    targetKeys.add(parsed.targetKey); tines.push(parsed)
  }

  const locks: PitchforksGalvanicLock[] = []
  const lockIds = new Set<string>()
  for (const rawLock of request.locks) {
    if (!isRecord(rawLock)) return makePlan(state, false, 'invalid-lock', expectedVersion)
    const parsed = copyLock(rawLock)
    if (parsed === null) return makePlan(state, false, 'invalid-lock', expectedVersion)
    if (lockIds.has(parsed.lockId)) return makePlan(state, false, 'duplicate-lock', expectedVersion)
    lockIds.add(parsed.lockId); locks.push(parsed)
  }

  if (state.version === Number.MAX_SAFE_INTEGER) {
    return makePlan(state, false, 'version-exhausted', expectedVersion)
  }

  const orderedTines = Object.freeze(tines)
  const consumed = new Set(state.consumedLockIds)
  const spentInSweep: string[] = []
  const outcomes: PitchforksGalvanicOutcome[] = []
  for (const tine of orderedTines) {
    let selected: PitchforksGalvanicLock | null = null
    for (const lock of locks) {
      if (consumed.has(lock.lockId) || lock.battleId !== state.battleId
        || lock.targetKey !== tine.targetKey || lock.note !== tine.note || lock.octave !== tine.octave) continue
      if (selected === null || compareIds(lock.lockId, selected.lockId) < 0) selected = lock
    }
    if (selected === null) {
      outcomes.push(Object.freeze({ kind: 'recoil', targetKey: tine.targetKey, note: tine.note, octave: tine.octave, reason: 'unbacked' }))
      continue
    }
    consumed.add(selected.lockId); spentInSweep.push(selected.lockId)
    outcomes.push(Object.freeze({ kind: 'strike', targetKey: tine.targetKey, note: tine.note, octave: tine.octave, lockId: selected.lockId }))
  }

  const nextState = makeState(
    state.battleId, state.version + 1, [...state.consumedLockIds, ...spentInSweep],
    [...state.processedAttackIds, request.attackId],
  )
  return makePlan(state, true, 'accepted', expectedVersion, nextState, outcomes)
}
