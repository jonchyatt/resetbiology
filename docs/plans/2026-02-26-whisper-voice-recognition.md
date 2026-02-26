# Whisper Voice Recognition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the unreliable Web Speech API with Transformers.js Whisper running in-browser for instant, accurate voice recognition across all vision training chart types.

**Architecture:** Microphone audio flows through an AudioWorklet (voice activity detection + 16kHz resampling) → Web Worker (Whisper inference) → KeywordMatcher (transcript → valid answer). A singleton WhisperService orchestrates the pipeline and exposes a simple `onResult` callback consumed by SnellenChart and BinocularChart.

**Tech Stack:** `@huggingface/transformers` v3 (stable), `onnx-community/whisper-tiny.en` model (~40MB, cached in IndexedDB), Web Workers, AudioWorklet API.

---

### Task 1: Install @huggingface/transformers

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run:
```bash
npm install @huggingface/transformers@^3
```

**Step 2: Verify installation**

Run:
```bash
node -e "require('@huggingface/transformers'); console.log('OK')"
```
Expected: `OK` (no errors)

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @huggingface/transformers for Whisper voice recognition"
```

---

### Task 2: Create KeywordMatcher

The simplest component — pure logic, no browser APIs, fully testable.

**Files:**
- Create: `src/lib/speech/KeywordMatcher.ts`

**Step 1: Create the keyword matcher**

This maps raw Whisper transcripts to valid answers. Handles fuzzy matching (e.g., "write" → "right", "be" → "B"), case insensitivity, and trimming.

```typescript
// src/lib/speech/KeywordMatcher.ts

export type VoiceAnswer =
  | { type: 'direction'; value: 'up' | 'down' | 'left' | 'right' }
  | { type: 'letter'; value: string }
  | null

// Direction synonyms — Whisper often transcribes these variants
const DIRECTION_MAP: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  up: 'up', top: 'up', above: 'up', app: 'up', uhp: 'up', uh: 'up',
  down: 'down', bottom: 'down', below: 'down', don: 'down', doubt: 'down',
  left: 'left', lift: 'left', laughed: 'left', lft: 'left',
  right: 'right', write: 'right', wright: 'right', rite: 'right', light: 'right', ride: 'right',
}

// Letters used in the Snellen chart — map phonetic variants
// The chart uses: O, Q, C, D, H, M, N, K, X, R, S, Z, V
const LETTER_MAP: Record<string, string> = {
  o: 'O', oh: 'O', zero: 'O',
  q: 'Q', cue: 'Q', queue: 'Q', cute: 'Q',
  c: 'C', see: 'C', sea: 'C', si: 'C',
  d: 'D', dee: 'D', the: 'D',
  h: 'H', age: 'H', ache: 'H', aitch: 'H',
  m: 'M', em: 'M', am: 'M',
  n: 'N', en: 'N', and: 'N', in: 'N',
  k: 'K', kay: 'K', okay: 'K', cake: 'K',
  x: 'X', ex: 'X', acts: 'X', eggs: 'X',
  r: 'R', are: 'R', our: 'R', er: 'R',
  s: 'S', es: 'S', as: 'S', ass: 'S', yes: 'S',
  z: 'Z', zee: 'Z', zed: 'Z', said: 'Z',
  v: 'V', vee: 'V', we: 'V', ve: 'V', bee: 'V',
}

/**
 * Match a Whisper transcript to a valid chart answer.
 * Extracts the LAST word (most recent utterance) and fuzzy-matches it.
 *
 * @param mode - 'e-directional' matches directions, 'letters' matches letter names
 */
export function matchTranscript(
  transcript: string,
  mode: 'e-directional' | 'letters'
): VoiceAnswer {
  const cleaned = transcript.trim().toLowerCase().replace(/[^a-z\s]/g, '')
  if (!cleaned) return null

  const words = cleaned.split(/\s+/)
  const lastWord = words[words.length - 1]

  if (mode === 'e-directional') {
    const dir = DIRECTION_MAP[lastWord]
    if (dir) return { type: 'direction', value: dir }
    // Also check second-to-last word in case of filler
    if (words.length >= 2) {
      const prevWord = words[words.length - 2]
      const dir2 = DIRECTION_MAP[prevWord]
      if (dir2) return { type: 'direction', value: dir2 }
    }
    return null
  }

  // Letter mode — check last word, also try single-char match
  if (mode === 'letters') {
    // Direct single-letter match (Whisper sometimes returns just "B")
    if (lastWord.length === 1 && LETTER_MAP[lastWord]) {
      return { type: 'letter', value: LETTER_MAP[lastWord] }
    }
    // Phonetic match
    const letter = LETTER_MAP[lastWord]
    if (letter) return { type: 'letter', value: letter }
    // Check previous word
    if (words.length >= 2) {
      const prevWord = words[words.length - 2]
      if (prevWord.length === 1 && LETTER_MAP[prevWord]) {
        return { type: 'letter', value: LETTER_MAP[prevWord] }
      }
      const letter2 = LETTER_MAP[prevWord]
      if (letter2) return { type: 'letter', value: letter2 }
    }
    return null
  }

  return null
}
```

**Step 2: Commit**

```bash
git add src/lib/speech/KeywordMatcher.ts
git commit -m "feat: add KeywordMatcher for Whisper transcript → answer mapping"
```

---

### Task 3: Create the Whisper Web Worker

Runs the heavy Whisper inference off the main thread.

**Files:**
- Create: `src/lib/speech/whisper.worker.ts`

**Step 1: Create the worker**

The worker loads the Whisper pipeline once on first message, then processes audio chunks. It communicates via `postMessage`.

```typescript
// src/lib/speech/whisper.worker.ts

