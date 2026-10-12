import { matchTranscript, type VoiceAnswer } from './KeywordMatcher'
import type { SpokenDirection } from './StableDirectionWords'
import type { WhisperStatus } from './WebSpeechService'
import type { SpeechCommandRecognizer, SpeechCommandRecognizerResult } from '@tensorflow-models/speech-commands'

export type VisionCommandSet = 'directions' | 'numbers'

type Listeners = {
  onResult?: (answer: VoiceAnswer, rawTranscript: string) => void
  onDirectionalCommand?: (direction: SpokenDirection, rawTranscript: string) => void
  onStatusChange?: (status: WhisperStatus, message?: string) => void
  onSpeechChange?: (speaking: boolean) => void
}

const directions = new Set(['up', 'down', 'left', 'right'])
const numbers = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'])

/** Two adjacent model windows reject transient labels; different words need no quiet gap. */
export class VisionCommandGate {
  private held = ''
  private candidate = ''
  private candidateWindows = 0

  constructor(private readonly allowed: ReadonlySet<string>, private readonly threshold = 0.78) {}

  push(label: string, confidence: number): string | null {
    if (!this.allowed.has(label)) {
      this.held = ''
      this.candidate = ''
      this.candidateWindows = 0
      return null
    }
    // A weak reading of the same word is not proof that the speaker released it.
    if (confidence < this.threshold) {
      this.candidate = ''
      this.candidateWindows = 0
      return null
    }
    if (label === this.held) {
      this.candidate = ''
      this.candidateWindows = 0
      return null
    }
    if (label !== this.candidate) {
      this.candidate = label
      this.candidateWindows = 1
      return null
    }
    if (++this.candidateWindows < 2) return null
    this.held = label
    this.candidate = ''
    this.candidateWindows = 0
    return label
  }
}

function topPrediction(result: SpeechCommandRecognizerResult, labels: string[]): [string, number] {
  const scores = result.scores instanceof Float32Array ? result.scores : result.scores[0]
  let winner = 0
  for (let index = 1; index < scores.length; index++) {
    if (scores[index] > scores[winner]) winner = index
  }
  return [labels[winner], scores[winner]]
}

/** Continuous local keyword recognition for Vision charts. No browser-speech fallback. */
class FastVisionCommandService {
  private models: Partial<Record<VisionCommandSet, SpeechCommandRecognizer>> = {}
  private modelLoads: Partial<Record<VisionCommandSet, Promise<void>>> = {}
  private activeModel: SpeechCommandRecognizer | null = null
  private transition: Promise<void> = Promise.resolve()
  private pendingStop: Promise<void> = Promise.resolve()
  private primer: MediaStream | null = null
  private priming: Promise<void> | null = null
  private primeGeneration = 0
  private generation = 0
  private listeners: Listeners = {}
  private status: WhisperStatus = 'idle'
  private speechTimer: ReturnType<typeof setTimeout> | null = null
  private speaking = false

