/**
 * Pure lifecycle for the Bell Tower's expanding release wave.
 *
 * The caller supplies an already-earned receipt, the release eligibility
 * decision, one logical clock, and the live walking roster. This module only
 * projects the ring and returns release/contact intents; all other gameplay
 * mutation and presentation effects remain caller-owned. The caller must
 * install each returned state before dispatching its intents.
 */

export type PitchforksBellWavePhase = 'idle' | 'active' | 'finished'

export type PitchforksBellWavePoint = Readonly<{
  x: number
  y: number
}>

/** The only receipt identity this lifecycle consumes. */
export type PitchforksBellWaveChargeReceipt = Readonly<{
  receiptId: string
}>

/**
 * The current live roster. Presence is normally enough to mean live and
 * walking; optional flags let a caller pass an unfiltered snapshot without
 * allowing dead, stopped, or spent villagers to receive a contact intent.
 */
export type PitchforksBellWaveVillager = Readonly<{
  stableID: string
  x: number
  y: number
  walking?: boolean
  alive?: boolean
  spent?: boolean
}>

export type PitchforksBellWaveObservation = Readonly<{
  stableID: string
  x: number
  y: number
}>

export type PitchforksBellWave = Readonly<{
  receiptId: string
  releasedAtMs: number
  bellOrigin: PitchforksBellWavePoint
  waveSpeed: number
  waveDurationMs: number
}>

export type PitchforksBellWaveState = Readonly<{
  phase: PitchforksBellWavePhase
  /** Retained through finish so the renderer can inspect the final wave. */
  wave: PitchforksBellWave | null
  lastLogicalTimeMs: number | null
  /** Contact IDs are per-wave; they reset only when a new release is accepted. */
  contactedStableIDs: readonly string[]
  /** Only villagers live and walking at release may ever be contacted. */
  eligibleStableIDs: readonly string[]
  /** Last trusted position for each still-valid eligible villager. */
  previousObservations: readonly PitchforksBellWaveObservation[]
  /** Missing/dead/stopped or equal-time-mutated IDs are permanently fail-closed for this wave. */
  invalidatedStableIDs: readonly string[]
  /** Receipt identities survive a finished wave until the caller explicitly resets. */
  consumedReceiptIds: readonly string[]
}>

export type PitchforksBellWaveReleaseInput = Readonly<{
  receipt: unknown
  /** Must be asserted by the caller's existing earned-charge authority. */
  releaseEligible: boolean
  logicalTimeMs: number
  bellOrigin: PitchforksBellWavePoint
  /** World units per logical millisecond; supplied by the caller. */
  waveSpeed: number
  waveDurationMs: number
  /** Required release-time live walking snapshot; later IDs cannot join this wave. */
  walkingVillagers: readonly PitchforksBellWaveVillager[]
}>

export type PitchforksBellWaveReleaseIntent = Readonly<{
  kind: 'bell-wave-release'
  receiptId: string
  releasedAtMs: number
  bellOrigin: PitchforksBellWavePoint
  waveSpeed: number
  waveDurationMs: number
}>

export type PitchforksBellWaveReleaseReason =
  | 'released'
  | 'invalid-input'
  | 'not-eligible'
  | 'active-wave'
  | 'duplicate-receipt'
  | 'clock-reversed'

export type PitchforksBellWaveReleaseDecision = Readonly<{
  state: PitchforksBellWaveState
  accepted: boolean
  intent: PitchforksBellWaveReleaseIntent | null
  reason: PitchforksBellWaveReleaseReason
}>

export type PitchforksBellWaveAdvanceInput = Readonly<{
  logicalTimeMs: number
  walkingVillagers: readonly PitchforksBellWaveVillager[]
}>

export type PitchforksBellWaveContactIntent = Readonly<{
  kind: 'bell-wave-contact'
  receiptId: string
  stableID: string
  /** The mathematical crossing time, not the frame delivery time. */
  contactAtMs: number
  position: PitchforksBellWavePoint
}>

export type PitchforksBellWaveAdvanceReason =
  | 'advanced'
  | 'invalid-input'
  | 'clock-reversed'
  | 'not-active'
  | 'finished'

export type PitchforksBellWaveAdvanceDecision = Readonly<{
  state: PitchforksBellWaveState
  accepted: boolean
  intents: readonly PitchforksBellWaveContactIntent[]
  reason: PitchforksBellWaveAdvanceReason
}>

