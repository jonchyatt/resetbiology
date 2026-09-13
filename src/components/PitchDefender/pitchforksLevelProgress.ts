export const PITCHFORKS_LEVEL_ACCURACY_GOAL = 0.95
export const PITCHFORKS_LEVEL_ACCURACY_GOAL_PERCENT = 95
export const PITCHFORKS_MIN_TARGETS_FOR_NEW_NOTE = 6

export type PitchforksLevelLane = 'voice' | 'buttons'
export type PitchforksLevelCredit = 'guided-practice' | 'hinted' | 'recall' | 'ear'
export type PitchforksSampleState = 'valid' | 'missing' | 'invalid'

export interface PitchforksLevelTargetOutcome {
  correct: boolean
  lane: PitchforksLevelLane
  credit: PitchforksLevelCredit
}

export interface PitchforksLevelProgress {
  level: number
  targetOutcomes: Readonly<Record<string, PitchforksLevelTargetOutcome>>
  completedTargets: number
  correctTargets: number
  voiceTargets: number
  voiceCorrectTargets: number
  unaidedTargets: number
  unaidedCorrectTargets: number
  supportedPracticeTargets: number
  supportedPracticeCorrectTargets: number
  hintedTargets: number
  hintedCorrectTargets: number
  earTargets: number
  earCorrectTargets: number
}

export interface RecordPitchforksLevelOutcomeInput {
  targetKey: string
  correct: boolean
  lane: PitchforksLevelLane
  credit: PitchforksLevelCredit
  sampleState?: PitchforksSampleState
}

export interface PitchforksLevelResult {
  showcase?: boolean
  level: number
  accuracy: number
  accuracyPercent: number
  cleared: boolean
  nextLevel: number
  nextStep: string
}

function validLevel(level: number): number {
  return Number.isInteger(level) && level > 0 ? level : 1
}

export function createPitchforksLevelProgress(level = 1): PitchforksLevelProgress {
  return {
    level: validLevel(level),
    targetOutcomes: {},
    completedTargets: 0,
    correctTargets: 0,
    voiceTargets: 0,
    voiceCorrectTargets: 0,
    unaidedTargets: 0,
    unaidedCorrectTargets: 0,
    supportedPracticeTargets: 0,
    supportedPracticeCorrectTargets: 0,
    hintedTargets: 0,
    hintedCorrectTargets: 0,
    earTargets: 0,
    earCorrectTargets: 0,
  }
}

function isCredit(value: unknown): value is PitchforksLevelCredit {
  return value === 'guided-practice' || value === 'hinted' || value === 'recall' || value === 'ear'
}

/**
 * Record the first valid resolution for a target key.
 *
 * A target key is the encounter+tine identity, not the note name. That keeps
 * the exact octave and repeated-note tines distinct while making echoes,
 * duplicate callbacks, and repeated button taps harmless. Missing or invalid
 * detector samples are deliberately not outcomes and leave the progress object
 * untouched.
 */
