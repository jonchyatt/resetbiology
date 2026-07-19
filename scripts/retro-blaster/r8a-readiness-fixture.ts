import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  getPianoReadiness,
  initAudio,
  loadPianoSamples,
  playPianoNote,
} from '../../src/components/PitchDefender/audioEngine'
import { INTRO_ORDER } from '../../src/components/PitchDefender/types'

async function main() {
const normalize = (value: Buffer | string) => value.toString().replace(/\r\n/g, '\n')
const protectedBase = 'a9584d02a22a47e506bb42066673db1c826c2187'
const shellPath = 'src/components/PitchDefender/RetroBlasterII.tsx'
const audioPath = 'src/components/PitchDefender/audioEngine.ts'
const shell = normalize(readFileSync(shellPath))
const audio = normalize(readFileSync(audioPath))
const observerBlock = /\nexport interface PianoReadiness \{[\s\S]*?\nexport function getPianoReadiness\(note: string\): PianoReadiness \{[\s\S]*?\n\}\n/
assert.match(audio, observerBlock)
const audioDiff = normalize(execFileSync('git', ['diff', '--unified=0', protectedBase, '--', audioPath]))
const removedAudioLines = audioDiff.split('\n').filter(line => line.startsWith('-') && !line.startsWith('---'))
const addedAudioLines = audioDiff.split('\n')
  .filter(line => line.startsWith('+') && !line.startsWith('+++'))
  .map(line => line.slice(1))
while (addedAudioLines.at(-1) === '') addedAudioLines.pop()
const allowedAudioLines = observerBlock.exec(audio)![0].trim().split('\n')
assert.equal(removedAudioLines.length, 0, 'observer exception may not remove inherited audio code')
assert.deepEqual(addedAudioLines, allowedAudioLines,
  'audioEngine additions may contain only the ratified pure observer')
assert.deepEqual(getPianoReadiness('C4'), {
  sampleReady: false,
  contextState: 'uninitialized',
}, 'observer must not lazily create output state on a fresh process')
assert.equal(new Set(INTRO_ORDER).size, 15, 'whole game note set must remain explicit and unique')
for (const note of INTRO_ORDER) {
  assert.deepEqual(getPianoReadiness(note), {
    sampleReady: false,
    contextState: 'uninitialized',
  }, `fresh observer must preserve the exact direct key for ${note}`)
}

const setIndex = audio.indexOf('_pianoCache.set(note, audio)')
const decodeIndex = audio.lastIndexOf('await c.decodeAudioData(buf)', setIndex)
assert.ok(decodeIndex >= 0 && decodeIndex < setIndex,
  'cache readiness must be populated only after decode succeeds')
assert.match(audio, /sampleReady: _pianoCache\.has\(note\)/,
  'observer must use the exact direct playback cache key')
const playbackStart = audio.indexOf('export function playPianoNote(note: string')
const playbackBody = audio.slice(playbackStart, audio.indexOf('\nexport function ', playbackStart + 1))
assert.match(playbackBody, /const direct = _pianoCache\.get\(note\)/,
  'playback and readiness must use the same exact direct key for the whole game note set')
assert.doesNotMatch(observerBlock.exec(audio)?.[0] ?? '', /ctx\(|initAudio|resume\(|fetch\(|decodeAudioData/,
  'observer must not initialize, resume, fetch, or decode')

const observerRows: Array<{ state: string, sampleReady: boolean, contextState: string }> = []
const originalAudioContext = globalThis.AudioContext
const originalFetch = globalThis.fetch
let resolveC4!: (value: ArrayBuffer) => void
const c4Gate = new Promise<ArrayBuffer>(resolve => { resolveC4 = resolve })
const encodeNote = (note: string) => new TextEncoder().encode(note).buffer as ArrayBuffer

class FakeAudioParam {
  value = 1
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
  cancelScheduledValues() {}
}

class FakeAudioNode {
  gain = new FakeAudioParam()
  connect() { return this }
  disconnect() {}
}

class FakeAudioContext {
  static current: FakeAudioContext
  state: AudioContextState = 'running'
  currentTime = 0
  destination = new FakeAudioNode()
  sourceStarts = 0

  constructor() { FakeAudioContext.current = this }
  createGain() { return new FakeAudioNode() }
  resume() { this.state = 'running'; return Promise.resolve() }
  decodeAudioData(data: ArrayBuffer) {
    const note = new TextDecoder().decode(data)
    if (note === 'D4') return Promise.reject(new Error('deterministic decode failure'))
    return Promise.resolve({ note } as unknown as AudioBuffer)
  }
  createBufferSource() {
    return {
      buffer: null as AudioBuffer | null,
      playbackRate: { value: 1 },
      connect() {},
      start: () => { this.sourceStarts += 1 },
    }
  }
}

try {
  globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const note = /\/([^/]+)\.wav$/.exec(String(input))?.[1]
    if (note === 'C4') return { arrayBuffer: () => c4Gate } as Response
    if (note === 'D4') return { arrayBuffer: async () => encodeNote(note) } as Response
    throw new Error(`deterministic missing sample: ${note ?? 'unknown'}`)
  }) as typeof fetch

  initAudio()
  const load = loadPianoSamples()
  await Promise.resolve()
  await Promise.resolve()

  assert.deepEqual(getPianoReadiness('C4'), { sampleReady: false, contextState: 'running' })
  observerRows.push({ state: 'in-flight', ...getPianoReadiness('C4') })

  FakeAudioContext.current.state = 'suspended'
  assert.deepEqual(getPianoReadiness('C4'), { sampleReady: false, contextState: 'suspended' })
  observerRows.push({ state: 'suspended-in-flight', ...getPianoReadiness('C4') })

  resolveC4(encodeNote('C4'))
  await load
  assert.deepEqual(getPianoReadiness('D4'), { sampleReady: false, contextState: 'suspended' })
  observerRows.push({ state: 'failed-decode', ...getPianoReadiness('D4') })
  assert.deepEqual(getPianoReadiness('E4'), { sampleReady: false, contextState: 'suspended' })
  observerRows.push({ state: 'missing-direct', ...getPianoReadiness('E4') })
  assert.deepEqual(getPianoReadiness('C4'), { sampleReady: true, contextState: 'suspended' })
  observerRows.push({ state: 'direct-ready', ...getPianoReadiness('C4') })

  playPianoNote('C5')
  assert.equal(FakeAudioContext.current.sourceStarts, 1,
    'fallback-only note must remain playable through inherited playback fallback')
  assert.deepEqual(getPianoReadiness('C5'), { sampleReady: false, contextState: 'running' })
  observerRows.push({ state: 'fallback-only-running', ...getPianoReadiness('C5') })
  assert.deepEqual(getPianoReadiness('C4'), { sampleReady: true, contextState: 'running' })
  observerRows.push({ state: 'direct-ready-running', ...getPianoReadiness('C4') })
} finally {
  globalThis.AudioContext = originalAudioContext
  globalThis.fetch = originalFetch
}

assert.match(shell, /type ShellPhase = Phase \| 'readiness' \| 'practice' \| 'placement'/)
assert.match(shell, /if \(seen\) enterReadiness\(\)/)
assert.match(shell, /const finishTutorial[\s\S]*?enterReadiness\(\)/)
assert.match(shell, /<button onClick=\{enterReadiness\}[\s\S]*?CONTINUE\?/)
assert.match(shell, /document\.visibilityState === 'visible' && document\.hasFocus\(\)/)
assert.match(shell, /const enterReadiness[\s\S]*?readinessToneArmedRef\.current = false[\s\S]*?readinessHeardConfirmedRef\.current = false[\s\S]*?readinessVoiceHeardRef\.current = false/)
assert.match(shell, /const exitReadiness[\s\S]*?readinessToneArmedRef\.current = false[\s\S]*?readinessHeardConfirmedRef\.current = false[\s\S]*?readinessVoiceHeardRef\.current = false/)
assert.match(shell, /const replayEarReadiness[\s\S]*?if \(readinessBusyRef\.current\) return/)
assert.match(shell, /getPianoReadiness\(RADIO_CHECK_NOTE\)[\s\S]*?playPianoNote\(RADIO_CHECK_NOTE\)/)
assert.match(shell, /const answerEarReadiness[\s\S]*?!readinessToneArmedRef\.current[\s\S]*?!readinessHeardConfirmedRef\.current[\s\S]*?note !== RADIO_CHECK_NOTE[\s\S]*?no score, just a radio check/)
assert.match(shell, /const confirmEarReadiness[\s\S]*?readinessHeardConfirmedRef\.current = true[\s\S]*?PRESS C \[1\]/)
assert.match(shell, /const retryMissingEarSignal[\s\S]*?readinessHeardConfirmedRef\.current = false[\s\S]*?prepareEarReadiness\(\)/)
assert.match(shell, /setReadinessStatus\('playing-audio'\)[\s\S]*?PLAYING TEST NOTE C[\s\S]*?setTimeout\([\s\S]*?450/)
assert.match(shell, /pitchGenerationRef\.current > readinessGenerationBaselineRef\.current/)
assert.match(shell, /const retryVoiceReadiness[\s\S]*?\+\+readinessIdRef\.current[\s\S]*?prepareVoiceReadiness\(readinessId\)/)
assert.match(shell, /const prepareVoiceReadiness[\s\S]*?try \{[\s\S]*?catch \{[\s\S]*?finally \{[\s\S]*?readinessBusyRef\.current = false/)
assert.match(shell, /const continueVoiceReadiness[\s\S]*?!readinessVoiceHeardRef\.current[\s\S]*?advanceFromReadiness\(\)/)
assert.match(shell, /useEffect\(\(\) => \(\) => \{[\s\S]*?\+\+readinessIdRef\.current[\s\S]*?readinessBusyRef\.current = false/)
assert.match(shell, /health\.audioContextState === 'running'[\s\S]*?health\.trackReadyState === 'live'[\s\S]*?health\.trackMuted === false/)
assert.match(shell, /pitch\?\.isActive === true[\s\S]*?pitch\.confidence >= MIC_CONFIDENCE_FLOOR[\s\S]*?pitch\.frequency > 0/)
assert.match(shell, /data-retro-readiness/)
assert.match(shell, /role="status" aria-live="polite"/)
assert.match(shell, /PLAY TEST NOTE C/)
assert.match(shell, /YES, I HEARD IT/)
assert.match(shell, /NO SOUND - RETRY/)
assert.match(shell, /START MICROPHONE/)
assert.match(shell, /USE KEYS \/ TAP INSTEAD/)
assert.match(shell, /never your musical ability/)
assert.match(shell, /@media \(orientation: landscape\) and \(max-height: 500px\)/)

const enterReadinessStart = shell.indexOf('  const enterReadiness')
const readinessPhaseCommit = shell.indexOf("phaseRef.current = 'readiness'", enterReadinessStart)
const policyResolution = shell.indexOf('resolveRetroCurriculumSession(rawPolicy, activeLaneStore(stores, inputMode))', enterReadinessStart)
assert.ok(enterReadinessStart >= 0 && policyResolution > enterReadinessStart && policyResolution < readinessPhaseCommit,
  'symbolic curriculum policy must resolve before readiness begins')
const readinessKeyStart = shell.indexOf('const onReadinessKey =')
const readinessKeyEnd = shell.indexOf("window.addEventListener('keydown', onReadinessKey)", readinessKeyStart)
const readinessKey = shell.slice(readinessKeyStart, readinessKeyEnd)
const filterIndex = readinessKey.indexOf("event.key !== '1' && event.key.toLowerCase() !== 'c'")
const preventIndex = readinessKey.indexOf('event.preventDefault()', filterIndex)
const answerIndex = readinessKey.indexOf('answerEarReadiness(RADIO_CHECK_NOTE)', preventIndex)
assert.ok(filterIndex >= 0 && preventIndex > filterIndex && answerIndex > preventIndex,
  'RADIO CHECK must accept only the explicitly named C or 1 control')
const readinessRenderStart = shell.indexOf("if (phase === 'readiness')")
const readinessRender = shell.slice(readinessRenderStart, shell.indexOf("if (phase === 'practice')", readinessRenderStart))
assert.match(readinessRender, /\{isEar \? \([\s\S]*?YES, I HEARD IT[\s\S]*?C <span[\s\S]*?\) : \([\s\S]*?retro-readiness-voice/,
  'VOICE readiness must own no EAR response-control branch')
assert.doesNotMatch(readinessRender.slice(readinessRender.indexOf('retro-readiness-voice')), /YES, I HEARD IT|NO SOUND - RETRY|aria-label="C, key 1"/,
  'VOICE branch must not expose EAR acknowledgments or note controls')

const readinessStart = shell.indexOf('  const prepareEarReadiness')
const handleInsertCoinStart = shell.indexOf('  const handleInsertCoin', readinessStart)
assert.ok(readinessStart >= 0 && handleInsertCoinStart > readinessStart)
const readinessImplementation = shell.slice(readinessStart, handleInsertCoinStart)
assert.doesNotMatch(readinessImplementation, /gradeEar|gradeVoice|saveStore|applyRetroBlasterFamilyEvent|setScore|setShields/,
  'R8a readiness must remain outside every grading and gameplay-mutation seam')

console.log(JSON.stringify({
  status: 'PASS',
  fixture: 'R8a RADIO CHECK',
  observerMatrix: observerRows,
  rows: [
    'observer-only audio exception',
    'no-init fresh observer',
    `whole-game exact-key parity (${INTRO_ORDER.length} notes)`,
    'decoded-direct-buffer readiness',
    'menu/tutorial/game-over routing',
    'explicit EAR hear-confirm-map flow',
    'fresh healthy VOICE signal plus explicit continue',
    'VOICE failure and unmount cleanup',
    'zero persistence seam',
    'practice-placement routing and accessible status',
  ],
}, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
