import assert from 'node:assert/strict'
import { WhisperService } from '../src/lib/speech/WebSpeechService'

class FakeRecognition {
  static instances: FakeRecognition[] = []
  onend: (() => void) | null = null
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onspeechstart: (() => void) | null = null
  onspeechend: (() => void) | null = null

  constructor() { FakeRecognition.instances.push(this) }
  start() {}
  stop() { this.onend?.() }
  abort() { queueMicrotask(() => this.onend?.()) }
}

async function main() {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { SpeechRecognition: FakeRecognition },
  })

  const answers: string[] = []
  try {
    await WhisperService.start('e-directional', {
      onResult: answer => { if (answer?.type === 'direction') answers.push(answer.value) },
    })
    assert.equal(FakeRecognition.instances.length, 1)

    FakeRecognition.instances[0].onend?.()
    await new Promise(resolve => setTimeout(resolve, 260))
    assert.equal(FakeRecognition.instances.length, 2, 'one ended session creates exactly one replacement')

    FakeRecognition.instances[1].onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'up' } }],
    })
    assert.deepEqual(answers, ['up'], 'the replacement remains able to deliver a command')

    WhisperService.stop()
    await WhisperService.start('e-directional', {
      onResult: answer => { if (answer?.type === 'direction') answers.push(answer.value) },
    })
    FakeRecognition.instances[1].onend?.()
    await new Promise(resolve => setTimeout(resolve, 140))
    assert.equal(FakeRecognition.instances.length, 3, 'a stale session cannot replace a new one')
  } finally {
    WhisperService.stop()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