import { pipeline, Pipeline } from '@huggingface/transformers'

let transcriber: Pipeline | null = null
let loading = false

async function loadModel() {
  if (transcriber || loading) return
  loading = true

  try {
    self.postMessage({ type: 'status', status: 'loading', message: 'Loading voice model...' })

    transcriber = await pipeline(
      'automatic-speech-recognition',
      'onnx-community/whisper-tiny.en',
      {
        dtype: 'q8',       // quantized for speed
        device: 'wasm',    // works everywhere; 'webgpu' for supported browsers
      }
    )

    self.postMessage({ type: 'status', status: 'ready', message: 'Voice model ready' })
  } catch (error) {
    self.postMessage({
      type: 'status',
      status: 'error',
      message: `Failed to load voice model: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  } finally {
    loading = false
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { type, audio } = event.data

  if (type === 'load') {
    await loadModel()
    return
  }

  if (type === 'transcribe') {
    if (!transcriber) {
      await loadModel()
      if (!transcriber) return
    }

    try {
      const result = await transcriber(audio, {
        language: 'en',
        task: 'transcribe',
      })

      // result is { text: string } or { text: string }[]
      const text = Array.isArray(result) ? result[0]?.text : (result as { text: string }).text

      self.postMessage({
        type: 'result',
        text: text || '',
        timestamp: Date.now(),
      })
    } catch (error) {
      self.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Transcription failed',
      })
    }
  }
}
```

**Step 2: Configure Next.js to handle the worker**

Workers in Next.js need to be loaded via `new Worker(new URL(...), { type: 'module' })`. No config changes needed — this pattern works with Next.js webpack out of the box.

**Step 3: Commit**

```bash
git add src/lib/speech/whisper.worker.ts
git commit -m "feat: add Whisper Web Worker for off-thread speech recognition"
```

---

### Task 4: Create VoiceActivityDetector

Captures microphone audio, detects when the user starts/stops speaking, and sends audio chunks for transcription.

**Files:**
- Create: `src/lib/speech/VoiceActivityDetector.ts`

**Step 1: Create the VAD**

Uses `AudioContext` + `ScriptProcessorNode` (wider browser support than AudioWorklet for this simple use case). Detects speech via energy threshold, buffers audio during speech, emits Float32Array chunks at 16kHz when silence is detected.

```typescript
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
```

**Step 2: Commit**

```bash
git add src/lib/speech/VoiceActivityDetector.ts
git commit -m "feat: add VoiceActivityDetector with energy-based speech detection"
```

---

### Task 5: Create WhisperService (Singleton Orchestrator)

Ties everything together: VAD → Worker → KeywordMatcher → callbacks.

**Files:**
- Create: `src/lib/speech/WhisperService.ts`
- Create: `src/lib/speech/index.ts` (barrel export)

**Step 1: Create the service**

```typescript
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
```

**Step 2: Create barrel export**

```typescript
// src/lib/speech/index.ts

export { WhisperService, type WhisperStatus, type ExerciseMode } from './WhisperService'
export { matchTranscript, type VoiceAnswer } from './KeywordMatcher'
```

**Step 3: Commit**

```bash
git add src/lib/speech/WhisperService.ts src/lib/speech/index.ts
git commit -m "feat: add WhisperService singleton orchestrating VAD → Worker → KeywordMatcher"
```

---

### Task 6: Integrate into SnellenChart.tsx

Replace the Web Speech API code with WhisperService.

**Files:**
- Modify: `src/components/Vision/Training/SnellenChart.tsx`

**Step 1: Replace the speech recognition code**

Changes to make:
1. Remove the Web Speech API type declarations (lines 6-48)
2. Remove the `declare global` block (lines 43-48)
3. Replace voice state variables and refs (lines 206-211) with WhisperService state
4. Remove the entire Web Speech API setup `useEffect` (lines 273-290)
5. Remove the voice start/stop `useEffect` (lines 297-365)
6. Replace with WhisperService integration
7. Extend voice support to letter mode (currently only e-directional)

Remove these imports/types from the top of the file:
- All `SpeechRecognition*` interfaces (lines 7-48)
- The `declare global` block

Add this import:
```typescript
import { WhisperService, type WhisperStatus } from '@/lib/speech'
```

Replace the voice state block (lines 205-211):
```typescript
// Voice recognition state (Whisper — runs in-browser via Web Worker)
const [voiceEnabled, setVoiceEnabled] = useState(false)
const [voiceStatus, setVoiceStatus] = useState<WhisperStatus>('idle')
const [isSpeaking, setIsSpeaking] = useState(false)
const [lastHeard, setLastHeard] = useState<string>('')
```

Remove the old `recognitionRef`, `voiceEnabledRef`, `voiceSupported` state.

Replace the voice setup/control useEffects (lines 273-365) with:
```typescript
// Preload Whisper model when component mounts (background, no blocking)
useEffect(() => {
  WhisperService.preload()
}, [])

// Start/stop Whisper voice recognition
useEffect(() => {
  if (!voiceEnabled) {
    WhisperService.stop()
    setIsSpeaking(false)
    setLastHeard('')
    return
  }

  const mode = exerciseType === 'e-directional' ? 'e-directional' : 'letters'

  WhisperService.start(mode, {
    onResult: (answer, rawTranscript) => {
      setLastHeard(rawTranscript.trim().split(/\s+/).pop() || '')
      if (!answer) return

      if (answer.type === 'direction' && exerciseType === 'e-directional') {
        window.dispatchEvent(new CustomEvent('voiceDirection', { detail: answer.value }))
      } else if (answer.type === 'letter' && exerciseType === 'letters') {
        window.dispatchEvent(new CustomEvent('voiceLetter', { detail: answer.value }))
      }
    },
    onStatusChange: (status) => {
      setVoiceStatus(status)
      if (status === 'error') {
        setVoiceEnabled(false)
      }
    },
    onSpeechChange: (speaking) => {
      setIsSpeaking(speaking)
    },
  }).catch(() => {
    setVoiceEnabled(false)
  })

  return () => {
    WhisperService.stop()
  }
}, [voiceEnabled, exerciseType])
```

Add a new event listener for letter mode voice answers (near the existing voiceDirection listener):
```typescript
// Listen for voice letter events (letter chart mode)
useEffect(() => {
  const handleVoiceLetter = (e: Event) => {
    const letter = (e as CustomEvent).detail as string
    if (letter && exerciseType === 'letters') {
      handleLineByLineAnswer(letter)
    }
  }
  window.addEventListener('voiceLetter', handleVoiceLetter)
  return () => window.removeEventListener('voiceLetter', handleVoiceLetter)
})
```

Update the voice button UI to work for BOTH exercise types (currently gated to e-directional only). Find the voice control button section and:
- Remove the `exerciseType === 'e-directional'` guard so the mic button shows for both modes
- Update the status text to show loading/speaking state:

```typescript
{/* Voice control — works for both E-directional and letter modes */}
<button
  onClick={() => setVoiceEnabled(!voiceEnabled)}
  className={`p-2 rounded-lg transition-all ${
    voiceEnabled
      ? isSpeaking
        ? 'bg-green-600 text-white animate-pulse'
        : 'bg-primary-600 text-white'
      : 'bg-gray-700 text-gray-400 hover:text-white'
  }`}
  title={voiceEnabled ? 'Voice ON (tap to disable)' : 'Voice OFF (tap to enable)'}
>
  {voiceEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
</button>
{voiceEnabled && (
  <span className="text-xs text-gray-400">
    {voiceStatus === 'loading' ? 'Loading model...' :
     isSpeaking ? '🔴 Hearing...' :
     lastHeard ? `Heard: "${lastHeard}"` :
     exerciseType === 'e-directional' ? 'Say up/down/left/right' : 'Say the letter name'}
  </span>
)}
```

**Step 2: Commit**

```bash
git add src/components/Vision/Training/SnellenChart.tsx
git commit -m "feat: replace Web Speech API with Whisper in SnellenChart

Voice recognition now uses Transformers.js Whisper running in a Web Worker.
Supports both E-directional (up/down/left/right) and letter (A-Z) modes.
~300-500ms latency, works across all browsers."
```

---

### Task 7: Integrate into BinocularChart.tsx

Add voice support to binocular training (currently has none).

**Files:**
- Modify: `src/components/Vision/Training/BinocularChart.tsx`

**Step 1: Add voice support**

Add import at top:
```typescript
import { WhisperService, type WhisperStatus } from '@/lib/speech'
import { Mic, MicOff } from 'lucide-react'
```
(Add `Mic, MicOff` to the existing lucide-react import)

Add new props to the interface:
```typescript
interface BinocularChartProps {
  // ... existing props ...
  voiceEnabled?: boolean
}
```

Add voice state inside the component (after existing state):
```typescript
const [localVoiceEnabled, setLocalVoiceEnabled] = useState(false)
const [voiceStatus, setVoiceStatus] = useState<WhisperStatus>('idle')
const [isSpeaking, setIsSpeaking] = useState(false)
const [lastHeard, setLastHeard] = useState('')
```

Add the voice control useEffect:
```typescript
// Whisper voice recognition for binocular mode
useEffect(() => {
  if (!localVoiceEnabled) {
    WhisperService.stop()
    setIsSpeaking(false)
    setLastHeard('')
    return
  }

  const mode = exerciseType === 'e-directional' ? 'e-directional' : 'letters'

  WhisperService.start(mode, {
    onResult: (answer, rawTranscript) => {
      setLastHeard(rawTranscript.trim().split(/\s+/).pop() || '')
      if (!answer) return
      if (answer.type === 'direction') {
        handleAnswer(answer.value)
      } else if (answer.type === 'letter') {
        handleAnswer(answer.value)
      }
    },
    onStatusChange: (status) => {
      setVoiceStatus(status)
      if (status === 'error') setLocalVoiceEnabled(false)
    },
    onSpeechChange: (speaking) => {
      setIsSpeaking(speaking)
    },
  }).catch(() => {
    setLocalVoiceEnabled(false)
  })

  return () => { WhisperService.stop() }
}, [localVoiceEnabled, exerciseType, handleAnswer])
```

Add a mic toggle button in the zoom control bar (next to the zoom buttons):
```typescript
{/* Voice toggle */}
<button
  onClick={() => setLocalVoiceEnabled(v => !v)}
  className={`p-1 rounded transition-all ${
    localVoiceEnabled
      ? isSpeaking ? 'bg-green-600 text-white animate-pulse' : 'bg-primary-600 text-white'
      : 'bg-gray-700/50 text-gray-400 hover:text-white'
  }`}
  title={localVoiceEnabled ? 'Voice ON' : 'Voice OFF'}
>
  {localVoiceEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
</button>
{localVoiceEnabled && lastHeard && (
  <span className="text-gray-500 text-xs">"{lastHeard}"</span>
)}
```

**Step 2: Commit**

```bash
git add src/components/Vision/Training/BinocularChart.tsx
git commit -m "feat: add Whisper voice recognition to BinocularChart

Binocular training now supports voice input for both E-directional
and letter modes. Voice answers are called directly (no event dispatch
needed since BinocularChart handles its own answer logic)."
```

---

### Task 8: Next.js webpack config for Web Worker

Next.js needs to know how to bundle the worker file.

**Files:**
- Modify: `next.config.ts`

**Step 1: Read current config and add worker support**

Read `next.config.ts` first. Then add webpack config to handle `.worker.ts` files if not already present. The `new Worker(new URL('./file.ts', import.meta.url))` pattern should work with Next.js webpack 5 by default, but we may need to add the `onnxruntime-web` WASM files to the public directory or configure webpack to serve them.

Add to `next.config.ts` if needed:
```typescript
webpack: (config, { isServer }) => {
  if (!isServer) {
    // Ensure ONNX Runtime WASM files are served correctly
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    }
  }
  return config
},
```

**Step 2: Verify build**

Run:
```bash
npx tsc --noEmit
npm run build
```
Expected: No errors. The `/vision-training` page builds successfully.

**Step 3: Commit**

```bash
git add next.config.ts
git commit -m "chore: configure webpack for Whisper Web Worker and ONNX Runtime"
```

---

### Task 9: End-to-end verification

**Step 1: Build check**

Run:
```bash
npm run build
```
Expected: Build passes with no errors.

**Step 2: Manual test checklist**

Open `http://localhost:3000/vision-training` and verify:

1. **Model preload**: Open Focus Training tab → check browser DevTools Network tab → Whisper model files should start downloading in background
2. **E-directional voice (SnellenChart)**: Start non-binocular training → tap mic → say "up" → chart should register the answer within ~500ms
3. **Letter voice (SnellenChart)**: Switch to ABC chart type → start training → tap mic → say "M" → chart should register letter answer
4. **E-directional voice (BinocularChart)**: Select binocular mode → start training → tap mic in zoom bar → say "right" → chart registers
5. **Letter voice (BinocularChart)**: Switch to ABC + binocular → start → tap mic → say letter → registers
6. **Fallback**: If model fails to load, mic button should disable gracefully (no crash)
7. **Performance**: Main thread stays responsive during inference (no jank)

**Step 3: Push to deploy**

```bash
git push
```

Vercel auto-deploys. Test on production after ~4 minutes with Ctrl+Shift+R hard refresh.
