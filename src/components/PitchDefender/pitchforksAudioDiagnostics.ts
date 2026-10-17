export const PITCHFORKS_MARKER_TIME_CONSTANT_MS = 50.73503905230317
export const PITCHFORKS_FRAME_STALL_MS = 32
export const PITCHFORKS_AUDIO_DEBUG_CAPACITY = 4096

export type PitchforksEstimateMeasurement = Readonly<{
  capturedAtMs: number
  estimatedAtMs: number
  sampleAgeMs: number
  estimateIntervalMs: number | null
  computeMs: number
  valid: boolean
  dropout: boolean
  frameIntervalMs: number | null
  frameStallMs: number | null
}>

export type PitchforksAudioDebugEvent =
  | (PitchforksEstimateMeasurement & Readonly<{ kind: 'estimate'; sequence: number }>)
  | Readonly<{ kind: 'frame-stall'; sequence: number; atMs: number; frameIntervalMs: number }>

export type PitchforksAudioDebugSummary = Readonly<{
  estimateCount: number
  dropoutCount: number
  frameStallCount: number
  sampleAgeMedianMs: number | null
  sampleAgeP95Ms: number | null
  estimateIntervalMedianMs: number | null
  estimateIntervalP95Ms: number | null
  computeMedianMs: number | null
  computeP95Ms: number | null
}>

export type PitchforksAudioDebugBuffer = Readonly<{
  enabled: true
  capacity: number
  events: () => ReadonlyArray<PitchforksAudioDebugEvent>
  recordEstimate: (measurement: PitchforksEstimateMeasurement) => void
  recordFrameStall: (atMs: number, frameIntervalMs: number) => void
  summary: () => PitchforksAudioDebugSummary
  clear: () => void
}>

export function interpolatePitchforksMarker(
  current: number,
  target: number,
  elapsedMs: number,
  timeConstantMs = PITCHFORKS_MARKER_TIME_CONSTANT_MS,
): number {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return target
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return current
  const tau = Number.isFinite(timeConstantMs) && timeConstantMs > 0
    ? timeConstantMs
    : PITCHFORKS_MARKER_TIME_CONSTANT_MS
  const blend = 1 - Math.exp(-elapsedMs / tau)
  return current + (target - current) * blend
}

export function pitchforksMarkerOpacity(ageMs: number, trailMs: number): number {
  if (!Number.isFinite(ageMs) || !Number.isFinite(trailMs) || trailMs <= 0) return 0
  return Math.max(0, Math.min(1, 1 - Math.max(0, ageMs) / trailMs))
}

function percentile(values: readonly number[], fraction: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))
  return sorted[index]
}

export function createPitchforksAudioDebugBuffer(
  capacity = PITCHFORKS_AUDIO_DEBUG_CAPACITY,
): PitchforksAudioDebugBuffer {
  const boundedCapacity = Number.isSafeInteger(capacity) && capacity > 0
    ? capacity
    : PITCHFORKS_AUDIO_DEBUG_CAPACITY
  let sequence = 0
  let ring: PitchforksAudioDebugEvent[] = []
  const push = (event: PitchforksAudioDebugEvent) => {
    ring.push(Object.freeze(event))
    if (ring.length > boundedCapacity) ring.splice(0, ring.length - boundedCapacity)
  }

  return Object.freeze({
    enabled: true as const,
    capacity: boundedCapacity,
    events: () => ring.map(event => ({ ...event })),
    recordEstimate: measurement => push({
      kind: 'estimate',
      sequence: ++sequence,
      ...measurement,
    }),
    recordFrameStall: (atMs, frameIntervalMs) => {
      if (!Number.isFinite(frameIntervalMs) || frameIntervalMs <= PITCHFORKS_FRAME_STALL_MS) return
      push({ kind: 'frame-stall', sequence: ++sequence, atMs, frameIntervalMs })
    },
    summary: () => {
      const estimates = ring.filter((event): event is Extract<PitchforksAudioDebugEvent, { kind: 'estimate' }> => event.kind === 'estimate')
      const intervals = estimates.flatMap(event => event.estimateIntervalMs === null ? [] : [event.estimateIntervalMs])
      const sampleAges = estimates.map(event => event.sampleAgeMs)
      const computeTimes = estimates.map(event => event.computeMs)
      return Object.freeze({
        estimateCount: estimates.length,
        dropoutCount: estimates.filter(event => event.dropout).length,
        frameStallCount: ring.filter(event => event.kind === 'frame-stall').length,
        sampleAgeMedianMs: percentile(sampleAges, 0.5),
        sampleAgeP95Ms: percentile(sampleAges, 0.95),
        estimateIntervalMedianMs: percentile(intervals, 0.5),
        estimateIntervalP95Ms: percentile(intervals, 0.95),
        computeMedianMs: percentile(computeTimes, 0.5),
        computeP95Ms: percentile(computeTimes, 0.95),
      })
    },
    clear: () => {
      ring = []
      sequence = 0
    },
  })
}