export type PitchforksBellWaveProjection = Readonly<{
  phase: PitchforksBellWavePhase
  visible: boolean
  bellOrigin: PitchforksBellWavePoint | null
  radius: number
  maxRadius: number
  progress: number
}>

type UnknownRecord = Record<string, unknown>
type ParsedVillager = Readonly<{
  stableID: string
  x: number
  y: number
  liveWalking: boolean
}>

type Crossing = Readonly<{
  elapsedMs: number
  position: PitchforksBellWavePoint
}>

const EMPTY_CONTACT_INTENTS = Object.freeze([]) as readonly PitchforksBellWaveContactIntent[]

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function isLogicalTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function copyPoint(value: PitchforksBellWavePoint): PitchforksBellWavePoint {
  return Object.freeze({ x: value.x, y: value.y })
}

function parsePoint(value: unknown): PitchforksBellWavePoint | null {
  if (!isRecord(value) || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null
  return copyPoint({ x: value.x as number, y: value.y as number })
}

function parseReceipt(value: unknown): PitchforksBellWaveChargeReceipt | null {
  if (!isRecord(value) || !isIdentifier(value.receiptId)) return null
  return Object.freeze({ receiptId: value.receiptId })
}

function optionalBoolean(value: UnknownRecord, key: string): boolean | null {
  const candidate = value[key]
  return candidate === undefined || typeof candidate === 'boolean' ? candidate ?? null : null
}

function parseVillagers(value: unknown): readonly ParsedVillager[] | null {
  if (!Array.isArray(value)) return null

  const seen = new Set<string>()
  const parsed: ParsedVillager[] = []
  for (const raw of value) {
    if (!isRecord(raw) || !isIdentifier(raw.stableID)
      || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)
      || seen.has(raw.stableID)) return null

    const walking = optionalBoolean(raw, 'walking')
    const alive = optionalBoolean(raw, 'alive')
    const spent = optionalBoolean(raw, 'spent')
    if (walking === null && raw.walking !== undefined
      || alive === null && raw.alive !== undefined
      || spent === null && raw.spent !== undefined) return null

    seen.add(raw.stableID)
    parsed.push(Object.freeze({
      stableID: raw.stableID,
      x: raw.x as number,
      y: raw.y as number,
      liveWalking: walking !== false && alive !== false && spent !== true,
    }))
  }
  return Object.freeze(parsed)
}

function copyWave(value: PitchforksBellWave): PitchforksBellWave {
  return Object.freeze({
    receiptId: value.receiptId,
    releasedAtMs: value.releasedAtMs,
    bellOrigin: copyPoint(value.bellOrigin),
    waveSpeed: value.waveSpeed,
    waveDurationMs: value.waveDurationMs,
  })
}

function copyObservation(value: PitchforksBellWaveObservation): PitchforksBellWaveObservation {
  return Object.freeze({ stableID: value.stableID, x: value.x, y: value.y })
}

function makeState(values: {
  phase: PitchforksBellWavePhase
  wave: PitchforksBellWave | null
  lastLogicalTimeMs: number | null
  contactedStableIDs: readonly string[]
  eligibleStableIDs: readonly string[]
  previousObservations: readonly PitchforksBellWaveObservation[]
  invalidatedStableIDs: readonly string[]
  consumedReceiptIds: readonly string[]
}): PitchforksBellWaveState {
  return Object.freeze({
    phase: values.phase,
    wave: values.wave === null ? null : copyWave(values.wave),
    lastLogicalTimeMs: values.lastLogicalTimeMs,
    contactedStableIDs: Object.freeze([...values.contactedStableIDs]),
    eligibleStableIDs: Object.freeze([...values.eligibleStableIDs]),
    previousObservations: Object.freeze(values.previousObservations.map(copyObservation)),
    invalidatedStableIDs: Object.freeze([...values.invalidatedStableIDs]),
    consumedReceiptIds: Object.freeze([...values.consumedReceiptIds]),
  })
}

function releaseDecision(
  state: PitchforksBellWaveState,
  accepted: boolean,
  reason: PitchforksBellWaveReleaseReason,
  intent: PitchforksBellWaveReleaseIntent | null = null,
): PitchforksBellWaveReleaseDecision {
  return Object.freeze({ state, accepted, reason, intent })
}

