import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PITCHFORKS_INPUT_MODE_KEY,
  createPitchforksButtonTrial,
  decidePitchforksButtonAnswer,
  parsePitchforksInputMode,
  replayPitchforksButtonTrial,
} from '../src/components/PitchDefender/pitchforksInputLane'
import {
  FSRS_EAR_KEY,
  FSRS_VOICE_KEY,
  gradeEar,
  gradeVoice,
  loadStore,
  saveStore,
} from '../src/lib/fsrsFamily'

let checks = 0
const check = (run: () => void) => { run(); checks += 1 }

check(() => assert.equal(PITCHFORKS_INPUT_MODE_KEY, 'pitchforks3_input_mode_v1'))
check(() => assert.equal(parsePitchforksInputMode(null), 'voice'))
check(() => assert.equal(parsePitchforksInputMode('voice'), 'voice'))
check(() => assert.equal(parsePitchforksInputMode('buttons'), 'buttons'))
check(() => assert.equal(parsePitchforksInputMode('corrupt'), 'voice'))

const first = createPitchforksButtonTrial('villager-1:tine-0')
const wrong = decidePitchforksButtonAnswer(first, 'D4', 'C4')
check(() => assert.equal(wrong.accepted, true))
check(() => assert.equal(wrong.correct, false))
check(() => assert.equal(wrong.shouldGrade, true))
check(() => assert.equal(wrong.shouldStrike, false))
check(() => assert.equal(wrong.next.requiresReplay, true))

const blockedBeforeReplay = decidePitchforksButtonAnswer(wrong.next, 'C4', 'C4')
check(() => assert.equal(blockedBeforeReplay.accepted, false))
check(() => assert.equal(blockedBeforeReplay.shouldGrade, false))
check(() => assert.equal(blockedBeforeReplay.shouldStrike, false))

const replayed = replayPitchforksButtonTrial(wrong.next)
const corrected = decidePitchforksButtonAnswer(replayed, 'C4', 'C4')
check(() => assert.equal(corrected.accepted, true))
check(() => assert.equal(corrected.shouldGrade, false))
check(() => assert.equal(corrected.shouldStrike, true))
check(() => assert.equal(corrected.next.resolved, true))

const doubleTap = decidePitchforksButtonAnswer(corrected.next, 'C4', 'C4')
check(() => assert.equal(doubleTap.accepted, false))
check(() => assert.equal(doubleTap.shouldStrike, false))

const directCorrect = decidePitchforksButtonAnswer(createPitchforksButtonTrial('v2:t0'), 'E4', 'E4')
check(() => assert.equal(directCorrect.shouldGrade, true))
check(() => assert.equal(directCorrect.shouldStrike, true))

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
const numericConstant = (name: string) => {
  const match = source.match(new RegExp(`const ${name} = ([\\d.]+)`))
  assert.ok(match, `missing numeric constant ${name}`)
  return Number(match[1])
}
check(() => assert.match(source, /FSRS_EAR_KEY/))
check(() => assert.match(source, /gradeEar/))
check(() => assert.match(source, /data-testid="pf3-button-answer-row"/))
check(() => assert.match(source, /LISTEN & TAP/))
check(() => assert.match(source, /LISTEN, THEN CHOOSE THE NOTE/))
check(() => assert.match(source, /inputMode === 'buttons' \? false : noteNamesRef\.current/))
check(() => assert.match(source, /inputMode === 'buttons' \? false : staffNotationRef\.current/))
check(() => assert.doesNotMatch(source, /aria-pressed=.*pf3-button-answer/))
const boltLifeSeconds = numericConstant('BOLT_LIFE_S')
const strikeReceiptEnd = numericConstant('STRIKE_RECEIPT_END')
const strikeImpactStart = numericConstant('STRIKE_IMPACT_START')
check(() => assert.ok(boltLifeSeconds >= 1.4, 'lightning circuit is too brief to read'))
check(() => assert.ok(strikeReceiptEnd < strikeImpactStart))
check(() => assert.ok(boltLifeSeconds * (1 - strikeReceiptEnd) >= 1, 'outgoing Frank-to-fork leg needs a one-second visual receipt'))
check(() => assert.ok(boltLifeSeconds * (1 - strikeImpactStart) >= 0.85, 'complete cloud-to-Frank-to-fork circuit needs a stable receipt'))

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
  },
})

const voice = loadStore(FSRS_VOICE_KEY)
const ear = loadStore(FSRS_EAR_KEY)
const voiceBeforeEarAnswer = storage.get(FSRS_VOICE_KEY) ?? null
gradeEar(ear, 'C4', true, 800)
check(() => assert.equal(saveStore(FSRS_EAR_KEY, ear), true))
check(() => assert.equal(storage.get(FSRS_VOICE_KEY) ?? null, voiceBeforeEarAnswer))
check(() => assert.ok(storage.get(FSRS_EAR_KEY)?.includes('C4')))

const earBeforeVoiceAnswer = storage.get(FSRS_EAR_KEY)
gradeVoice(voice, 'D4', true, 900)
check(() => assert.equal(saveStore(FSRS_VOICE_KEY, voice), true))
check(() => assert.equal(storage.get(FSRS_EAR_KEY), earBeforeVoiceAnswer))
check(() => assert.ok(storage.get(FSRS_VOICE_KEY)?.includes('D4')))

storage.set(FSRS_EAR_KEY, '{broken')
const corruptEar = loadStore(FSRS_EAR_KEY)
check(() => assert.deepEqual(corruptEar, {}))
check(() => assert.equal(storage.get(FSRS_EAR_KEY), '{broken'))
check(() => assert.equal(saveStore(FSRS_EAR_KEY, corruptEar), false))
check(() => assert.equal(storage.get(FSRS_EAR_KEY), '{broken'))

console.log(`pitchforks button lane: ${checks}/${checks} PASS`)
