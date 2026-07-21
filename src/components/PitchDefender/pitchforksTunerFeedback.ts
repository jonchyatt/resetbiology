export type PitchforksTunerFeedbackKind =
  | 'waiting'
  | 'listen'
  | 'mic-unreliable'
  | 'searching'
  | 'voice-break'
  | 'octave-low'
  | 'low'
  | 'approaching'
  | 'on-target'
  | 'locked'
  | 'high'
  | 'octave-high'

export type PitchforksTunerFeedback = Readonly<{
  kind: PitchforksTunerFeedbackKind
  headline: string
  detail: string
  compactLabel: string
}>

type PitchforksTunerFeedbackInput = Readonly<{
  targetNote: string | null
  sourceNote: string | null
  deviationSemis: number | null
  matchingSuppressed: boolean
  micUnreliable?: boolean
  voiceBreak?: boolean
  approaching?: boolean
  lockProgress: number
  toleranceSemis: number
}>

export type PitchforksFeedbackTrailPoint = Readonly<{
  deviation: number
  onTarget: boolean
  generation?: number
}>

export function pitchforksApproaching(
  trail: readonly PitchforksFeedbackTrailPoint[],
  toleranceSemis: number,
): boolean {
  const samples = trail.filter((point, index) =>
    point.generation === undefined || index === 0 || point.generation !== trail[index - 1].generation
  )
  if (samples.length < 3 || !Number.isFinite(toleranceSemis) || toleranceSemis <= 0) return false

  const first = samples[0]
  const previous = samples[samples.length - 2]
  const latest = samples[samples.length - 1]
  const direction = Math.sign(latest.deviation)
  if (direction === 0) return false
  if (samples.some(point =>
    point.onTarget ||
    Math.sign(point.deviation) !== direction ||
    Math.abs(point.deviation) <= toleranceSemis ||
    Math.abs(point.deviation) >= 6
  )) return false
  if (Math.abs(latest.deviation) > Math.abs(previous.deviation)) return false

  return Math.abs(first.deviation) - Math.abs(latest.deviation) >= toleranceSemis / 2
}

type PitchforksMicUnreliableInput = Readonly<{
  hasTarget: boolean
  isListening: boolean
  micError: string | null
  audioContextState: string
  trackReadyState: string
  trackMuted: boolean
  matchingSuppressed: boolean
  pageVisible: boolean
  generationObserved: boolean
  generationAgeMs: number
  staleAfterMs: number
}>

export function pitchforksMicUnreliable(input: PitchforksMicUnreliableInput): boolean {
  if (!input.hasTarget) return false
  if (
    !input.isListening ||
    !!input.micError ||
    input.audioContextState !== 'running' ||
    input.trackReadyState !== 'live' ||
    input.trackMuted
  ) return true
  if (input.matchingSuppressed || !input.pageVisible) return false
  return !input.generationObserved || input.generationAgeMs > input.staleAfterMs
}

type PitchforksVoiceBreakInput = Readonly<{
  hasTarget: boolean
  matchingSuppressed: boolean
  micUnreliable: boolean
  dropoutFrames: number
  dropoutResetFrames: number
  lastUsableAgeMs: number | null
  trailMs: number
}>

export function pitchforksVoiceBreak(input: PitchforksVoiceBreakInput): boolean {
  return input.hasTarget &&
    !input.matchingSuppressed &&
    !input.micUnreliable &&
    input.dropoutFrames >= input.dropoutResetFrames &&
    input.lastUsableAgeMs !== null &&
    input.lastUsableAgeMs >= 0 &&
    input.lastUsableAgeMs <= input.trailMs
}

export function pitchforksTunerFeedback(input: PitchforksTunerFeedbackInput): PitchforksTunerFeedback {
  const {
    targetNote,
    sourceNote,
    deviationSemis,
    matchingSuppressed,
    micUnreliable = false,
    voiceBreak = false,
    approaching = false,
    lockProgress,
    toleranceSemis,
  } = input
  if (!targetNote) {
    return { kind: 'waiting', headline: 'READY FOR THE NEXT FORK', detail: 'Listen for the target', compactLabel: 'ready...' }
  }
  if (micUnreliable) {
    return { kind: 'mic-unreliable', headline: `MIC NEEDS ATTENTION · ${targetNote}`, detail: 'Check the microphone, then try again', compactLabel: 'check mic' }
  }
  if (matchingSuppressed) {
    return { kind: 'listen', headline: `LISTEN · ${targetNote}`, detail: 'Your turn begins after the cue', compactLabel: `listen: ${targetNote}` }
  }
  if (voiceBreak) {
    return { kind: 'voice-break', headline: `VOICE BREAK · ${targetNote}`, detail: 'Relax, breathe, and begin again', compactLabel: 'voice break' }
  }
  if (!sourceNote || deviationSemis === null) {
    return { kind: 'searching', headline: `SING ${targetNote}`, detail: 'Hold one clear, comfortable tone', compactLabel: `sing: ${targetNote}` }
  }

  const noteTruth = `${sourceNote} HEARD · ${targetNote} TARGET`
  if (Math.abs(deviationSemis) <= toleranceSemis) {
    if (lockProgress >= 1) {
      return { kind: 'locked', headline: noteTruth, detail: 'LOCKED', compactLabel: `${sourceNote} → ${targetNote}: locked` }
    }
    return { kind: 'on-target', headline: noteTruth, detail: 'ON TARGET · HOLD', compactLabel: `${sourceNote} → ${targetNote}: hold` }
  }
  if (deviationSemis <= -6) {
    return { kind: 'octave-low', headline: noteTruth, detail: 'OCTAVE LOW · GO HIGHER ↑', compactLabel: `${sourceNote} → ${targetNote}: octave low ↑` }
  }
  if (deviationSemis >= 6) {
    return { kind: 'octave-high', headline: noteTruth, detail: 'OCTAVE HIGH · GO LOWER ↓', compactLabel: `${sourceNote} → ${targetNote}: octave high ↓` }
  }
  if (approaching) {
    const direction = deviationSemis < 0 ? '↑' : '↓'
    return {
      kind: 'approaching',
      headline: noteTruth,
      detail: `APPROACHING · KEEP GOING ${direction}`,
      compactLabel: `approaching ${direction}`,
    }
  }
  if (deviationSemis < 0) {
    return { kind: 'low', headline: noteTruth, detail: 'LOW · GO HIGHER ↑', compactLabel: `${sourceNote} → ${targetNote}: higher ↑` }
  }
  return { kind: 'high', headline: noteTruth, detail: 'HIGH · GO LOWER ↓', compactLabel: `${sourceNote} → ${targetNote}: lower ↓` }
}