function advanceDecision(
  state: PitchforksBellWaveState,
  accepted: boolean,
  reason: PitchforksBellWaveAdvanceReason,
  intents: readonly PitchforksBellWaveContactIntent[] = EMPTY_CONTACT_INTENTS,
): PitchforksBellWaveAdvanceDecision {
  return Object.freeze({ state, accepted, reason, intents: Object.freeze([...intents]) })
}

export function createPitchforksBellWaveState(): PitchforksBellWaveState {
  return makeState({
    phase: 'idle',
    wave: null,
    lastLogicalTimeMs: null,
    contactedStableIDs: [],
    eligibleStableIDs: [],
    previousObservations: [],
    invalidatedStableIDs: [],
    consumedReceiptIds: [],
  })
}

/** Clear the per-game receipt ledger only when the caller explicitly starts a new game. */
export function resetPitchforksBellWaveState(_state?: PitchforksBellWaveState): PitchforksBellWaveState {
  void _state
  return createPitchforksBellWaveState()
}

/**
 * Release one already-earned charge into one active wave. The receipt is
 * consumed before the caller handles the returned release intent.
 */
export function releasePitchforksBellWave(
  state: PitchforksBellWaveState,
  input: PitchforksBellWaveReleaseInput,
): PitchforksBellWaveReleaseDecision {
  if (!isRecord(input)
    || input.releaseEligible !== true
    || !isLogicalTime(input.logicalTimeMs)) {
    return releaseDecision(
      state,
      false,
      isRecord(input) && typeof input.releaseEligible === 'boolean' && input.releaseEligible === false
        ? 'not-eligible'
        : 'invalid-input',
    )
  }

  const receipt = parseReceipt(input.receipt)
  const origin = parsePoint(input.bellOrigin)
  const releaseRoster = parseVillagers(input.walkingVillagers)
  if (receipt === null || origin === null || releaseRoster === null
    || !isFinitePositive(input.waveSpeed)
    || !isFinitePositive(input.waveDurationMs)) {
    return releaseDecision(state, false, 'invalid-input')
  }

  const endAtMs = input.logicalTimeMs + input.waveDurationMs
  const maxRadius = input.waveSpeed * input.waveDurationMs
  if (!Number.isFinite(endAtMs) || endAtMs <= input.logicalTimeMs
    || !Number.isFinite(maxRadius) || maxRadius <= 0) {
    return releaseDecision(state, false, 'invalid-input')
  }
  if (state.lastLogicalTimeMs !== null && input.logicalTimeMs < state.lastLogicalTimeMs) {
    return releaseDecision(state, false, 'clock-reversed')
  }
  if (state.phase === 'active') return releaseDecision(state, false, 'active-wave')
  if (state.consumedReceiptIds.includes(receipt.receiptId)) {
    return releaseDecision(state, false, 'duplicate-receipt')
  }

  const wave: PitchforksBellWave = {
    receiptId: receipt.receiptId,
    releasedAtMs: input.logicalTimeMs,
    bellOrigin: origin,
    waveSpeed: input.waveSpeed,
    waveDurationMs: input.waveDurationMs,
  }
  const eligible = releaseRoster.filter(villager => villager.liveWalking)
  const nextState = makeState({
    phase: 'active',
    wave,
    lastLogicalTimeMs: input.logicalTimeMs,
    contactedStableIDs: [],
    eligibleStableIDs: eligible.map(villager => villager.stableID),
    previousObservations: eligible.map(villager => ({
      stableID: villager.stableID,
      x: villager.x,
      y: villager.y,
    })),
    invalidatedStableIDs: [],
    consumedReceiptIds: [...state.consumedReceiptIds, receipt.receiptId],
  })
  const intent: PitchforksBellWaveReleaseIntent = Object.freeze({
    kind: 'bell-wave-release',
    receiptId: receipt.receiptId,
    releasedAtMs: input.logicalTimeMs,
    bellOrigin: copyPoint(origin),
    waveSpeed: input.waveSpeed,
    waveDurationMs: input.waveDurationMs,
  })
  return releaseDecision(nextState, true, 'released', intent)
}

const compareStableIDs = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0

const ROOT_TOLERANCE = 1e-10

function tolerance(...values: number[]): number {
  return ROOT_TOLERANCE * Math.max(Number.EPSILON, ...values.map(value => Math.abs(value)))
}

function samePoint(left: PitchforksBellWavePoint, right: PitchforksBellWavePoint): boolean {
  return left.x === right.x && left.y === right.y
}

