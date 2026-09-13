import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  projectVillageReturnCoachCopy,
  projectVillageReturnDisplay,
  projectVillageReturnEnvironmentText,
  projectVillageReturnNoteLabel,
  projectVillageReturnPrompt,
  projectVillageReturnText,
  projectVillageReturnTunerFeedback,
} from '../src/components/PitchDefender/PitchforksIII'
import { pitchforksTunerFeedback } from '../src/components/PitchDefender/pitchforksTunerFeedback'

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

const lesson = (contextNote: string, targetNote: string, objective: 'minor-third' | 'major-third' | 'perfect-fifth' = 'minor-third') => ({
  objective,
  contextNote,
  targetNote,
  support: 'UNAIDED_RETURN' as const,
})

const target = {
  id: 11,
  burned: 0,
  totalTines: 1 as const,
  notes: ['E4'],
  supportedLesson: lesson('C4', 'E4'),
}
const unrelated = {
  id: 12,
  burned: 0,
  totalTines: 1 as const,
  notes: ['G4'],
  supportedLesson: lesson('E4', 'G4', 'minor-third'),
}
const hidden = projectVillageReturnText(target, {}, new Set())
const rawFeedback = pitchforksTunerFeedback({
  targetNote: 'E4',
  sourceNote: 'D4',
  deviationSemis: -2,
  matchingSuppressed: false,
  lockProgress: 0,
  toleranceSemis: 0.35,
})

check(() => assert.deepEqual(hidden, {
  targetKey: '11:0',
  answerVisible: false,
  contextNote: 'C4',
  objective: 'minor third',
  direction: 'above',
}))

check(() => assert.deepEqual(
  projectVillageReturnDisplay(target, {}, new Set()),
  { targetKey: '11:0', answerVisible: false },
))

check(() => {
  const prompt = projectVillageReturnPrompt('Sing: E4', hidden)
  assert.match(prompt, /starting note C4/)
  assert.match(prompt, /minor third above/)
  assert.doesNotMatch(prompt, /E4/)
})

check(() => {
  const coach = projectVillageReturnCoachCopy('sing', 'E4', hidden)
  assert.ok(coach)
  assert.match(coach!, /C4/)
  assert.match(coach!, /minor third/)
  assert.match(coach!, /above/)
  assert.doesNotMatch(coach!, /E4/)
})

check(() => {
  const feedback = projectVillageReturnTunerFeedback(rawFeedback, 'E4', hidden)
  assert.equal(feedback.kind, rawFeedback.kind)
  assert.match(feedback.headline, /D4 HEARD/)
  assert.match(feedback.detail, /GO HIGHER/)
  assert.match(feedback.compactLabel, /higher/)
  assert.doesNotMatch(feedback.headline, /E4/)
  assert.doesNotMatch(feedback.detail, /E4/)
  assert.doesNotMatch(feedback.compactLabel, /E4/)
})

check(() => {
  const microphone = pitchforksTunerFeedback({
    targetNote: 'E4',
    sourceNote: null,
    deviationSemis: null,
    matchingSuppressed: false,
    micUnreliable: true,
    lockProgress: 0,
    toleranceSemis: 0.35,
  })
  const feedback = projectVillageReturnTunerFeedback(microphone, 'E4', hidden)
  assert.equal(feedback.kind, 'mic-unreliable')
  assert.match(feedback.detail, /microphone/i)
  assert.doesNotMatch(feedback.headline, /E4/)
})

check(() => {
  const hinted = projectVillageReturnText(target, {}, new Set(['11:0']))
  assert.equal(hinted.answerVisible, true)
  assert.equal(projectVillageReturnPrompt('Sing: E4', hinted), 'Sing: E4')
  assert.deepEqual(projectVillageReturnTunerFeedback(rawFeedback, 'E4', hinted), rawFeedback)
})

check(() => {
  const graded = projectVillageReturnText(target, {
    '11:0': { correct: false, lane: 'voice', credit: 'hinted' },
  }, new Set())
  assert.equal(graded.answerVisible, true)
  assert.equal(projectVillageReturnPrompt('Sing: E4', graded), 'Sing: E4')
})

check(() => {
  const otherTargetGraded = projectVillageReturnText(target, {
    '12:0': { correct: true, lane: 'voice', credit: 'recall' },
  }, new Set())
  assert.equal(otherTargetGraded.answerVisible, false)
  assert.equal(projectVillageReturnText(unrelated, {
    '12:0': { correct: true, lane: 'voice', credit: 'recall' },
  }, new Set()).answerVisible, true)
})

check(() => {
  const supported = {
    ...target,
    supportedLesson: { ...lesson('C4', 'E4'), support: 'SUPPORTED' as const },
  }
  const projected = projectVillageReturnText(supported, {}, new Set())
  assert.equal(projected.answerVisible, true)
  assert.equal(projectVillageReturnPrompt('Listen: E4', projected), 'Listen: E4')
  assert.deepEqual(projectVillageReturnTunerFeedback(rawFeedback, 'E4', projected), rawFeedback)
})

check(() => {
  assert.equal(projectVillageReturnNoteLabel('11:0', 'E4', hidden), 'THE TARGET')
  assert.equal(projectVillageReturnNoteLabel('12:0', 'G4', hidden), 'G4')
  assert.equal(
    projectVillageReturnEnvironmentText('Torch lit — hold the exact E4 to douse it.', 'E4', '11:0', hidden),
    'Torch lit — hold the exact THE TARGET to douse it.',
  )
  assert.equal(
    projectVillageReturnEnvironmentText('Hold G4.', 'G4', '12:0', hidden),
    'Hold G4.',
  )
})

const source = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url),
  'utf8',
)

check(() => {
  assert.match(source, /const ownershipPrompt = ownershipBolt/)
  assert.match(source, /const visualPrompt = activeReturnText\s*\n\s*\? projectVillageReturnPrompt\(ownershipPrompt, activeReturnText\)/)
  assert.match(source, /const visualTunerFeedback = activeReturnText && visualActive/)
  assert.match(source, /feedback: visualTunerFeedback/)
})

check(() => {
  assert.match(source, /const activeEnvironmentReturnText = activeTargetForEnvironment\s*\n\s*\? projectVillageReturnText\(/)
  assert.match(source, /const activeEnvironmentNoteLabel = activeTargetForEnvironment/)
  assert.match(source, /projectVillageReturnEnvironmentText\(/)
  assert.match(source, /projectEnvironmentNote\(bank\.targetKey, bank\.note\)/)
})

check(() => {
  assert.match(source, /const firstMinuteCoachDisplayCopy = activeEnvironmentReturnText/)
  assert.match(source, /projectVillageReturnCoachCopy\(firstMinuteCoach\.beat, firstMinuteCoach\.note, activeEnvironmentReturnText\)/)
  assert.match(source, /Torch lit — hold the exact \$\{activeEnvironmentNoteLabel/)
  assert.match(source, /GALVANIC ARMED · HOLD \$\{activeEnvironmentNoteLabel/)
})

console.log(`pitchforks Village return text: ${checks}/${checks} PASS`)
