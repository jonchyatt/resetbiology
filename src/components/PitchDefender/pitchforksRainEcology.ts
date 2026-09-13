/**
 * Pure environmental state for the Pitchforks III boss chamber.
 *
 * Rain and torch state are environmental only. The caller supplies the
 * authoritative exact-hold result and decides how to render or apply effects.
 */

export type RainPhase =
  | 'charging'
  | 'ready'
  | 'gutter_fill'
  | 'gargoyle_release'
  | 'raining'
  | 'cooldown'

export type RainTransitionReceipt = Readonly<{
  source: RainPhase
  target: RainPhase
  atMs: number
}>

/** Four distinct, ordinary voice combat responses earn one Raincall. */
export const RAINCALL_REQUIRED_RESPONSES = 4

/**
 * The shared event shape is intentionally narrower than the Bell controller's
 * result: Raincall consumes only the identity and the caller's admission
 * labels. The optional provenance fields keep the same event broadcast-safe.
 */
export type PitchforksRainCombatResponse = Readonly<{
  eventId: string
  lane: string
  source: string
  correct: boolean
  runId?: string
  note?: string
  demo?: boolean
  simulated?: boolean
  stale?: boolean
  ear?: boolean
  inputMode?: string
}>

export type RainCombatReason =
  | 'accepted'
  | 'saturated'
  | 'busy'
  | 'invalid-response'
  | 'duplicate-event'
  | 'not-normal-voice'
  | 'not-correct'

export type RainCombatDecision = Readonly<{
  state: RainState
  accepted: boolean
  charged: boolean
  reason: RainCombatReason
}>

export type RainTimings = Readonly<{
  chargingMs: number
  fillMs: number
  releaseMs: number
  rainingMs: number
  cooldownMs: number
}>

/** Initial balance only; these are environmental timings, not musical thresholds. */
export const RAINCALL_TIMINGS: RainTimings = Object.freeze({
  chargingMs: 8_000,
  fillMs: 2_000,
  releaseMs: 1_000,
  rainingMs: 6_000,
  cooldownMs: 12_000,
})

// Friendly aliases keep the timing contract discoverable at call sites.
export const RAIN_TIMINGS = RAINCALL_TIMINGS
export const RAINCALL_CHARGING_MS = RAINCALL_TIMINGS.chargingMs
export const RAINCALL_GUTTER_FILL_MS = RAINCALL_TIMINGS.fillMs
export const RAINCALL_GARGOYLE_RELEASE_MS = RAINCALL_TIMINGS.releaseMs
export const RAINCALL_RAINING_MS = RAINCALL_TIMINGS.rainingMs
export const RAINCALL_COOLDOWN_MS = RAINCALL_TIMINGS.cooldownMs

export const MAX_RAIN_STEP_MS = 250
export const MAX_RECENT_RAIN_TRANSITIONS = 8
export const RAIN_SLOW_FACTOR = 0.55

export type RainState = Readonly<{
  phase: RainPhase
  /** Time spent in the current phase. */
  elapsedMs: number
  /** 0 until the gutters fill, then 1 through the release/rain phases. */
  fill: number
  /** Earned normal responses, saturated at RAINCALL_REQUIRED_RESPONSES. */
  charge: number
  /** Same-run combat identities consumed by this Raincall ledger. */
  consumedEventIds: readonly string[]
  /** Zero-based environmental cycle identifier. It advances when cooldown ends. */
  cycleID: number
  recentTransitions: readonly RainTransitionReceipt[]
}>

export type RainStepMode = 'demo' | 'normal'

export type RainStepOptions = Readonly<{
  paused?: boolean
  activated?: boolean
  /** Explicit mode; normal mode never promotes readiness from elapsed time. */
  mode?: RainStepMode
  /** Backward-compatible mode flag for existing demo callers. */
  demo?: boolean
  /** One shared accepted combat event; Bell may consume the same object. */
  combatResponse?: PitchforksRainCombatResponse
  /** Descriptive alias for callers that already call this an accepted response. */
  acceptedResponse?: PitchforksRainCombatResponse
}>