function interpolatePoint(
  from: PitchforksBellWavePoint,
  to: PitchforksBellWavePoint,
  fraction: number,
): PitchforksBellWavePoint | null {
  if (!Number.isFinite(fraction)) return null
  const clamped = Math.max(0, Math.min(1, fraction))
  if (clamped === 0) return copyPoint(from)
  if (clamped === 1) return copyPoint(to)
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return null
  const x = from.x + deltaX * clamped
  const y = from.y + deltaY * clamped
  return Number.isFinite(x) && Number.isFinite(y) ? copyPoint({ x, y }) : null
}

function validCrossingFraction(value: number): number | null {
  if (!Number.isFinite(value) || value < -ROOT_TOLERANCE || value > 1 + ROOT_TOLERANCE) return null
  return Math.max(0, Math.min(1, value))
}

/**
 * Find the earliest ring contact while both endpoints are trusted. Position
 * and radius are linear in normalized frame time, so the squared-distance
 * equation is quadratic even when a villager walks toward the bell.
 */
function findBellWaveCrossing(
  wave: PitchforksBellWave,
  startTimeMs: number,
  endTimeMs: number,
  from: PitchforksBellWavePoint,
  to: PitchforksBellWavePoint,
): Crossing | null {
  const frameDurationMs = endTimeMs - startTimeMs
  const startElapsedMs = startTimeMs - wave.releasedAtMs
  if (!Number.isFinite(frameDurationMs) || frameDurationMs < 0
    || !Number.isFinite(startElapsedMs) || startElapsedMs < 0) return null

  const fromX = from.x - wave.bellOrigin.x
  const fromY = from.y - wave.bellOrigin.y
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  if (![fromX, fromY, deltaX, deltaY].every(Number.isFinite)) return null

  const radiusAtStart = wave.waveSpeed * startElapsedMs
  const radiusDelta = wave.waveSpeed * frameDurationMs
  if (!Number.isFinite(radiusAtStart) || !Number.isFinite(radiusDelta)) return null

  const scale = Math.max(
    1,
    Math.abs(fromX),
    Math.abs(fromY),
    Math.abs(deltaX),
    Math.abs(deltaY),
    Math.abs(radiusAtStart),
    Math.abs(radiusDelta),
  )
  if (!Number.isFinite(scale)) return null

  const x0 = fromX / scale
  const y0 = fromY / scale
  const dx = deltaX / scale
  const dy = deltaY / scale
  const r0 = radiusAtStart / scale
  const dr = radiusDelta / scale
  if (![x0, y0, dx, dy, r0, dr].every(Number.isFinite)) return null

  const makeCrossing = (fraction: number): Crossing | null => {
    const validFraction = validCrossingFraction(fraction)
    if (validFraction === null) return null
    const elapsedMs = validFraction * frameDurationMs
    const position = interpolatePoint(from, to, validFraction)
    return Number.isFinite(elapsedMs) && position !== null
      ? { elapsedMs, position }
      : null
  }

  const startDistance = Math.hypot(x0, y0)
  if (!Number.isFinite(startDistance)) return null
  if (startDistance <= r0 + tolerance(startDistance, r0)) {
    return makeCrossing(0)
  }
  if (frameDurationMs === 0) return null

  // A stationary villager has a numerically simpler single positive crossing.
  if (deltaX === 0 && deltaY === 0) {
    if (dr <= tolerance(dr)) return null
    return makeCrossing((startDistance - r0) / dr)
  }

  // Work in q = elapsed/frameDuration so coefficients stay finite for tiny
  // frame durations and the roots always live in [0, 1].
  const a = dx * dx + dy * dy - dr * dr
  const b = 2 * (x0 * dx + y0 * dy - r0 * dr)
  const c = x0 * x0 + y0 * y0 - r0 * r0
  if (![a, b, c].every(Number.isFinite)) return null

  const coefficientTolerance = tolerance(a, b, c)
  const roots: number[] = []
  if (Math.abs(a) <= coefficientTolerance) {
    if (Math.abs(b) <= coefficientTolerance) {
      if (Math.abs(c) <= coefficientTolerance) roots.push(0)
    } else {
      roots.push(-c / b)
    }
  } else {
    const rawDiscriminant = b * b - 4 * a * c
    if (!Number.isFinite(rawDiscriminant)) return null
    const discriminantTolerance = tolerance(b * b, 4 * a * c)
    if (rawDiscriminant < -discriminantTolerance) return null
    const discriminant = Math.max(0, rawDiscriminant)
    const squareRoot = Math.sqrt(discriminant)
    if (squareRoot === 0) {
      roots.push(-b / (2 * a))
    } else {
      // q avoids the cancellation that loses the near-zero root in the
      // ordinary quadratic formula.
      const q = -0.5 * (b + (b >= 0 ? squareRoot : -squareRoot))
      if (q === 0) {
        roots.push((-b - squareRoot) / (2 * a), (-b + squareRoot) / (2 * a))
      } else {
        roots.push(q / a, c / q)
      }
    }
  }

  const validRoots = roots
    .map(validCrossingFraction)
    .filter((root): root is number => root !== null)
    .sort((left, right) => left - right)
  for (const root of validRoots) {
    const residual = a * root * root + b * root + c
    if (Number.isFinite(residual) && Math.abs(residual) <= tolerance(a, b, c) * 100) {
      const crossing = makeCrossing(root)
      if (crossing !== null) return crossing
    }
  }
  return null
}

