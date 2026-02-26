// src/lib/speech/WhisperService.ts

import { VoiceActivityDetector } from './VoiceActivityDetector'
import { matchTranscript, type VoiceAnswer } from './KeywordMatcher'

export type WhisperStatus = 'idle' | 'loading' | 'ready' | 'listening' | 'error'
export type ExerciseMode = 'e-directional' | 'letters'

interface WhisperServiceOptions {
  onResult?: (answer: VoiceAnswer, rawTranscript: string) => void
  onStatusChange?: (status: WhisperStatus, message?: string) => void
  onSpeechChange?: (isSpeaking: boolean) => void
}

class WhisperServiceImpl {
  private worker: Worker | null = null
  private vad: VoiceActivityDetector | null = null
  private status: WhisperStatus = 'idle'
  private mode: ExerciseMode = 'e-directional'
  private listeners: WhisperServiceOptions = {}
  private modelLoaded = false

  /** Pre-load the Whisper model in the background (call early, e.g., when user opens Focus Training) */
  async preload(): Promise<void> {
    if (this.worker || this.modelLoaded) return
    this.createWorker()
    this.worker!.postMessage({ type: 'load' })
  }

  private createWorker(): void {
    if (this.worker) return
    this.worker = new Worker(
      new URL('./whisper.worker.ts', import.meta.url),
      { type: 'module' }
    )
    this.worker.onmessage = (event: MessageEvent) => {
      this.handleWorkerMessage(event.data)
    }
  }

  private handleWorkerMessage(data: { type: string; status?: string; text?: string; message?: string }): void {
    if (data.type === 'status') {
      if (data.status === 'loading') {
        this.setStatus('loading', data.message)
      } else if (data.status === 'ready') {
        this.modelLoaded = true
        // If we were waiting to start listening, the status is set by start()
        if (this.status === 'loading') {
          this.setStatus('ready', data.message)
        }
      } else if (data.status === 'error') {
        this.setStatus('error', data.message)
      }
    } else if (data.type === 'result') {
      const answer = matchTranscript(data.text || '', this.mode)
      this.listeners.onResult?.(answer, data.text || '')
    } else if (data.type === 'error') {
      console.error('Whisper worker error:', data.message)
    }
  }

  private setStatus(status: WhisperStatus, message?: string): void {
    this.status = status
    this.listeners.onStatusChange?.(status, message)
  }

  /** Start listening. Loads model if needed. */
  async start(mode: ExerciseMode, options: WhisperServiceOptions): Promise<void> {
    this.mode = mode
    this.listeners = options

    // Create worker and load model if not already done
    this.createWorker()
    if (!this.modelLoaded) {
      this.setStatus('loading', 'Loading voice model...')
      this.worker!.postMessage({ type: 'load' })
      // Wait for model to load
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Model load timeout')), 60000)
        const originalHandler = this.worker!.onmessage
        this.worker!.onmessage = (event: MessageEvent) => {
          if (event.data.type === 'status' && event.data.status === 'ready') {
            this.modelLoaded = true
            clearTimeout(timeout)
            this.worker!.onmessage = originalHandler
            this.handleWorkerMessage(event.data)
            resolve()
          } else if (event.data.type === 'status' && event.data.status === 'error') {
            clearTimeout(timeout)
            this.worker!.onmessage = originalHandler
            this.handleWorkerMessage(event.data)
            reject(new Error(event.data.message))
          } else {
            // Pass through other messages
            this.handleWorkerMessage(event.data)
          }
        }
      })
    }

    // Start VAD
    this.vad = new VoiceActivityDetector({
      threshold: 0.008,
      silenceTimeout: 500,
      maxChunkDuration: 2500,
      onChunk: (audio: Float32Array) => {
        // Send audio to worker for transcription
        this.worker!.postMessage(
          { type: 'transcribe', audio },
          [audio.buffer] // transfer ownership for zero-copy
        )
      },
      onSpeechChange: (isSpeaking: boolean) => {
        this.listeners.onSpeechChange?.(isSpeaking)
      },
    })

    try {
      await this.vad.start()
      this.setStatus('listening', 'Listening...')
    } catch (error) {
      this.setStatus('error', 'Microphone access denied')
      throw error
    }
  }

  /** Stop listening. Does NOT unload the model (stays cached for next start). */
  stop(): void {
    if (this.vad) {
      this.vad.stop()
      this.vad = null
    }
    this.listeners = {}
    this.setStatus('idle')
  }

  /** Fully destroy the service (unload model, terminate worker). */
  destroy(): void {
    this.stop()
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.modelLoaded = false
  }

  getStatus(): WhisperStatus {
    return this.status
  }

  isModelLoaded(): boolean {
    return this.modelLoaded
  }
}

// Singleton — one service shared across all chart components
export const WhisperService = new WhisperServiceImpl()
