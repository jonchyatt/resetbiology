export const PITCHFORKS_SPARK_QUIET_REPULSE_MS = 3000
export const PITCHFORKS_SPARK_WRONG_REPULSE_MS = 4000
export const PITCHFORKS_SPARK_MAX_AUTO_PULSES = 3

export type PitchforksSparkGuideStatus = 'idle' | 'waiting' | 'pulse' | 'capped'
export type PitchforksSparkGuideSample = 'suppressed' | 'silence' | 'confident-wrong' | 'progress'
export type PitchforksSparkGuideReason = 'quiet' | 'confident-wrong'

export interface PitchforksSparkGuideState {
  readonly targetKey: string | null
  readonly targetNote: string | null
  readonly generation: number
  readonly autoPulseCount: number
  readonly quietSinceMs: number | null
  readonly wrongSinceMs: number | null
  readonly pulseUntilMs: number
  readonly status: PitchforksSparkGuideStatus
}

export interface PitchforksSparkGuideInput {
  readonly nowMs: number
  readonly targetKey: string | null
  readonly targetNote: string | null
  readonly eligible: boolean
  readonly sample: PitchforksSparkGuideSample
  readonly pulseWindowMs: number
}

export type PitchforksSparkGuideTransition = Readonly<{
  kind: 'target' | 'armed' | 'cancelled' | 'fired' | 'capped' | 'disabled'
  reason: string
}>

export interface PitchforksSparkGuideDecision {
  readonly state: PitchforksSparkGuideState
  readonly fire: Readonly<{
    reason: PitchforksSparkGuideReason
    targetKey: string
    targetNote: string
    generation: number
  }> | null
  readonly transitions: ReadonlyArray<PitchforksSparkGuideTransition>
}

export function createPitchforksSparkGuideState(generation = 0): PitchforksSparkGuideState {
  return {
    targetKey: null,
    targetNote: null,
    generation,
    autoPulseCount: 0,
    quietSinceMs: null,
    wrongSinceMs: null,
    pulseUntilMs: 0,
    status: 'idle',
  }
}

export function pausePitchforksSparkGuide(state: PitchforksSparkGuideState): PitchforksSparkGuideState {
  return {
    ...state,
    quietSinceMs: null,
    wrongSinceMs: null,
    pulseUntilMs: 0,
    status: state.autoPulseCount >= PITCHFORKS_SPARK_MAX_AUTO_PULSES ? 'capped' : 'idle',
  }
}

function decision(
  state: PitchforksSparkGuideState,
  transitions: ReadonlyArray<PitchforksSparkGuideTransition> = [],
  fire: PitchforksSparkGuideDecision['fire'] = null,
): PitchforksSparkGuideDecision {
  return { state, fire, transitions }
}

export function advancePitchforksSparkGuide(
  current: PitchforksSparkGuideState,
  input: PitchforksSparkGuideInput,
): PitchforksSparkGuideDecision {
  if (!input.targetKey || !input.targetNote) {
    if (!current.targetKey) return decision(createPitchforksSparkGuideState(current.generation))
    return decision(
      createPitchforksSparkGuideState(current.generation + 1),
      [{ kind: 'cancelled', reason: 'no-target' }],
    )
  }

  if (current.targetKey !== input.targetKey || current.targetNote !== input.targetNote) {
    const next: PitchforksSparkGuideState = {
      ...createPitchforksSparkGuideState(current.generation + 1),
      targetKey: input.targetKey,
      targetNote: input.targetNote,
    }
    return decision(next, [{ kind: 'target', reason: 'target-generation' }])
  }

  if (!input.eligible) {
    const hadClock = current.quietSinceMs !== null || current.wrongSinceMs !== null || current.status === 'pulse'
    const next = pausePitchforksSparkGuide(current)
    return decision(next, hadClock ? [{ kind: 'disabled', reason: 'not-eligible' }] : [])
  }

  if (input.sample === 'suppressed') {
    const pulseActive = current.pulseUntilMs > input.nowMs
    const hadClock = current.quietSinceMs !== null || current.wrongSinceMs !== null
    const next: PitchforksSparkGuideState = {
      ...current,
      quietSinceMs: null,
      wrongSinceMs: null,
      status: pulseActive ? 'pulse' : current.autoPulseCount >= PITCHFORKS_SPARK_MAX_AUTO_PULSES ? 'capped' : 'idle',
    }
    return decision(next, hadClock ? [{ kind: 'cancelled', reason: 'suppression' }] : [])
  }

  if (current.autoPulseCount >= PITCHFORKS_SPARK_MAX_AUTO_PULSES) {
    const newlyCapped = current.status !== 'capped'
    const next: PitchforksSparkGuideState = {
      ...current,
      quietSinceMs: null,
      wrongSinceMs: null,
      pulseUntilMs: 0,
      status: 'capped',
    }
    return decision(next, newlyCapped ? [{ kind: 'capped', reason: 'automatic-limit' }] : [])
  }

  if (input.sample === 'progress') {
    const hadClock = current.quietSinceMs !== null || current.wrongSinceMs !== null
    const next: PitchforksSparkGuideState = {
      ...current,
      quietSinceMs: null,
      wrongSinceMs: null,
      pulseUntilMs: 0,
      status: 'idle',
    }
    return decision(next, hadClock ? [{ kind: 'cancelled', reason: 'singer-progress' }] : [])
  }

  const reason: PitchforksSparkGuideReason = input.sample === 'confident-wrong' ? 'confident-wrong' : 'quiet'
  const sinceKey = reason === 'quiet' ? 'quietSinceMs' : 'wrongSinceMs'
  const sinceMs = current[sinceKey]
  const armedAt = sinceMs ?? input.nowMs
  const thresholdMs = reason === 'quiet'
    ? PITCHFORKS_SPARK_QUIET_REPULSE_MS
    : PITCHFORKS_SPARK_WRONG_REPULSE_MS

  if (input.nowMs - armedAt < thresholdMs) {
    const next: PitchforksSparkGuideState = {
      ...current,
      quietSinceMs: reason === 'quiet' ? armedAt : null,
      wrongSinceMs: reason === 'confident-wrong' ? armedAt : null,
      pulseUntilMs: 0,
      status: 'waiting',
    }
    const changedLane = sinceMs === null ||
      (reason === 'quiet' ? current.wrongSinceMs !== null : current.quietSinceMs !== null)
    return decision(next, changedLane ? [{ kind: 'armed', reason }] : [])
  }

  const autoPulseCount = current.autoPulseCount + 1
  const next: PitchforksSparkGuideState = {
    ...current,
    autoPulseCount,
    quietSinceMs: null,
    wrongSinceMs: null,
    pulseUntilMs: input.nowMs + input.pulseWindowMs,
    status: 'pulse',
  }
  const transitions: PitchforksSparkGuideTransition[] = [{ kind: 'fired', reason }]
  if (autoPulseCount >= PITCHFORKS_SPARK_MAX_AUTO_PULSES) {
    transitions.push({ kind: 'capped', reason: 'automatic-limit-after-pulse' })
  }
  return decision(next, transitions, {
    reason,
    targetKey: input.targetKey,
    targetNote: input.targetNote,
    generation: current.generation,
  })
}