/**
 * Advance the active wave to one caller-supplied logical time. Contacts are
 * emitted for the current live walking roster only, and their mathematical
 * crossing times make a dropped frame deterministic rather than lossy.
 */
export function advancePitchforksBellWave(
  state: PitchforksBellWaveState,
  input: PitchforksBellWaveAdvanceInput,
): PitchforksBellWaveAdvanceDecision {
  if (!isRecord(input) || !isLogicalTime(input.logicalTimeMs)) {
    return advanceDecision(state, false, 'invalid-input')
  }
  const villagers = parseVillagers(input.walkingVillagers)
  if (villagers === null) return advanceDecision(state, false, 'invalid-input')
  if (state.lastLogicalTimeMs !== null && input.logicalTimeMs < state.lastLogicalTimeMs) {
    return advanceDecision(state, false, 'clock-reversed')
  }

  // Even without an active wave, this call observes the shared logical clock.
  // That keeps a later release from moving backward after an idle/finished
  // frame has already been accepted.
  if (state.phase !== 'active' || state.wave === null) {
    const changed = state.lastLogicalTimeMs !== input.logicalTimeMs
    const nextState = changed
      ? makeState({
        phase: state.phase,
        wave: state.wave,
        lastLogicalTimeMs: input.logicalTimeMs,
        contactedStableIDs: state.contactedStableIDs,
        eligibleStableIDs: state.eligibleStableIDs,
        previousObservations: state.previousObservations,
        invalidatedStableIDs: state.invalidatedStableIDs,
        consumedReceiptIds: state.consumedReceiptIds,
      })
      : state
    return advanceDecision(nextState, true, state.phase === 'finished' ? 'finished' : 'not-active')
  }

  const wave = state.wave
  const previousTime = state.lastLogicalTimeMs ?? wave.releasedAtMs
  const endAtMs = wave.releasedAtMs + wave.waveDurationMs
  if (input.logicalTimeMs < wave.releasedAtMs) {
    return advanceDecision(state, false, 'clock-reversed')
  }

  if (!Number.isFinite(endAtMs) || endAtMs < previousTime) {
    return advanceDecision(state, false, 'clock-reversed')
  }

  const requestedTime = input.logicalTimeMs
  const evaluationTime = Math.min(requestedTime, endAtMs)
  const frameDurationMs = requestedTime - previousTime
  const equalTime = requestedTime === previousTime
  const currentByID = new Map(villagers.map(villager => [villager.stableID, villager]))
  const invalidated = new Set(state.invalidatedStableIDs)
  const observations = new Map(state.previousObservations.map(observation => [observation.stableID, observation]))
  const nextObservations = new Map(observations)
  const contacted = new Set(state.contactedStableIDs)
  const candidates: Array<{
    stableID: string
    contactAtMs: number
    position: PitchforksBellWavePoint
  }> = []

  for (const stableID of state.eligibleStableIDs) {
    if (invalidated.has(stableID)) continue
    const current = currentByID.get(stableID)
    if (current === undefined || !current.liveWalking) {
      // Absence is an unknown interval, never a straight line to a later
      // reappearance. Permanently fail closed for this wave.
      invalidated.add(stableID)
      continue
    }

    const previous = observations.get(stableID)
    if (previous === undefined) {
      invalidated.add(stableID)
      continue
    }

    const currentPoint = { x: current.x, y: current.y }
    if (equalTime) {
      // A same-clock position mutation cannot be interpreted as movement.
      // Keep the old observation and fail closed instead of fabricating a hit.
      if (!samePoint(previous, currentPoint)) {
        invalidated.add(stableID)
      }
      // No logical time elapsed: even an origin contact waits for advancement.
      continue
    }

    const fractionAtEvaluation = frameDurationMs > 0
      ? (evaluationTime - previousTime) / frameDurationMs
      : 0
    const evaluationPoint = interpolatePoint(previous, currentPoint, fractionAtEvaluation)
    if (evaluationPoint === null) {
      invalidated.add(stableID)
      continue
    }

    if (!contacted.has(stableID)) {
      const crossing = findBellWaveCrossing(wave, previousTime, evaluationTime, previous, evaluationPoint)
      if (crossing !== null) {
        candidates.push({
          stableID,
          contactAtMs: previousTime + crossing.elapsedMs,
          position: crossing.position,
        })
      }
    }
    nextObservations.set(stableID, {
      stableID,
      x: evaluationPoint.x,
      y: evaluationPoint.y,
    })
  }

  candidates.sort((left, right) =>
    left.contactAtMs - right.contactAtMs || compareStableIDs(left.stableID, right.stableID))

  const intents = candidates.map(candidate => Object.freeze({
    kind: 'bell-wave-contact' as const,
    receiptId: wave.receiptId,
    stableID: candidate.stableID,
    contactAtMs: candidate.contactAtMs,
    position: candidate.position,
  }))
  const nextPhase: PitchforksBellWavePhase = requestedTime >= endAtMs ? 'finished' : 'active'
  const nextInvalidatedStableIDs = [...invalidated]
  const nextObservationValues = state.eligibleStableIDs
    .map(stableID => nextObservations.get(stableID))
    .filter((observation): observation is PitchforksBellWaveObservation => observation !== undefined)
  const observationsChanged = nextObservationValues.length !== state.previousObservations.length
    || nextObservationValues.some((observation, index) => {
      const prior = state.previousObservations[index]
      return prior === undefined || prior.stableID !== observation.stableID
        || prior.x !== observation.x || prior.y !== observation.y
    })
  const invalidatedChanged = nextInvalidatedStableIDs.length !== state.invalidatedStableIDs.length
    || nextInvalidatedStableIDs.some((stableID, index) => stableID !== state.invalidatedStableIDs[index])
  const changed = requestedTime !== state.lastLogicalTimeMs
    || intents.length > 0
    || nextPhase !== state.phase
    || observationsChanged
    || invalidatedChanged
  if (!changed) return advanceDecision(state, true, 'advanced')

  const nextState = makeState({
    phase: nextPhase,
    wave,
    lastLogicalTimeMs: requestedTime,
    contactedStableIDs: [...state.contactedStableIDs, ...intents.map(intent => intent.stableID)],
    eligibleStableIDs: state.eligibleStableIDs,
    previousObservations: nextObservationValues,
    invalidatedStableIDs: nextInvalidatedStableIDs,
    consumedReceiptIds: state.consumedReceiptIds,
  })
  return advanceDecision(nextState, true, 'advanced', intents)
}

