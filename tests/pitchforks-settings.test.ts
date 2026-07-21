import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_PITCHFORKS_SETTINGS,
  PITCHFORKS_SETTINGS_KEY,
  loadPitchforksSettings,
  normalizePitchforksSettings,
  savePitchforksSettings,
} from '../src/components/PitchDefender/pitchforksSettings'
import { normalizeObservationGain } from '../src/components/PitchDefender/usePitchDetection'

let checks = 0
const check = (run: () => void) => { run(); checks += 1 }

check(() => assert.equal(PITCHFORKS_SETTINGS_KEY, 'pitchforks3_settings_v1'))
check(() => assert.deepEqual(DEFAULT_PITCHFORKS_SETTINGS, {
  version: 1,
  noteNames: true,
  referenceAudio: true,
  referenceGainPct: 100,
  microphoneGainPct: 100,
}))
check(() => assert.deepEqual(normalizePitchforksSettings(null), DEFAULT_PITCHFORKS_SETTINGS))
check(() => assert.deepEqual(normalizePitchforksSettings({ noteNames: false }), {
  version: 1,
  noteNames: false,
  referenceAudio: true,
  referenceGainPct: 100,
  microphoneGainPct: 100,
}))
check(() => assert.deepEqual(normalizePitchforksSettings({
  version: 99,
  noteNames: 'false',
  referenceAudio: false,
}), {
  version: 1,
  noteNames: true,
  referenceAudio: false,
  referenceGainPct: 100,
  microphoneGainPct: 100,
}))
check(() => assert.deepEqual(normalizePitchforksSettings({
  referenceGainPct: 250.4,
  microphoneGainPct: -12.7,
}), {
  version: 1,
  noteNames: true,
  referenceAudio: true,
  referenceGainPct: 200,
  microphoneGainPct: 0,
}))
check(() => assert.deepEqual(normalizePitchforksSettings({
  referenceGainPct: '150',
  microphoneGainPct: Number.NaN,
}), DEFAULT_PITCHFORKS_SETTINGS))
check(() => assert.equal(normalizeObservationGain(undefined), 1))
check(() => assert.equal(normalizeObservationGain(0), 0))
check(() => assert.equal(normalizeObservationGain(100), 1))
check(() => assert.equal(normalizeObservationGain(200), 2))
check(() => assert.equal(normalizeObservationGain(-1), 0))
check(() => assert.equal(normalizeObservationGain(201), 2))

const values = new Map<string, string>()
const writes: Array<{ key: string; value: string }> = []
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    values.set(key, value)
    writes.push({ key, value })
  },
}

check(() => assert.deepEqual(loadPitchforksSettings(storage), DEFAULT_PITCHFORKS_SETTINGS))
check(() => assert.equal(writes.length, 0))

values.set(PITCHFORKS_SETTINGS_KEY, '{broken')
check(() => assert.deepEqual(loadPitchforksSettings(storage), DEFAULT_PITCHFORKS_SETTINGS))
check(() => assert.equal(writes.length, 0))

const noteNamesOff = normalizePitchforksSettings({
  ...DEFAULT_PITCHFORKS_SETTINGS,
  noteNames: false,
})
check(() => assert.equal(savePitchforksSettings(storage, noteNamesOff), true))
check(() => assert.equal(writes.length, 1))
check(() => assert.equal(writes[0].key, PITCHFORKS_SETTINGS_KEY))
check(() => assert.deepEqual(JSON.parse(writes[0].value), noteNamesOff))
check(() => assert.deepEqual(loadPitchforksSettings(storage), noteNamesOff))

const bothOff = normalizePitchforksSettings({ ...noteNamesOff, referenceAudio: false })
check(() => assert.equal(bothOff.noteNames, false))
check(() => assert.equal(bothOff.referenceAudio, false))
check(() => assert.equal(savePitchforksSettings(storage, bothOff), true))
check(() => assert.deepEqual(loadPitchforksSettings(storage), bothOff))

