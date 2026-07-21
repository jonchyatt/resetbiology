export type PitchforksInputMode = 'voice' | 'buttons'

export const PITCHFORKS_INPUT_MODE_KEY = 'pitchforks3_input_mode_v1'

export interface PitchforksButtonTrial {
  targetKey: string
  graded: boolean
  requiresReplay: boolean
  resolved: boolean
}

export interface PitchforksButtonDecision {
  accepted: boolean
  correct: boolean
  shouldGrade: boolean
  shouldStrike: boolean
  next: PitchforksButtonTrial
}

export function parsePitchforksInputMode(raw: string | null): PitchforksInputMode {
  return raw === 'buttons' ? 'buttons' : 'voice'
}

export function createPitchforksButtonTrial(targetKey: string): PitchforksButtonTrial {
  return { targetKey, graded: false, requiresReplay: false, resolved: false }
}

export function replayPitchforksButtonTrial(trial: PitchforksButtonTrial): PitchforksButtonTrial {
  return trial.resolved ? trial : { ...trial, requiresReplay: false }
}

/**
 * One audible target may write at most one EAR review. A wrong first answer
 * asks for Replay; the supported correction may still release the tine but
 * cannot rewrite that original memory result.
 */
export function decidePitchforksButtonAnswer(
  trial: PitchforksButtonTrial,
  answeredNote: string,
  targetNote: string,
): PitchforksButtonDecision {
  if (trial.resolved || trial.requiresReplay) {
    return {
      accepted: false,
      correct: false,
      shouldGrade: false,
      shouldStrike: false,
      next: trial,
    }
  }

  const correct = answeredNote === targetNote
  return {
    accepted: true,
    correct,
    shouldGrade: !trial.graded,
    shouldStrike: correct,
    next: {
      ...trial,
      graded: true,
      requiresReplay: !correct,
      resolved: correct,
    },
  }
}
