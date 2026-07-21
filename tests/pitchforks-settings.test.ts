import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_PITCHFORKS_SETTINGS,
  PITCHFORKS_SETTINGS_KEY,
  loadPitchforksSettings,
  normalizePitchforksSettings,
  savePitchforksSettings,
} from '../src/components/PitchDefender/pitchforksSettings'

let checks = 0
const check = (run: () => void) => { run(); checks += 1 }

check(() => assert.equal(PITCHFORKS_SETTINGS_KEY, 'pitchforks3_settings_v1'))
check(() => assert.deepEqual(DEFAULT_PITCHFORKS_SETTINGS, {
  version: 1,
  noteNames: true,
  referenceAudio: true,
}))
check(() => assert.deepEqual(normalizePitchforksSettings(null), DEFAULT_PITCHFORKS_SETTINGS))
check(() => assert.deepEqual(normalizePitchforksSettings({ noteNames: false }), {
  version: 1,
  noteNames: false,
  referenceAudio: true,
}))
check(() => assert.deepEqual(normalizePitchforksSettings({
  version: 99,
  noteNames: 'false',
  referenceAudio: false,
}), {
  version: 1,
  noteNames: true,
  referenceAudio: false,
}))

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
const sequenceStart = componentSource.indexOf('const playVillagerSequence')
const sequenceEnd = componentSource.indexOf('const answerWithButton', sequenceStart)
const sequenceSource = componentSource.slice(sequenceStart, sequenceEnd)
check(() => assert.match(sequenceSource, /if \(!emitsTone\) \{[\s\S]*?return/))
check(() => assert.doesNotMatch(sequenceSource, /else \{\s*matchingSuppressedUntilRef\.current = performance\.now\(\) \+ TONE_SUPPRESS_MS/))

console.log(`pitchforks settings: ${checks}/${checks} PASS`)
