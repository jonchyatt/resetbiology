import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PITCHFORKS_ROOM_CHECK_MS,
  PITCHFORKS_VOICE_COACH_MS,
  assessPitchforksRoom,
  coachPitchforksVoice,
  pitchforksMicReadinessCopy,
} from '../src/components/PitchDefender/pitchforksMicReadiness'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

check(() => assert.equal(PITCHFORKS_ROOM_CHECK_MS, 1200))
check(() => assert.equal(PITCHFORKS_VOICE_COACH_MS, 3500))
check(() => assert.deepEqual(assessPitchforksRoom([], -47), { status: 'checking-room', baselineDb: null }))
check(() => assert.equal(assessPitchforksRoom([-70, -69, -71, -70, -68, -69, -70, -71], -47).status, 'ready-for-voice'))
check(() => assert.equal(assessPitchforksRoom([-45, -44, -46, -45, -44, -45, -46, -44], -47).status, 'quieter-room'))
check(() => assert.equal(assessPitchforksRoom([-70, -70, -70, -70, -70, -70, -70, -70, -70, -30], -47).status, 'ready-for-voice'))
check(() => assert.equal(coachPitchforksVoice({ room: 'ready-for-voice', voiceHeard: false, elapsedMs: 1000 }), 'listening-for-voice'))
check(() => assert.equal(coachPitchforksVoice({ room: 'ready-for-voice', voiceHeard: false, elapsedMs: 3500 }), 'move-closer'))
check(() => assert.equal(coachPitchforksVoice({ room: 'quieter-room', voiceHeard: false, elapsedMs: 3500 }), 'quieter-room'))
check(() => assert.equal(coachPitchforksVoice({ room: 'quieter-room', voiceHeard: true, elapsedMs: 100 }), 'ready'))
check(() => assert.equal(pitchforksMicReadinessCopy('ready').label, 'READY'))
check(() => assert.equal(pitchforksMicReadinessCopy('ready-for-voice').label, 'HUM ONE EASY NOTE'))
check(() => assert.match(pitchforksMicReadinessCopy('quieter-room').guidance, /try headphones/i))

const component = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
check(() => assert.match(component, /data-testid="pf3-mic-readiness"/))
check(() => assert.match(component, /PITCHFORKS_PITCH_PROFILE\.noiseGateDb/))
check(() => assert.match(component, /signalDbRef/))
check(() => assert.doesNotMatch(component, /baselineDb\.toFixed/))

console.log(`pitchforks mic readiness: ${checks}/${checks} PASS`)
