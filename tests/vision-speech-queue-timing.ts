import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'

const CUE = 'Inhale 4 sec nose • hold 2 • exhale 6 through lips.'
const CUE_URL = '/audio/vision-cues/in-memory-cue.mp3'
const MANIFEST_DELAY_MS = 120
const CUE_FETCH_DELAY_MS = 120
const PRELOAD_DELAY_MS = 15
const warm = process.env.VISION_TIMING_WARM === '1'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type PlayEvent = { at: number; wasPreloaded: boolean }

class FakeAudio {
  static preloaded = new Set<string>()
  static playEvents: PlayEvent[] = []
  src = ''
  preload = ''
  muted = false
  volume = 1
  currentTime = 0
  onended: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(src = '') {
    this.src = src
  }

  load(): void {
    if (this.src === CUE_URL) {
      setTimeout(() => FakeAudio.preloaded.add(this.src), PRELOAD_DELAY_MS)
    }
  }

  play(): Promise<void> {
    const wasPreloaded = FakeAudio.preloaded.has(this.src)
    const delay = this.src === CUE_URL && !wasPreloaded ? CUE_FETCH_DELAY_MS : 0
    return wait(delay).then(() => {
      FakeAudio.playEvents.push({ at: performance.now(), wasPreloaded })
    })
  }

  pause(): void {}
}

class FakeSpeechSynthesisUtterance {
  rate = 1
  pitch = 1
  volume = 1
  onend: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(public text: string) {}
}

const fakeSpeechSynthesis = {
  cancel(): void {},
  speak(utterance: FakeSpeechSynthesisUtterance): void {
    utterance.onend?.()
  },
}

Object.assign(globalThis, {
  Audio: FakeAudio,
  SpeechSynthesisUtterance: FakeSpeechSynthesisUtterance,
  window: { speechSynthesis: fakeSpeechSynthesis },
  fetch: async () => {
    await wait(MANIFEST_DELAY_MS)
    return {
      ok: true,
      json: async () => ({ cue: { file: `data/tts-render/vision-cues/audio/${CUE_URL.split('/').pop()}`, text: CUE } }),
    }
  },
})

async function main(): Promise<void> {
  const manifest = await import('../src/lib/vision/voiceManifest')

  let preloadMs = 0
  if (warm) {
    assert.equal(typeof manifest.preloadVoiceCues, 'function')
    const preloadStarted = performance.now()
    await manifest.preloadVoiceCues([CUE])
    await wait(PRELOAD_DELAY_MS + 5)
    preloadMs = performance.now() - preloadStarted
  }

  const { SpeechQueue } = await import('../src/lib/vision/audioKit')
  const queue = new SpeechQueue()
  const speakStarted = performance.now()
  queue.speak(CUE, { interrupt: true })

  while (FakeAudio.playEvents.length === 0) await wait(5)

  const firstCueMs = FakeAudio.playEvents[0].at - speakStarted
  const result = {
    mode: warm ? 'warm' : 'cold',
    preloadMs: Math.round(preloadMs * 100) / 100,
    firstCueMs: Math.round(firstCueMs * 100) / 100,
    preloaded: FakeAudio.playEvents[0].wasPreloaded,
  }
  console.log(JSON.stringify(result))

  if (warm) {
    assert.equal(result.preloaded, true)
    assert.ok(result.firstCueMs < 50, `warm first cue took ${result.firstCueMs}ms`)
  } else {
    assert.equal(result.preloaded, false)
    assert.ok(result.firstCueMs >= CUE_FETCH_DELAY_MS - 10, `cold first cue took ${result.firstCueMs}ms`)
  }
}

void main()