const customGains = normalizePitchforksSettings({
  ...bothOff,
  referenceGainPct: 165,
  microphoneGainPct: 75,
})
check(() => assert.equal(customGains.referenceGainPct, 165))
check(() => assert.equal(customGains.microphoneGainPct, 75))
check(() => assert.equal(savePitchforksSettings(storage, customGains), true))
check(() => assert.deepEqual(loadPitchforksSettings(storage), customGains))

const failingStorage = {
  getItem: () => null,
  setItem: () => { throw new Error('quota') },
}
check(() => assert.equal(savePitchforksSettings(failingStorage, bothOff), false))

const componentSource = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url),
  'utf8',
)
check(() => assert.match(componentSource, /loadPitchforksSettings\(localStorage\)/))
check(() => assert.match(componentSource, /savePitchforksSettings\(localStorage,/))
check(() => assert.match(componentSource, /settings: normalizePitchforksSettings\(/))
check(() => assert.match(componentSource, /data-testid="pf3-note-names-toggle"[\s\S]*?aria-pressed=\{props\.noteNamesOn\}/))
check(() => assert.match(componentSource, /data-testid="pf3-reference-audio-toggle"[\s\S]*?aria-pressed=\{props\.audioCueOn\}/))
check(() => assert.match(componentSource, /\(!userRequested && !audioCueRef\.current\)/))
check(() => assert.match(componentSource, /inputMode === 'buttons' \? false : noteNamesRef\.current/))
check(() => assert.match(componentSource, /cueContext\.support === 'guided' && audioCueRef\.current/))
check(() => assert.match(componentSource, /observationGainPct: microphoneGain/))
check(() => assert.match(componentSource, /data-testid="pf3-reference-gain"[\s\S]*?aria-valuetext=\{`\$\{props\.cueVolume\}%`\}/))
check(() => assert.match(componentSource, /data-testid="pf3-microphone-gain"[\s\S]*?aria-valuetext=\{`\$\{props\.microphoneGain\}%`\}/))
check(() => assert.match(componentSource, /Reference audio \{props\.cueVolume\}%/))
check(() => assert.match(componentSource, /Mic sensitivity \{props\.microphoneGain\}%/))
check(() => assert.match(componentSource, /const syncLayoutMode = \(\) => \{[\s\S]*?window\.addEventListener\('resize', syncLayoutMode\)/))
check(() => assert.match(componentSource, /firstLockGrace: firstLockGraceRef\.current/))
const sequenceStart = componentSource.indexOf('const playVillagerSequence')
const sequenceEnd = componentSource.indexOf('const answerWithButton', sequenceStart)
const sequenceSource = componentSource.slice(sequenceStart, sequenceEnd)
check(() => assert.match(sequenceSource, /if \(!emitsTone\) \{[\s\S]*?return/))
check(() => assert.doesNotMatch(sequenceSource, /else \{\s*matchingSuppressedUntilRef\.current = performance\.now\(\) \+ TONE_SUPPRESS_MS/))
check(() => assert.ok(sequenceSource.indexOf('return') < sequenceSource.indexOf('timersPausedRef.current = true')))
check(() => assert.match(sequenceSource, /const emitsTone = [^\n]*cueVolumeRef\.current > 0/))

const rangeToneStart = componentSource.indexOf('const playRangeCandidateTone')
const rangeToneEnd = componentSource.indexOf('const finishGuidedRange', rangeToneStart)
const rangeToneSource = componentSource.slice(rangeToneStart, rangeToneEnd)
check(() => assert.match(rangeToneSource, /cueVolumeRef\.current <= 0/))

const detectorSource = readFileSync(
  new URL('../src/components/PitchDefender/usePitchDetection.ts', import.meta.url),
  'utf8',
)
check(() => assert.match(detectorSource, /observationGainPct\?: number/))
check(() => assert.match(detectorSource, /source\.connect\(observationGain\)/))
check(() => assert.match(detectorSource, /observationGain\.connect\(analyser\)/))
check(() => assert.doesNotMatch(detectorSource, /observationGain\.connect\([^\n]*destination/))

console.log(`pitchforks settings: ${checks}/${checks} PASS`)