  /** Call on the Voice button tap so iOS grants the mic before model loading. */
  primeMicrophone(): Promise<void> {
    if (this.primer) return Promise.resolve()
    if (this.priming) return this.priming
    const token = ++this.primeGeneration
    const request = navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    }).then(stream => {
      if (token !== this.primeGeneration) stream.getTracks().forEach(track => track.stop())
      else this.primer = stream
    })
    this.priming = request
    void request.finally(() => {
      if (this.priming === request) this.priming = null
    }).catch(() => {})
    return request
  }

  async start(commandSet: VisionCommandSet, listeners: Listeners): Promise<void> {
    const generation = ++this.generation
    this.listeners = listeners
    this.setStatus('loading', 'Loading local voice commands…')

    const startTransition = this.transition.catch(() => {}).then(async () => {
      if (generation !== this.generation) return
      await this.stopActiveModel()
      if (generation !== this.generation) return

      let model: SpeechCommandRecognizer | null = null
      try {
        model = await this.getModel(commandSet)
        if (generation !== this.generation) return
        if (this.priming) await this.priming
        if (generation !== this.generation) return
        const labels = model.wordLabels()
        const allowed = commandSet === 'directions' ? directions : numbers
        const gate = new VisionCommandGate(allowed)

        // A 75% overlap supplies a new prediction roughly every quarter window.
        // No utterance-end pause is needed between different accepted words.
        await model.listen(async result => {
          if (generation !== this.generation) return
          const [label, confidence] = topPrediction(result, labels)
          const accepted = gate.push(label, confidence)
          if (!accepted) {
            if (!allowed.has(label)) this.setSpeaking(false)
            return
          }

          this.setSpeaking(true)
          this.scheduleSpeechRelease(generation)
          if (commandSet === 'directions') {
            if (this.listeners.onDirectionalCommand) {
              this.listeners.onDirectionalCommand(accepted as SpokenDirection, accepted)
            } else {
              this.listeners.onResult?.(matchTranscript(accepted, 'e-directional'), accepted)
            }
          } else {
            // The chart already parses spoken Gabor numbers from raw transcripts.
            this.listeners.onResult?.(null, accepted)
          }
        }, {
          probabilityThreshold: 0,
          invokeCallbackOnNoiseAndUnknown: true,
          overlapFactor: 0.75,
          suppressionTimeMillis: 0,
          audioTrackConstraints: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
        })

        this.activeModel = model
        if (generation !== this.generation) {
          await this.stopActiveModel()
          return
        }
        this.releasePrimer()
        this.setStatus('listening', 'Local commands listening')
      } catch (error) {
        if (model?.isListening()) await model.stopListening()
        this.releasePrimer()
        if (generation === this.generation) {
          this.setStatus('error', error instanceof Error ? error.message : 'Local commands unavailable')
          throw error
        }
      }
    })

    this.transition = startTransition
    return startTransition
  }

  stop(): void {
    ++this.generation
    this.releasePrimer()
    this.clearSpeechTimer()
    this.speaking = false
    this.listeners = {}
    this.status = 'idle'
    const stopTransition = this.transition.catch(() => {}).then(() => this.stopActiveModel())
    this.transition = stopTransition
    this.pendingStop = stopTransition
  }

  waitForStop(): Promise<void> { return this.pendingStop }

  getStatus(): WhisperStatus { return this.status }

  private async getModel(commandSet: VisionCommandSet): Promise<SpeechCommandRecognizer> {
    if (!this.models[commandSet]) {
      await import('@tensorflow/tfjs') // Register a TFJS backend before creating the recognizer.
      const { create } = await import('@tensorflow-models/speech-commands')
      this.models[commandSet] = create('BROWSER_FFT', commandSet === 'directions' ? 'directional4w' : '18w')
    }
    const model = this.models[commandSet]!
    try {
      this.modelLoads[commandSet] ||= model.ensureModelLoaded()
      await this.modelLoads[commandSet]
    } catch (error) {
      delete this.modelLoads[commandSet]
      delete this.models[commandSet]
      throw error
    }
    return model
  }

  private async stopActiveModel(): Promise<void> {
    const model = this.activeModel
    this.activeModel = null
    if (model?.isListening()) await model.stopListening()
    this.clearSpeechTimer()
    this.setSpeaking(false)
  }

  private releasePrimer(): void {
    ++this.primeGeneration
    this.primer?.getTracks().forEach(track => track.stop())
    this.primer = null
    this.priming = null
  }

  private scheduleSpeechRelease(generation: number): void {
    this.clearSpeechTimer()
    this.speechTimer = setTimeout(() => {
      if (generation === this.generation) this.setSpeaking(false)
    }, 500)
  }

  private clearSpeechTimer(): void {
    if (this.speechTimer) clearTimeout(this.speechTimer)
    this.speechTimer = null
  }

  private setSpeaking(speaking: boolean): void {
    if (speaking === this.speaking) return
    this.speaking = speaking
    this.listeners.onSpeechChange?.(speaking)
  }

  private setStatus(status: WhisperStatus, message?: string): void {
    this.status = status
    this.listeners.onStatusChange?.(status, message)
  }
}

export const FastVisionCommands = new FastVisionCommandService()
