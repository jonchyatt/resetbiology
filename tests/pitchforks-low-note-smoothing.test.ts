import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PITCHFORKS_AUDIO_CONSTRAINTS,
  PITCHFORKS_PITCH_PROFILE,
  createPitchStabilizer,
  noteForFrequency,
} from '../src/components/PitchDefender/pitchDetectionSmoothing'
import { noteToFreq } from '../src/components/PitchDefender/pitchMath'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}
const sample = (note: string, clarity = 0.95, db = -43) => ({ frequency: noteToFreq(note), clarity, db })

check(() => assert.equal(PITCHFORKS_PITCH_PROFILE.fftSize, 4096))
check(() => assert.equal(PITCHFORKS_PITCH_PROFILE.noiseGateDb, -47))
check(() => assert.equal(PITCHFORKS_PITCH_PROFILE.clarityFloor, 0.8))
check(() => assert.equal(PITCHFORKS_AUDIO_CONSTRAINTS.echoCancellation, true))
check(() => assert.equal(PITCHFORKS_AUDIO_CONSTRAINTS.noiseSuppression, false))
check(() => assert.equal(PITCHFORKS_AUDIO_CONSTRAINTS.autoGainControl, false))
check(() => assert.equal(noteForFrequency(noteToFreq('D3')).note, 'D3'))
check(() => assert.equal(noteForFrequency(noteToFreq('D4')).note, 'D4'))

const softLow = createPitchStabilizer(PITCHFORKS_PITCH_PROFILE)
check(() => assert.equal(softLow.push(sample('D3')).active, false))
check(() => assert.equal(softLow.push(sample('D3')).active, false))
check(() => assert.deepEqual(softLow.push(sample('D3')).note, 'D3'))
check(() => assert.equal(softLow.push(sample('D3')).active, true))

const roomNoise = createPitchStabilizer(PITCHFORKS_PITCH_PROFILE)
check(() => assert.equal(roomNoise.push(sample('D3', 0.98, -55)).active, false))
check(() => assert.equal(roomNoise.push(sample('D3', 0.5, -35)).active, false))

const burst = createPitchStabilizer(PITCHFORKS_PITCH_PROFILE)
for (let i = 0; i < 4; i += 1) burst.push(sample('D3'))
check(() => assert.equal(burst.push(sample('D4')).note, 'D3'))
check(() => assert.equal(burst.push(sample('D4')).active, false))
let sustained = burst.push(sample('D4'))
for (let i = 0; i < 12; i += 1) sustained = burst.push(sample('D4'))
check(() => assert.equal(sustained.note, 'D4'))
check(() => assert.equal(sustained.active, true))

const dropout = createPitchStabilizer(PITCHFORKS_PITCH_PROFILE)
dropout.push(sample('A2'))
dropout.push(sample('A2'))
check(() => assert.equal(dropout.push({ frequency: 0, clarity: 0, db: -80 }).active, false))
check(() => assert.equal(dropout.push(sample('A2')).active, true))

const pitchforksSource = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
check(() => assert.match(pitchforksSource, /profile: PITCHFORKS_PITCH_PROFILE/))
check(() => assert.match(pitchforksSource, /audioConstraints: PITCHFORKS_AUDIO_CONSTRAINTS/))

console.log(`pitchforks low-note smoothing: ${checks}/${checks} PASS`)
