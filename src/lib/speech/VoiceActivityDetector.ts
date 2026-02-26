// src/lib/speech/VoiceActivityDetector.ts

export interface VADOptions {
  /** Energy threshold for speech detection (0-1). Default: 0.01 */
  threshold?: number
  /** Silence duration (ms) before chunk is emitted. Default: 600 */
  silenceTimeout?: number
  /** Maximum chunk duration (ms). Default: 3000 */
  maxChunkDuration?: number
  /** Callback when a speech chunk is ready */
  onChunk: (audio: Float32Array) => void
  /** Callback for listening state changes */
  onSpeechChange?: (isSpeaking: boolean) => void
}

export class VoiceActivityDetector {
  private audioContext: AudioContext | null = null
  private stream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null

  private buffer: Float32Array[] = []
  private isSpeaking = false
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private chunkStartTime = 0

  private threshold: number
  private silenceTimeout: number
  private maxChunkDuration: number
  private onChunk: (audio: Float32Array) => void
  private onSpeechChange?: (isSpeaking: boolean) => void

  constructor(options: VADOptions) {
    this.threshold = options.threshold ?? 0.01
    this.silenceTimeout = options.silenceTimeout ?? 600
    this.maxChunkDuration = options.maxChunkDuration ?? 3000
    this.onChunk = options.onChunk
    this.onSpeechChange = options.onSpeechChange
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
        sampleRate: 16000,
      },
    })

    // Create audio context at 16kHz (Whisper's expected sample rate)
    this.audioContext = new AudioContext({ sampleRate: 16000 })
    this.source = this.audioContext.createMediaStreamSource(this.stream)

    // ScriptProcessorNode for audio processing (4096 buffer, mono)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

    this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
      const inputData = event.inputBuffer.getChannelData(0)
      const samples = new Float32Array(inputData) // copy

      // Calculate RMS energy
      let sum = 0
      for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i]
      }
      const rms = Math.sqrt(sum / samples.length)

      if (rms > this.threshold) {
        // Speech detected
        if (!this.isSpeaking) {
          this.isSpeaking = true
          this.chunkStartTime = Date.now()
          this.onSpeechChange?.(true)
        }
        this.buffer.push(samples)

        // Clear silence timer
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer)
          this.silenceTimer = null
        }

        // Check max duration
        if (Date.now() - this.chunkStartTime >= this.maxChunkDuration) {
          this.emitChunk()
        }
      } else if (this.isSpeaking) {
        // Silence during speech — start silence timer
        this.buffer.push(samples) // include trailing silence
        if (!this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            this.emitChunk()
          }, this.silenceTimeout)
        }
      }
    }

    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
  }

  private emitChunk(): void {
    if (this.buffer.length === 0) return

    // Concatenate all buffered samples into one Float32Array
    const totalLength = this.buffer.reduce((sum, arr) => sum + arr.length, 0)
    const chunk = new Float32Array(totalLength)
    let offset = 0
    for (const part of this.buffer) {
      chunk.set(part, offset)
      offset += part.length
    }

    this.buffer = []
    this.isSpeaking = false
    this.silenceTimer = null
    this.onSpeechChange?.(false)

    // Only emit if chunk has meaningful content (at least 0.2s of audio)
    if (chunk.length >= 3200) { // 0.2s at 16kHz
      this.onChunk(chunk)
    }
  }

  stop(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    this.buffer = []
    this.isSpeaking = false
  }
}
