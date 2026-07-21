import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  pitchforksApproaching,
  pitchforksMicUnreliable,
  pitchforksTunerFeedback,
  pitchforksVoiceBreak,
} from '../src/components/PitchDefender/pitchforksTunerFeedback'

let checks = 0
const check = (fn: () => void) => {
  fn()
  checks += 1
}

const trail = (...deviations: number[]) => deviations.map((deviation, index) => ({
  at: index * 16,
  deviation,
  onTarget: Math.abs(deviation) <= 0.7,
  note: deviation < 0 ? 'C4' : 'E4',
}))

check(() => assert.equal(pitchforksApproaching(trail(-3, -2.2, -1.4), 0.7), true))
check(() => assert.equal(pitchforksApproaching(trail(3, 2.2, 1.4), 0.7), true))
check(() => assert.equal(pitchforksApproaching(trail(-2, -2.08, -1.96), 0.7), false))
check(() => assert.equal(pitchforksApproaching(trail(-1.4, -2.2, -3), 0.7), false))
check(() => assert.equal(pitchforksApproaching(trail(-7, -6.4, -5.8), 0.7), false))
check(() => assert.equal(pitchforksApproaching(trail(-3, -1.9), 0.7), false))
check(() => assert.equal(pitchforksApproaching(trail(-1.4, -0.9, -0.6), 0.7), false))
check(() => assert.equal(pitchforksApproaching(trail(-2.2, -1.4, 1.2), 0.7), false))
check(() => assert.equal(pitchforksApproaching(trail(-3, -1.4, -1.8), 0.7), false))
check(() => assert.equal(pitchforksApproaching([
  { deviation: -3, onTarget: false, generation: 9 },
  { deviation: -2.2, onTarget: false, generation: 9 },
  { deviation: -1.4, onTarget: false, generation: 9 },
], 0.7), false))

const healthyMic = {
  hasTarget: true,
  isListening: true,
  micError: null,
  audioContextState: 'running',
  trackReadyState: 'live',
  trackMuted: false,
  matchingSuppressed: false,
  pageVisible: true,
  generationObserved: true,
  generationAgeMs: 16,
  staleAfterMs: 1000,
}

check(() => assert.equal(pitchforksMicUnreliable(healthyMic), false))
check(() => assert.equal(pitchforksMicUnreliable({ ...healthyMic, isListening: false }), true))
check(() => assert.equal(pitchforksMicUnreliable({ ...healthyMic, micError: 'denied' }), true))
check(() => assert.equal(pitchforksMicUnreliable({ ...healthyMic, audioContextState: 'suspended' }), true))
check(() => assert.equal(pitchforksMicUnreliable({ ...healthyMic, trackReadyState: 'ended' }), true))
check(() => assert.equal(pitchforksMicUnreliable({ ...healthyMic, trackMuted: true }), true))
check(() => assert.equal(pitchforksMicUnreliable({ ...healthyMic, generationAgeMs: 1001 }), true))
check(() => assert.equal(pitchforksMicUnreliable({ ...healthyMic, matchingSuppressed: true, generationAgeMs: 1001 }), false))
check(() => assert.equal(pitchforksMicUnreliable({ ...healthyMic, pageVisible: false, generationAgeMs: 1001 }), false))
check(() => assert.equal(pitchforksMicUnreliable({ ...healthyMic, hasTarget: false, isListening: false }), false))

const voiceBreak = {
  hasTarget: true,
  matchingSuppressed: false,
  micUnreliable: false,
  dropoutFrames: 3,
  dropoutResetFrames: 3,
  lastUsableAgeMs: 48,
  trailMs: 1000,
}

check(() => assert.equal(pitchforksVoiceBreak(voiceBreak), true))
check(() => assert.equal(pitchforksVoiceBreak({ ...voiceBreak, dropoutFrames: 1 }), false))
check(() => assert.equal(pitchforksVoiceBreak({ ...voiceBreak, dropoutFrames: 2 }), false))
check(() => assert.equal(pitchforksVoiceBreak({ ...voiceBreak, lastUsableAgeMs: null }), false))
check(() => assert.equal(pitchforksVoiceBreak({ ...voiceBreak, lastUsableAgeMs: 1001 }), false))
check(() => assert.equal(pitchforksVoiceBreak({ ...voiceBreak, matchingSuppressed: true }), false))
check(() => assert.equal(pitchforksVoiceBreak({ ...voiceBreak, micUnreliable: true }), false))

const feedback = (overrides: Partial<Parameters<typeof pitchforksTunerFeedback>[0]> = {}) =>
  pitchforksTunerFeedback({
    targetNote: 'D4',
    sourceNote: 'C4',
    deviationSemis: -2,
    matchingSuppressed: false,
    micUnreliable: false,
    voiceBreak: false,
    approaching: false,
    lockProgress: 0,
    toleranceSemis: 0.7,
    ...overrides,
  })

check(() => assert.equal(feedback({ micUnreliable: true }).kind, 'mic-unreliable'))
check(() => assert.equal(feedback({ micUnreliable: true }).compactLabel, 'check mic'))
check(() => assert.equal(feedback({ voiceBreak: true, sourceNote: null, deviationSemis: null }).kind, 'voice-break'))
check(() => assert.equal(feedback({ voiceBreak: true, sourceNote: null, deviationSemis: null }).compactLabel, 'voice break'))
check(() => assert.equal(feedback({ approaching: true }).kind, 'approaching'))
check(() => assert.match(feedback({ approaching: true }).detail, /KEEP GOING/))
check(() => assert.match(feedback({ approaching: true }).compactLabel, /approaching/))
check(() => assert.equal(feedback({ approaching: true, deviationSemis: -7 }).kind, 'octave-low'))
check(() => assert.equal(feedback({ approaching: true, deviationSemis: 7 }).kind, 'octave-high'))
check(() => assert.equal(feedback({ approaching: true, deviationSemis: 0.5 }).kind, 'on-target'))
check(() => assert.equal(feedback({ matchingSuppressed: true, voiceBreak: true, sourceNote: null, deviationSemis: null }).kind, 'listen'))
check(() => assert.equal(feedback({ targetNote: null, micUnreliable: true }).kind, 'waiting'))

const shell = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
check(() => assert.match(shell, /micSourceHealthRef,[\s\S]*?pitchGenerationRef,/))
check(() => assert.match(shell, /const micUnreliable = !demoRef\.current && pitchforksMicUnreliable\(/))
check(() => assert.match(shell, /dropoutResetFrames: PITCHFORKS_PITCH_PROFILE\.dropoutResetFrames/))
check(() => assert.match(shell, /const approaching = canUseSource && pitchforksApproaching\(/))
check(() => assert.match(shell, /pitchforksTunerFeedback\(\{[\s\S]*?micUnreliable,[\s\S]*?voiceBreak,[\s\S]*?approaching,/))
check(() => assert.match(shell, /data-feedback-kind=\{tunerFeedback\.kind\}/))
check(() => assert.doesNotMatch(shell.slice(shell.indexOf('const micUnreliable ='), shell.indexOf('const feedbackKey =')), /lockProgressRef\.current\s*=|processLock\(|strikeVillager\(|maybeUnlockNextNote\(/))

console.log(`pitchforks feedback residual states: ${checks}/${checks} PASS`)
