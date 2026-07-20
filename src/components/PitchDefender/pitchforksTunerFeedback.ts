export type PitchforksTunerFeedbackKind =
  | 'waiting'
  | 'listen'
  | 'searching'
  | 'octave-low'
  | 'low'
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
  lockProgress: number
  toleranceSemis: number
}>

export function pitchforksTunerFeedback(input: PitchforksTunerFeedbackInput): PitchforksTunerFeedback {
  const { targetNote, sourceNote, deviationSemis, matchingSuppressed, lockProgress, toleranceSemis } = input
  if (!targetNote) {
    return { kind: 'waiting', headline: 'READY FOR THE NEXT FORK', detail: 'Listen for the target', compactLabel: 'ready...' }
  }
  if (matchingSuppressed) {
    return { kind: 'listen', headline: `LISTEN · ${targetNote}`, detail: 'Your turn begins after the cue', compactLabel: `listen: ${targetNote}` }
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
  if (deviationSemis < 0) {
    return { kind: 'low', headline: noteTruth, detail: 'LOW · GO HIGHER ↑', compactLabel: `${sourceNote} → ${targetNote}: higher ↑` }
  }
  return { kind: 'high', headline: noteTruth, detail: 'HIGH · GO LOWER ↓', compactLabel: `${sourceNote} → ${targetNote}: lower ↓` }
}