export function recordPitchforksLevelOutcome(
  progress: PitchforksLevelProgress,
  input: RecordPitchforksLevelOutcomeInput,
): PitchforksLevelProgress {
  if (
    !input ||
    typeof input.targetKey !== 'string' ||
    input.targetKey.trim().length === 0 ||
    typeof input.correct !== 'boolean' ||
    (input.sampleState ?? 'valid') !== 'valid' ||
    (input.lane !== 'voice' && input.lane !== 'buttons') ||
    !isCredit(input.credit) ||
    Object.prototype.hasOwnProperty.call(progress.targetOutcomes, input.targetKey)
  ) {
    return progress
  }

  // The lane is the trust boundary: a button answer can only ever be EAR
  // evidence, even if a caller accidentally supplies a voice credit.
  const credit: PitchforksLevelCredit = input.lane === 'buttons' ? 'ear' : input.credit
  const outcome: PitchforksLevelTargetOutcome = {
    correct: input.correct,
    lane: input.lane,
    credit,
  }
  const targetOutcomes = { ...progress.targetOutcomes, [input.targetKey]: outcome }
  const completedTargets = progress.completedTargets + 1
  const correctTargets = progress.correctTargets + (input.correct ? 1 : 0)
  const isEar = input.lane === 'buttons'
  const isVoice = input.lane === 'voice'
  const isUnaided = input.lane === 'voice' && credit === 'recall'
  const isGuided = input.lane === 'voice' && credit === 'guided-practice'
  const isHinted = input.lane === 'voice' && credit === 'hinted'

  return {
    ...progress,
    targetOutcomes,
    completedTargets,
    correctTargets,
    voiceTargets: progress.voiceTargets + (isVoice ? 1 : 0),
    voiceCorrectTargets: progress.voiceCorrectTargets + (isVoice && input.correct ? 1 : 0),
    unaidedTargets: progress.unaidedTargets + (isUnaided ? 1 : 0),
    unaidedCorrectTargets: progress.unaidedCorrectTargets + (isUnaided && input.correct ? 1 : 0),
    supportedPracticeTargets: progress.supportedPracticeTargets + (isGuided ? 1 : 0),
    supportedPracticeCorrectTargets: progress.supportedPracticeCorrectTargets + (isGuided && input.correct ? 1 : 0),
    hintedTargets: progress.hintedTargets + (isHinted ? 1 : 0),
    hintedCorrectTargets: progress.hintedCorrectTargets + (isHinted && input.correct ? 1 : 0),
    earTargets: progress.earTargets + (isEar ? 1 : 0),
    earCorrectTargets: progress.earCorrectTargets + (isEar && input.correct ? 1 : 0),
  }
}

export function pitchforksLevelAccuracy(
  progress: PitchforksLevelProgress,
  lane: PitchforksLevelLane = 'voice',
): number {
  const denominator = lane === 'buttons'
    ? progress.earTargets
    : progress.voiceTargets
  if (denominator === 0) return 0

  const numerator = lane === 'buttons'
    ? progress.earCorrectTargets
    : progress.level === 1
      ? progress.voiceCorrectTargets
      : progress.unaidedCorrectTargets
  return Math.max(0, Math.min(1, numerator / denominator))
}

export function pitchforksLevelAccuracyPercent(
  progress: PitchforksLevelProgress,
  lane: PitchforksLevelLane = 'voice',
): number {
  return Math.round(pitchforksLevelAccuracy(progress, lane) * 100)
}

export function pitchforksLevelHasPassingAccuracy(
  progress: PitchforksLevelProgress,
  lane: PitchforksLevelLane = 'voice',
): boolean {
  const denominator = lane === 'buttons'
    ? progress.earTargets
    : progress.voiceTargets
  return denominator > 0 && pitchforksLevelAccuracy(progress, lane) >= PITCHFORKS_LEVEL_ACCURACY_GOAL
}

export function pitchforksNewNoteAccuracyEligible(
  progress: PitchforksLevelProgress,
  lane: PitchforksLevelLane = 'voice',
): boolean {
  return lane === 'voice' &&
    progress.voiceTargets >= PITCHFORKS_MIN_TARGETS_FOR_NEW_NOTE &&
    pitchforksLevelHasPassingAccuracy(progress, lane)
}

export function pitchforksLevelResult(
  progress: PitchforksLevelProgress,
  lane: PitchforksLevelLane = 'voice',
): PitchforksLevelResult {
  const accuracy = pitchforksLevelAccuracy(progress, lane)
  const cleared = pitchforksLevelHasPassingAccuracy(progress, lane)
  return {
    level: progress.level,
    accuracy,
    accuracyPercent: Math.round(accuracy * 100),
    cleared,
    nextLevel: cleared ? progress.level + 1 : progress.level,
    nextStep: cleared
      ? `Next: Level ${progress.level + 1}. Keep the same calm recall.`
      : `Repeat Level ${progress.level} with a supportive retry. No extra penalty.`,
  }
}