/** Pure renderer projection; reduced-motion policy belongs to the renderer. */
export function projectPitchforksBellWave(
  state: PitchforksBellWaveState,
  logicalTimeMs: number,
): PitchforksBellWaveProjection {
  const wave = state.wave
  if (wave === null) {
    return Object.freeze({
      phase: state.phase,
      visible: false,
      bellOrigin: null,
      radius: 0,
      maxRadius: 0,
      progress: 0,
    })
  }

  const maxRadius = Number.isFinite(wave.waveSpeed * wave.waveDurationMs)
    ? wave.waveSpeed * wave.waveDurationMs
    : 0
  if (!Number.isFinite(logicalTimeMs)) {
    return Object.freeze({
      phase: state.phase,
      visible: state.phase === 'active',
      bellOrigin: copyPoint(wave.bellOrigin),
      radius: 0,
      maxRadius,
      progress: 0,
    })
  }

  const elapsedMs = Math.max(0, Math.min(wave.waveDurationMs, logicalTimeMs - wave.releasedAtMs))
  return Object.freeze({
    phase: state.phase,
    visible: state.phase === 'active',
    bellOrigin: copyPoint(wave.bellOrigin),
    radius: wave.waveSpeed * elapsedMs,
    maxRadius,
    progress: elapsedMs / wave.waveDurationMs,
  })
}

export const getPitchforksBellWaveProjection = projectPitchforksBellWave
