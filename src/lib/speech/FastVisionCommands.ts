import { matchTranscript, type VoiceAnswer } from './KeywordMatcher'
import type { WhisperStatus } from './WebSpeechService'
import type { SpeechCommandRecognizer } from '@tensorflow-models/speech-commands'

type CommandSet = 'directions' | 'numbers'
type Listeners = {
  onResult?: (answer: VoiceAnswer, rawTranscript: string) => void
  onStatusChange?: (status: WhisperStatus, message?: string) => void
  onSpeechChange?: (speaking: boolean) => void
}

const directions = new Set(['up', 'down', 'left', 'right'])
const numbers = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'])

/** On-device, closed-vocabulary commands for Vision charts only. */
class FastVisionCommandService {
  private model: SpeechCommandRecognizer | null = null
  private loading: Promise<void> | null = null
  private pendingListen: Promise<void> | null = null
  private pendingStop: Promise<void> = Promise.resolve()
  private generation = 0
  private listeners: Listeners = {}
  private status: WhisperStatus = 'idle'

  async start(commandSet: CommandSet, listeners: Listeners): Promise<void> {
    const generation = ++this.generation
    this.listeners = listeners
    this.setStatus('loading', 'Loading local commands…')
    await this.pendingStop
    if (generation !== this.generation) return

    try {
      if (!this.model) {
        await import('@tensorflow/tfjs')
        const { create } = await import('@tensorflow-models/speech-commands')
        if (generation !== this.generation) return
        this.model = create('BROWSER_FFT', '18w')
      }
      this.loading ||= this.model.ensureModelLoaded()
      await this.loading
      if (generation !== this.generation) return

      const labels = this.model.wordLabels()
      const allowed = commandSet === 'directions' ? directions : numbers
      let candidate = ''
      let consecutive = 0
      let quietFrames = 0
      let accepted = ''

      this.pendingListen = this.model.listen(async result => {
        if (generation !== this.generation) return
        const scores = Array.from(result.scores instanceof Float32Array ? result.scores : result.scores[0])
        const index = scores.indexOf(Math.max(...scores))
        const label = labels[index]
        const active = allowed.has(label) && scores[index] >= 0.75

        if (!active) {
          candidate = ''
          consecutive = 0
          if (++quietFrames >= 2) {
            accepted = ''
            this.listeners.onSpeechChange?.(false)
          }
          return
        }

        quietFrames = 0
        this.listeners.onSpeechChange?.(true)
        consecutive = label === candidate ? consecutive + 1 : 1
        candidate = label
        if (consecutive < 2 || accepted === label) return

        accepted = label
        const answer = commandSet === 'directions' ? matchTranscript(label, 'e-directional') : null
        this.listeners.onResult?.(answer, label)
      }, {
        probabilityThreshold: 0,
        invokeCallbackOnNoiseAndUnknown: true,
        overlapFactor: 0.75,
        suppressionTimeMillis: 0,
        audioTrackConstraints: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      })
      await this.pendingListen
      if (generation !== this.generation) {
        if (this.model.isListening()) await this.model.stopListening()
        return
      }
      this.setStatus('listening', 'Local commands listening')
    } catch (error) {
      this.loading = null
      if (generation === this.generation) {
        this.setStatus('error', 'Local commands unavailable')
        throw error
      }
    } finally {
      this.pendingListen = null
    }
  }

  stop(): void {
    ++this.generation
    this.listeners = {}
    const pending = this.pendingListen
    const model = this.model
    this.pendingStop = Promise.resolve(pending).catch(() => {}).then(async () => {
      if (model?.isListening()) await model.stopListening()
    }).catch(() => {})
    this.status = 'idle'
  }

  waitForStop(): Promise<void> { return this.pendingStop }

  getStatus(): WhisperStatus { return this.status }

  private setStatus(status: WhisperStatus, message?: string): void {
    this.status = status
    this.listeners.onStatusChange?.(status, message)
  }
}

export const FastVisionCommands = new FastVisionCommandService()
