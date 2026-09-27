// src/lib/speech/WebSpeechService.ts
// Replaces Whisper WASM with the native Web Speech API.
// Same interface as the old WhisperService — components need no changes.

import { matchTranscript, type VoiceAnswer } from './KeywordMatcher'
import { StableDirectionWords, type SpokenDirection } from './StableDirectionWords'

export type WhisperStatus = 'idle' | 'loading' | 'ready' | 'listening' | 'error'
export type ExerciseMode = 'e-directional' | 'letters' | 'notes'

// Web Speech API type declarations (not yet in all TypeScript DOM lib versions)
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
}
interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}
interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onspeechstart: (() => void) | null
  onspeechend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

interface ServiceOptions {
  onResult?: (answer: VoiceAnswer, rawTranscript: string) => void
  onDirectionalCommand?: (direction: SpokenDirection, rawTranscript: string) => void
  onStatusChange?: (status: WhisperStatus, message?: string) => void
  onSpeechChange?: (isSpeaking: boolean) => void
}

class WebSpeechServiceImpl {
  private recognition: SpeechRecognitionInstance | null = null
  private status: WhisperStatus = 'idle'
  private mode: ExerciseMode = 'e-directional'
  private listeners: ServiceOptions = {}
  private running = false
  private restartTimer: ReturnType<typeof setTimeout> | null = null

  private setStatus(status: WhisperStatus, message?: string): void {
    this.status = status
    this.listeners.onStatusChange?.(status, message)
  }

  /** No-op: Web Speech API needs no preloading. */
  async preload(): Promise<void> {}

  async start(mode: ExerciseMode, options: ServiceOptions): Promise<void> {
    this.mode = mode
    this.listeners = options

    const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null
    const RecognitionAPI = w
      ? ((w['SpeechRecognition'] || w['webkitSpeechRecognition']) as SpeechRecognitionConstructor | undefined)
      : null

    if (!RecognitionAPI) {
      this.setStatus('error', 'Speech recognition not supported. Use Chrome.')
      throw new Error('SpeechRecognition not available')
    }

    this.running = true
    this.setStatus('listening', 'Listening…')
    this.startRecognition(RecognitionAPI)
  }

  private startRecognition(RecognitionAPI: SpeechRecognitionConstructor): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    if (this.recognition) {
      const previous = this.recognition
      this.recognition = null
      previous.onend = null
      try { previous.abort() } catch { /* ignore */ }
    }

    const rec = new RecognitionAPI()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.maxAlternatives = 1
    const directionWords = new StableDirectionWords()

    rec.onspeechstart = () => { if (this.recognition === rec) this.listeners.onSpeechChange?.(true) }
    rec.onspeechend = () => { if (this.recognition === rec) this.listeners.onSpeechChange?.(false) }

    rec.onresult = (event: SpeechRecognitionEvent) => {
      if (this.recognition !== rec) return
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (this.mode === 'e-directional' && this.listeners.onDirectionalCommand) {
          for (const direction of directionWords.read(i, transcript, event.results[i].isFinal)) {
            this.listeners.onDirectionalCommand(direction, transcript)
          }
        }
        if (event.results[i].isFinal) {
          const answer = matchTranscript(transcript, this.mode)
          this.listeners.onResult?.(answer, transcript)
          this.listeners.onSpeechChange?.(false)
        }
      }
    }

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (this.recognition !== rec) return
      // 'no-speech' fires after ~8s of silence — ignore, onend will restart
      if (event.error === 'no-speech' || event.error === 'aborted') return
      console.error('Speech recognition error:', event.error)
      if (event.error === 'not-allowed') {
        this.setStatus('error', 'Microphone access denied')
        this.running = false
      }
    }

    rec.onend = () => {
      // Web Speech stops after each utterance/silence — restart to stay continuous
      if (this.running && this.recognition === rec && !this.restartTimer) {
        this.restartTimer = setTimeout(() => {
          this.restartTimer = null
          if (this.running && this.recognition === rec) {
            try { this.startRecognition(RecognitionAPI) }
            catch (error) {
              console.error('Speech recognition restart failed:', error)
              this.running = false
              this.setStatus('error', 'Speech recognition stopped')
            }
          }
        }, 100)
      }
    }

    this.recognition = rec
    rec.start()
  }

  /**
   * Single-shot note recognition for pitch training.
   *
   * Starts a fresh, non-continuous SpeechRecognition instance. Tries up to
   * maxAlternatives=3 hypotheses before giving up. Returns the matched note
   * string (e.g. "C4") or null on timeout/no-match/error.
   *
   * IMPORTANT: call this AFTER the audio has finished playing (use audio.onended
   * + a 200ms buffer) so the mic never picks up the piano playback.
   */
  async listenOnce(
    timeoutMs = 4000,
    onStatus?: (s: 'listening' | 'idle' | 'error') => void,
  ): Promise<string | null> {
    return new Promise(resolve => {
      const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null
      const RecognitionAPI = w
        ? ((w['SpeechRecognition'] || w['webkitSpeechRecognition']) as SpeechRecognitionConstructor | undefined)
        : null

      if (!RecognitionAPI) { resolve(null); return }

      // Fresh instance — completely independent of the continuous-mode this.recognition
      const rec = new RecognitionAPI()
      rec.continuous = false       // one utterance then done
      rec.interimResults = false   // only final results
      rec.lang = 'en-US'
      rec.maxAlternatives = 3      // try 3 hypotheses to beat phonetic ambiguity

      let done = false
      const finish = (note: string | null) => {
        if (done) return
        done = true
        clearTimeout(timer)
        try { rec.abort() } catch { /* ignore */ }
        onStatus?.('idle')
        resolve(note)
      }

      const timer = setTimeout(() => finish(null), timeoutMs)
      onStatus?.('listening')

      rec.onresult = (event: SpeechRecognitionEvent) => {
        const result = event.results[0]
        // Try each alternative until we get a note match
        for (let i = 0; i < result.length; i++) {
          const answer = matchTranscript(result[i].transcript, 'notes')
          if (answer && answer.type === 'note') {
            finish(answer.value)
            return
          }
        }
        // No alternative matched — wait for onend (may be more results coming)
        // but since continuous=false, onend fires right after onresult
        finish(null)
      }

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'not-allowed') onStatus?.('error')
        finish(null)
      }

      rec.onend = () => finish(null)

      try {
        rec.start()
      } catch {
        finish(null)
      }
    })
  }

  stop(): void {
    this.running = false
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    if (this.recognition) {
      const previous = this.recognition
      this.recognition = null
      previous.onend = null
      try { previous.abort() } catch { /* ignore */ }
    }
    this.listeners = {}
    this.setStatus('idle')
  }

  destroy(): void {
    this.stop()
  }

  getStatus(): WhisperStatus {
    return this.status
  }

  isModelLoaded(): boolean {
    return true
  }
}

// Singleton — same export name as before so all components work unchanged
export const WhisperService = new WebSpeechServiceImpl()
