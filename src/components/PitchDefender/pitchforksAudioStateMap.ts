export type PitchforksAudioMapState =
  | 'calibration'
  | 'recall'
  | 'blind_measurement'
  | 'strike'
  | 'relief'
  | 'menu'

export type PitchforksAudioStateRule = Readonly<{
  state: PitchforksAudioMapState
  pitchedOutput: 'allowed' | 'forbidden'
  unpitchedOutput: 'allowed' | 'forbidden'
  detector: 'active' | 'armed' | 'closed'
  transitionGuard: string
}>

export const PITCHFORKS_AUDIO_STATE_MAP: readonly PitchforksAudioStateRule[] = Object.freeze([
  { state: 'calibration', pitchedOutput: 'allowed', unpitchedOutput: 'allowed', detector: 'armed', transitionGuard: 'permission-and-room-ready' },
  { state: 'recall', pitchedOutput: 'forbidden', unpitchedOutput: 'allowed', detector: 'active', transitionGuard: 'cue-ended-before-recall' },
  { state: 'blind_measurement', pitchedOutput: 'forbidden', unpitchedOutput: 'allowed', detector: 'active', transitionGuard: 'measurement-open-and-source-fresh' },
  { state: 'strike', pitchedOutput: 'allowed', unpitchedOutput: 'allowed', detector: 'active', transitionGuard: 'fresh-exact-octave-lock' },
  { state: 'relief', pitchedOutput: 'allowed', unpitchedOutput: 'allowed', detector: 'closed', transitionGuard: 'wave-resolved-and-measurement-closed' },
  { state: 'menu', pitchedOutput: 'allowed', unpitchedOutput: 'allowed', detector: 'closed', transitionGuard: 'not-in-measurement' },
])

export type PitchforksAudioTraceEvent = Readonly<{
  kind: 'measurement_close' | 'silence_start' | 'silence_end' | 'audio_start'
  atMs: number
  state: PitchforksAudioMapState | 'silent_beat' | 'tonic_exhale'
  pitched: boolean
}>

export type PitchforksWaveReliefTrace = Readonly<{
  events: readonly PitchforksAudioTraceEvent[]
  silentBeatMs: number
  safe: boolean
}>

export const PITCHFORKS_RELIEF_SILENT_BEAT_MS = 180

export function createPitchforksWaveReliefTrace(
  measurementCloseMs: number,
  resolvedAtMs: number,
  tonicDelayMs = PITCHFORKS_RELIEF_SILENT_BEAT_MS,
): PitchforksWaveReliefTrace {
  const valid = [measurementCloseMs, resolvedAtMs, tonicDelayMs].every(Number.isFinite)
    && measurementCloseMs >= 0 && resolvedAtMs >= measurementCloseMs && tonicDelayMs >= PITCHFORKS_RELIEF_SILENT_BEAT_MS
  if (!valid) return Object.freeze({ events: Object.freeze([]), silentBeatMs: 0, safe: false })
  const silenceStart = Math.max(resolvedAtMs, measurementCloseMs)
  const silenceEnd = silenceStart + tonicDelayMs
  const events = Object.freeze([
    Object.freeze({ kind: 'measurement_close' as const, atMs: measurementCloseMs, state: 'relief' as const, pitched: false }),
    Object.freeze({ kind: 'silence_start' as const, atMs: silenceStart, state: 'silent_beat' as const, pitched: false }),
    Object.freeze({ kind: 'silence_end' as const, atMs: silenceEnd, state: 'silent_beat' as const, pitched: false }),
    Object.freeze({ kind: 'audio_start' as const, atMs: silenceEnd, state: 'tonic_exhale' as const, pitched: true }),
  ])
  return Object.freeze({ events, silentBeatMs: tonicDelayMs, safe: true })
}

export function isPitchforksPitchedAudioForbidden(state: PitchforksAudioMapState): boolean {
  return PITCHFORKS_AUDIO_STATE_MAP.find(rule => rule.state === state)?.pitchedOutput === 'forbidden'
}