export type RainEffects = Readonly<{
  /** Neutral movement multiplier outside active rain. */
  slowFactor: number
  /** Water is able to extinguish torches during spout release and rain. */
  extinguish: boolean
}>

type MutableRainState = {
  phase: RainPhase
  elapsedMs: number
  fill: number
  charge: number
  consumedEventIds: string[]
  cycleID: number
  recentTransitions: RainTransitionReceipt[]
  clockMs: number
}

function toRainState(draft: MutableRainState): RainState {
  return {
    phase: draft.phase,
    elapsedMs: draft.elapsedMs,
    fill: draft.fill,
    charge: draft.charge,
    consumedEventIds: draft.consumedEventIds,
    cycleID: draft.cycleID,
    recentTransitions: draft.recentTransitions,
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function cloneRainState(state: RainState): MutableRainState {
  const recentTransitions = Array.isArray(state.recentTransitions)
    ? state.recentTransitions.slice(-MAX_RECENT_RAIN_TRANSITIONS)
    : []
  const consumedEventIds = Array.isArray(state.consumedEventIds)
    ? state.consumedEventIds.slice()
    : []
  const lastReceiptAtMs = recentTransitions.at(-1)?.atMs
  const elapsedMs = Math.max(0, finiteOr(state.elapsedMs, 0))
  return {
    phase: state.phase,
    elapsedMs,
    fill: clamp01(finiteOr(state.fill, 0)),
    charge: Math.max(0, Math.min(
      RAINCALL_REQUIRED_RESPONSES,
      Math.floor(finiteOr(state.charge, 0)),
    )),
    consumedEventIds,
    cycleID: Math.max(0, Math.floor(finiteOr(state.cycleID, 0))),
    recentTransitions,
    // Keep the clock internal: a transition's absolute time is the previous
    // receipt plus elapsed time in the current phase.
    clockMs: Math.max(0, finiteOr(lastReceiptAtMs ?? 0, 0) + elapsedMs),
  }
}

export function createRainState(): RainState {
  return {
    phase: 'charging',
    elapsedMs: 0,
    fill: 0,
    charge: 0,
    consumedEventIds: [],
    cycleID: 0,
    recentTransitions: [],
  }
}

function recordRainTransition(
  draft: MutableRainState,
  target: RainPhase,
): void {
  if (draft.phase === target) return

  draft.recentTransitions = [
    ...draft.recentTransitions,
    {
      source: draft.phase,
      target,
      atMs: draft.clockMs,
    },
  ].slice(-MAX_RECENT_RAIN_TRANSITIONS)
  draft.phase = target
  draft.elapsedMs = 0

  switch (target) {
    case 'charging':
      draft.fill = 0
      draft.charge = 0
      draft.cycleID += 1
      break
    case 'ready':
      draft.fill = 0
      draft.charge = RAINCALL_REQUIRED_RESPONSES
      break
    case 'gutter_fill':
      draft.fill = 0
      draft.charge = 0
      break
    case 'gargoyle_release':
    case 'raining':
      draft.fill = 1
      break
    case 'cooldown':
      draft.fill = 0
      draft.charge = 0
      break
  }
}

function consumeRainPhase(
  draft: MutableRainState,
  remainingMs: number,
  durationMs: number,
  target: RainPhase,
): number {
  const remainingInPhase = Math.max(0, durationMs - draft.elapsedMs)
  if (remainingMs < remainingInPhase) {
    draft.elapsedMs += remainingMs
    draft.clockMs += remainingMs
    return 0
  }

  draft.clockMs += remainingInPhase
  draft.elapsedMs = durationMs
  recordRainTransition(draft, target)
  return remainingMs - remainingInPhase
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function isExplicitlyFalseOrMissing(value: unknown): boolean {
  return value === undefined || value === false
}

function rainCombatDecision(
  state: RainState,
  accepted: boolean,
  charged: boolean,
  reason: RainCombatReason,
): RainCombatDecision {
  return Object.freeze({ state, accepted, charged, reason })
}

/**
 * Consume one shared normal voice combat identity for Raincall. Bell can
 * consume the same response independently; neither ledger drains the other.
 */
export function acceptPitchforksRainCombatResponse(
  state: RainState,
  response: PitchforksRainCombatResponse,
): RainCombatDecision {
  if (!isRecord(response) || !isIdentifier(response.eventId)) {
    return rainCombatDecision(state, false, false, 'invalid-response')
  }
  if (state.consumedEventIds.includes(response.eventId)) {
    return rainCombatDecision(state, false, false, 'duplicate-event')
  }

  const draft = cloneRainState(state)
  draft.consumedEventIds = [...draft.consumedEventIds, response.eventId]
  const rejected = (reason: RainCombatReason): RainCombatDecision =>
    rainCombatDecision(toRainState(draft), false, false, reason)

  if (response.lane !== 'voice'
    || response.source !== 'combat'
    || response.ear === true
    || response.inputMode === 'ear') {
    return rejected('not-normal-voice')
  }
  if (response.correct !== true
    || !isExplicitlyFalseOrMissing(response.demo)
    || !isExplicitlyFalseOrMissing(response.simulated)
    || !isExplicitlyFalseOrMissing(response.stale)) {
    return rejected('not-correct')
  }

  if (state.phase !== 'charging') {
    return rainCombatDecision(
      toRainState(draft),
      true,
      false,
      state.phase === 'ready' ? 'saturated' : 'busy',
    )
  }

  const nextCharge = Math.min(RAINCALL_REQUIRED_RESPONSES, draft.charge + 1)
  draft.charge = nextCharge
  if (nextCharge >= RAINCALL_REQUIRED_RESPONSES) recordRainTransition(draft, 'ready')
  return rainCombatDecision(toRainState(draft), true, true, 'accepted')
}

function usesDemoTimer(options: RainStepOptions, hasResponse: boolean): boolean {
  if (options.mode !== undefined) return options.mode === 'demo'
  if (options.demo !== undefined) return options.demo
  // Existing callers only invoked this pure state machine from their demo
  // loop without a mode flag. Preserve that timer while an event input opts
  // into the normal earned path.
  return !hasResponse
}

/**
 * Advance Raincall by one deterministic game-frame step.
 *
 * Invalid/zero time, and paused frames, are true no-ops. A valid frame is
 * capped at 250 ms so a dropped tab cannot leap across an environmental
 * sequence in one update.
 */
export function stepRain(
  state: RainState,
  dtMs: number,
  options: RainStepOptions = {},
): RainState {
  const response = options.combatResponse ?? options.acceptedResponse
  const demoTimer = usesDemoTimer(options, response !== undefined)
  const eventState = response !== undefined && !demoTimer && options.paused !== true
    ? acceptPitchforksRainCombatResponse(state, response).state
    : state
  if (!Number.isFinite(dtMs) || dtMs <= 0 || options.paused === true) return eventState

  const draft = cloneRainState(eventState)
  let remainingMs = Math.min(dtMs, MAX_RAIN_STEP_MS)

  // Activation is an edge-triggered command accepted only while ready. Once
  // gutter filling starts, a held/repeated command cannot restart it.
  if (state.phase === 'ready' && options.activated === true) {
    recordRainTransition(draft, 'gutter_fill')
  }

  while (remainingMs > 0) {
    switch (draft.phase) {
      case 'charging':
        if (demoTimer) {
          remainingMs = consumeRainPhase(
            draft,
            remainingMs,
            RAINCALL_TIMINGS.chargingMs,
            'ready',
          )
        } else {
          // Normal readiness is event-earned. Keep the logical clock useful
          // for later transition receipts, but never turn elapsed time into a
          // charge or readiness signal.
          draft.elapsedMs += remainingMs
          draft.clockMs += remainingMs
          remainingMs = 0
        }
        break

      case 'ready':
        // Ready is an intentional hold state. It does not fill or auto-fire.
        draft.elapsedMs += remainingMs
        draft.clockMs += remainingMs
        remainingMs = 0
        break

      case 'gutter_fill': {
        const before = draft.elapsedMs
        remainingMs = consumeRainPhase(
          draft,
          remainingMs,
          RAINCALL_TIMINGS.fillMs,
          'gargoyle_release',
        )
        if (draft.phase === 'gutter_fill') {
          const progress = RAINCALL_TIMINGS.fillMs === 0
            ? 1
            : draft.elapsedMs / RAINCALL_TIMINGS.fillMs
          // Never regress a partially filled gutter during a cycle.
          draft.fill = Math.max(draft.fill, clamp01(progress))
        } else if (before < RAINCALL_TIMINGS.fillMs) {
          draft.fill = 1
        }
        break
      }

      case 'gargoyle_release':
        remainingMs = consumeRainPhase(
          draft,
          remainingMs,
          RAINCALL_TIMINGS.releaseMs,
          'raining',
        )
        break

      case 'raining':
        remainingMs = consumeRainPhase(
          draft,
          remainingMs,
          RAINCALL_TIMINGS.rainingMs,
          'cooldown',
        )
        break

      case 'cooldown':
        remainingMs = consumeRainPhase(
          draft,
          remainingMs,
          RAINCALL_TIMINGS.cooldownMs,
          'charging',
        )
        break
    }
  }

  return toRainState(draft)
}

/** Rain is the only source of these environmental effects; no musical event is returned. */
export function deriveRainEffects(state: RainState): RainEffects {
  const raining = state.phase === 'raining'
  return {
    slowFactor: raining ? RAIN_SLOW_FACTOR : 1,
    extinguish: state.phase === 'gargoyle_release' || raining,
  }
}

// Short alias for renderers that already use the effects noun at the call site.
export const rainEffects = deriveRainEffects

export type TorchPhase = 'lit' | 'holding' | 'steaming' | 'wet' | 'spent'

export type TorchTransitionCause =
  | 'confirmed_exact_hold'
  | 'hold_lost'
  | 'exact_hold_complete'
  | 'steam_complete'
  | 'rain'
  | 'wet_complete'

export type TorchTransitionReceipt = Readonly<{
  source: TorchPhase
  target: TorchPhase
  atMs: number
  cause: TorchTransitionCause
}>

export type TorchState = Readonly<{
  phase: TorchPhase
  /** Confirmed, contiguous exact-hold time. Silence/wrong pitch resets it. */
  heldMs: number
  /** Time spent in the current phase (equal to heldMs while holding). */
  elapsedMs: number
  recentTransitions: readonly TorchTransitionReceipt[]
}>

export type TorchStepOptions = Readonly<{
  confirmedExactHold?: boolean
  rainWet?: boolean
  paused?: boolean
}>

export const TORCH_EXACT_HOLD_MS = 1_800
export const TORCH_STEAMING_MS = 500
export const TORCH_WET_MS = 500
export const MAX_TORCH_STEP_MS = 250
export const MAX_RECENT_TORCH_TRANSITIONS = 8

export const TORCH_TIMINGS = Object.freeze({
  exactHoldMs: TORCH_EXACT_HOLD_MS,
  steamingMs: TORCH_STEAMING_MS,
  wetMs: TORCH_WET_MS,
})

type MutableTorchState = {
  phase: TorchPhase
  heldMs: number
  elapsedMs: number
  recentTransitions: TorchTransitionReceipt[]
  clockMs: number
}

function toTorchState(draft: MutableTorchState): TorchState {
  return {
    phase: draft.phase,
    heldMs: draft.heldMs,
    elapsedMs: draft.elapsedMs,
    recentTransitions: draft.recentTransitions,
  }
}

function cloneTorchState(state: TorchState): MutableTorchState {
  const recentTransitions = Array.isArray(state.recentTransitions)
    ? state.recentTransitions.slice(-MAX_RECENT_TORCH_TRANSITIONS)
    : []
  const lastReceiptAtMs = recentTransitions.at(-1)?.atMs
  const elapsedMs = Math.max(0, finiteOr(state.elapsedMs, 0))
  return {
    phase: state.phase,
    heldMs: Math.max(0, Math.min(TORCH_EXACT_HOLD_MS, finiteOr(state.heldMs, 0))),
    elapsedMs,
    recentTransitions,
    clockMs: Math.max(0, finiteOr(lastReceiptAtMs ?? 0, 0) + elapsedMs),
  }
}

export function createTorchState(): TorchState {
  return {
    phase: 'lit',
    heldMs: 0,
    elapsedMs: 0,
    recentTransitions: [],
  }
}

function recordTorchTransition(
  draft: MutableTorchState,
  target: TorchPhase,
  cause: TorchTransitionCause,
): void {
  if (draft.phase === target) return

  draft.recentTransitions = [
    ...draft.recentTransitions,
    {
      source: draft.phase,
      target,
      atMs: draft.clockMs,
      cause,
    },
  ].slice(-MAX_RECENT_TORCH_TRANSITIONS)
  draft.phase = target
  draft.elapsedMs = 0

  if (target === 'lit' || target === 'wet' || target === 'spent') {
    draft.heldMs = 0
  }
  if (target === 'steaming') draft.heldMs = TORCH_EXACT_HOLD_MS
}

function consumeTorchTimedPhase(
  draft: MutableTorchState,
  remainingMs: number,
  durationMs: number,
  target: TorchPhase,
  cause: TorchTransitionCause,
): number {
  const remainingInPhase = Math.max(0, durationMs - draft.elapsedMs)
  if (remainingMs < remainingInPhase) {
    draft.elapsedMs += remainingMs
    draft.clockMs += remainingMs
    return 0
  }

  draft.clockMs += remainingInPhase
  draft.elapsedMs = durationMs
  recordTorchTransition(draft, target, cause)
  return remainingMs - remainingInPhase
}

/**
 * Advance one torch without sampling. The caller must provide the
 * authoritative exact-hold boolean for this frame.
 */
export function stepTorch(
  state: TorchState,
  dtMs: number,
  options: TorchStepOptions = {},
): TorchState {
  if (!Number.isFinite(dtMs) || dtMs <= 0 || options.paused === true) return state

  const draft = cloneTorchState(state)
  let remainingMs = Math.min(dtMs, MAX_TORCH_STEP_MS)

  // Water wins over an in-progress hold. This is an environmental transition,
  // never a musical credit, and is intentionally checked before hold input.
  if (
    options.rainWet === true
    && draft.phase !== 'wet'
    && draft.phase !== 'spent'
  ) {
    recordTorchTransition(draft, 'wet', 'rain')
  }

  while (remainingMs > 0) {
    switch (draft.phase) {
      case 'lit':
        if (options.confirmedExactHold === true) {
          recordTorchTransition(draft, 'holding', 'confirmed_exact_hold')
          continue
        }
        // It does not accumulate a hold in silence, but elapsed time still
        // advances so a later transition receipt remains correctly stamped.
        draft.elapsedMs += remainingMs
        draft.clockMs += remainingMs
        remainingMs = 0
        break

      case 'holding':
        if (options.confirmedExactHold !== true) {
          recordTorchTransition(draft, 'lit', 'hold_lost')
          continue
        }

        {
          const remainingHoldMs = Math.max(0, TORCH_EXACT_HOLD_MS - draft.heldMs)
          if (remainingMs < remainingHoldMs) {
            draft.heldMs += remainingMs
            draft.elapsedMs = draft.heldMs
            draft.clockMs += remainingMs
            remainingMs = 0
          } else {
            draft.heldMs = TORCH_EXACT_HOLD_MS
            draft.elapsedMs = TORCH_EXACT_HOLD_MS
            draft.clockMs += remainingHoldMs
            remainingMs -= remainingHoldMs
            recordTorchTransition(draft, 'steaming', 'exact_hold_complete')
          }
        }
        break

      case 'steaming':
        remainingMs = consumeTorchTimedPhase(
          draft,
          remainingMs,
          TORCH_STEAMING_MS,
          'wet',
          'steam_complete',
        )
        break

      case 'wet':
        remainingMs = consumeTorchTimedPhase(
          draft,
          remainingMs,
          TORCH_WET_MS,
          'spent',
          'wet_complete',
        )
        break

      case 'spent':
        // Spent is terminal for this torch. Keeping the state unchanged also
        // makes repeated calls harmless and keeps its final receipt stable.
        remainingMs = 0
        break
    }
  }

  return toTorchState(draft)
}
