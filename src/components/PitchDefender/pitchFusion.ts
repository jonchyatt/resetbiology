// ═══════════════════════════════════════════════════════════════════════════════
// PitchFusion — Multi-Detector Pitch Detection Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Architecture: Run pitchy (autocorrelation) every frame for instant feedback.
// Run CREPE (CNN) every Nth frame for accuracy. Fuse via confidence-weighted
// blend. Smooth with Viterbi-inspired octave correction and vibrato detection.
//
// Single output stream drives both visual rendering AND scoring.
// Adaptive scheduling: skips ML inference when frame budget is tight.
//
// Designed to add PESTO as a third detector via the Detector interface.
// ═══════════════════════════════════════════════════════════════════════════════

import { PitchDetector } from 'pitchy'
import { detectPitchCrepe, loadCrepeModel, isModelLoaded } from './crepeDetector'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FusedPitch {
  note: string            // nearest note name (e.g. "A4")
  frequency: number       // Hz (fused, smoothed)
  cents: number           // deviation from nearest note (-50 to +50)
  confidence: number      // 0-1 (combined confidence)
  isActive: boolean       // true when a clear pitch is detected
  isSettled: boolean      // true when onset is complete (pitch has stabilized)
  isVibrato: boolean      // true when intentional vibrato detected
  staffPosition: number   // continuous position on staff (for rendering)
  source: 'pitchy' | 'ml' | 'fused' | 'none'
}

export interface FusionConfig {
  enableML: boolean          // whether to run CREPE/PESTO (set false during Star Nest phases)
  mlEveryNFrames: number     // run ML every N frames (default 3)
  onsetVarianceThreshold: number  // cents² variance below which onset is "settled"
  vibratoMinHz: number       // min vibrato rate to detect (default 4)
  vibratoMaxHz: number       // max vibrato rate to detect (default 8)
  octaveTolerant: boolean    // if true, C3 = C4 for scoring (beginner mode)
  noiseGateDb: number        // dBFS noise gate threshold
}

export const DEFAULT_FUSION_CONFIG: FusionConfig = {
  enableML: true,
  mlEveryNFrames: 3,
  onsetVarianceThreshold: 100,  // ~10 cents std dev
  vibratoMinHz: 4,
  vibratoMaxHz: 8,
  octaveTolerant: false,
  noiseGateDb: -40,
}

// ─── Note Lookup ────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NOTE_FREQS: [string, number][] = []
for (let oct = 2; oct <= 6; oct++) {
  for (let i = 0; i < 12; i++) {
    NOTE_FREQS.push([`${NOTE_NAMES[i]}${oct}`, 440 * Math.pow(2, (oct - 4) + (i - 9) / 12)])
  }
}

function freqToNote(freq: number): { name: string; cents: number; midiish: number } {
  let minDist = Infinity, nearest = 'C4', nearestFreq = 261.63
  for (const [name, f] of NOTE_FREQS) {
    const d = Math.abs(1200 * Math.log2(freq / f))
    if (d < minDist) { minDist = d; nearest = name; nearestFreq = f }
  }
  const cents = Math.round(1200 * Math.log2(freq / nearestFreq))
  // Continuous "staff position" — semitones from C4 (middle C)
  const midiish = 12 * Math.log2(freq / 261.63)
  return { name: nearest, cents, midiish }
}

// Staff position: maps a frequency to a continuous vertical position on the staff
// 0 = middle C (C4), each integer = one semitone
// Treble staff lines: E4(4), G4(7), B4(11), D5(14), F5(17)
// Bass staff lines: G2(-17), B2(-14), D3(-10), F3(-7), A3(-3)
export function freqToStaffPosition(freq: number): number {
  return 12 * Math.log2(freq / 261.63) // semitones from C4
}

// ─── Vibrato Detector ───────────────────────────────────────────────────────

class VibratoDetector {
  private history: number[] = []       // recent cent deviations
  private readonly maxLen = 30         // ~500ms at 60fps
  private readonly sampleRate = 60     // approximate fps

  push(cents: number) {
    this.history.push(cents)
    if (this.history.length > this.maxLen) this.history.shift()
  }

  reset() { this.history.length = 0 }

  // Detect periodic oscillation in the 4-8Hz range
  detect(minHz: number, maxHz: number): boolean {
    if (this.history.length < 15) return false

    // Count zero-crossings of the deviation (relative to mean)
    const mean = this.history.reduce((s, v) => s + v, 0) / this.history.length
    let crossings = 0
    for (let i = 1; i < this.history.length; i++) {
      if ((this.history[i - 1] - mean) * (this.history[i] - mean) < 0) crossings++
    }

    // Zero-crossing rate → frequency
    const durationSec = this.history.length / this.sampleRate
    const oscFreq = crossings / (2 * durationSec)

    // Also check amplitude is meaningful (not just noise)
    const maxDev = Math.max(...this.history.map(v => Math.abs(v - mean)))

    return oscFreq >= minHz && oscFreq <= maxHz && maxDev > 10 && maxDev < 80
  }

  // Get the center pitch (mean) when vibrato is detected
  get centerCents(): number {
    if (this.history.length === 0) return 0
    return this.history.reduce((s, v) => s + v, 0) / this.history.length
  }
}

// ─── Onset Detector ─────────────────────────────────────────────────────────

class OnsetDetector {
  private window: number[] = []
  private readonly windowSize = 6  // ~100ms at 60fps
  private settled = false

  push(cents: number) {
    this.window.push(cents)
    if (this.window.length > this.windowSize) this.window.shift()
  }

  reset() { this.window.length = 0; this.settled = false }

  // Check if pitch has settled (low variance = stable pitch)
  isSettled(threshold: number): boolean {
    if (this.window.length < 3) return false
    if (this.settled) return true

    const mean = this.window.reduce((s, v) => s + v, 0) / this.window.length
    const variance = this.window.reduce((s, v) => s + (v - mean) ** 2, 0) / this.window.length

    if (variance < threshold) {
      this.settled = true
    }
    return this.settled
  }
}

// ─── Viterbi-Inspired Octave Smoother ───────────────────────────────────────

class OctaveSmoother {
  private lastFreq = 0
  private lastNote = ''

  // Penalize octave jumps: if the new frequency is exactly 2x or 0.5x the last,
  // and confidence isn't dramatically higher, keep the previous octave
  smooth(freq: number, note: string, confidence: number): { freq: number; note: string } {
    if (this.lastFreq === 0) {
      this.lastFreq = freq
      this.lastNote = note
      return { freq, note }
    }

    const ratio = freq / this.lastFreq
    const noteName = note.replace(/\d+$/, '')
    const lastNoteName = this.lastNote.replace(/\d+$/, '')

    // Suspicious jumps: octaves (2x), fifths (1.5x), sub-octave (0.5x)
    const isOctaveJump = (ratio > 1.8 && ratio < 2.2) || (ratio > 0.45 && ratio < 0.55)
    const isFifthJump = (ratio > 1.45 && ratio < 1.55) || (ratio > 0.64 && ratio < 0.7)
    if ((isOctaveJump || isFifthJump) && confidence < 0.95) {
      return { freq: this.lastFreq, note: this.lastNote }
    }

    this.lastFreq = freq
    this.lastNote = note
    return { freq, note }
  }

  reset() { this.lastFreq = 0; this.lastNote = '' }
}

// ─── PitchFusion Engine ─────────────────────────────────────────────────────

export class PitchFusion {
  private config: FusionConfig
  private analyser: AnalyserNode | null = null
  private audioCtx: AudioContext | null = null
  private stream: MediaStream | null = null
  private pitchyDetector: PitchDetector<Float32Array> | null = null
  private buffer: Float32Array<ArrayBuffer> | null = null
  private running = false
  private rafId = 0
  private frameCount = 0

  // ML state
  private mlBusy = false
  private mlResult: { freq: number; note: string; cents: number; confidence: number; ts: number } | null = null
  private mlLoading = false
  private mlReady = false

  // Smoothing
  private vibrato = new VibratoDetector()
  private onset = new OnsetDetector()
  private octaveSmoother = new OctaveSmoother()

  // Frequency EMA
  private smoothedFreq = 0
  private readonly emaAlpha = 0.5  // faster than usePitchDetection (visual needs responsiveness)

  // Callbacks
  private onPitch: ((pitch: FusedPitch) => void) | null = null
  private onError: ((err: string) => void) | null = null

  // Frame timing for adaptive scheduling
  private lastFrameTime = 0

  constructor(config?: Partial<FusionConfig>) {
    this.config = { ...DEFAULT_FUSION_CONFIG, ...config }
  }

  updateConfig(config: Partial<FusionConfig>) {
    this.config = { ...this.config, ...config }
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  async start(onPitch: (p: FusedPitch) => void, onError?: (err: string) => void): Promise<void> {
    this.onPitch = onPitch
    this.onError = onError ?? null

    try {
      // Start mic
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)

      this.audioCtx = ctx
      this.analyser = analyser
      this.stream = stream
      this.buffer = new Float32Array(analyser.fftSize)
      this.pitchyDetector = PitchDetector.forFloat32Array(analyser.fftSize)

      // Load ML model in background (non-blocking)
      if (this.config.enableML && !this.mlReady && !this.mlLoading) {
        this.mlLoading = true
        loadCrepeModel()
          .then(() => { this.mlReady = true; this.mlLoading = false })
          .catch(() => { this.mlLoading = false }) // graceful degradation
      }

      // Reset state
      this.smoothedFreq = 0
      this.vibrato.reset()
      this.onset.reset()
      this.octaveSmoother.reset()
      this.frameCount = 0
      this.mlResult = null
      this.lastFrameTime = performance.now()

      this.running = true
      this.tick()
    } catch (err) {
      this.onError?.(err instanceof Error ? err.message : 'Microphone access denied')
    }
  }

  stop() {
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.stream?.getTracks().forEach(t => t.stop())
    this.audioCtx?.close()
    this.analyser = null
    this.audioCtx = null
    this.stream = null
    this.pitchyDetector = null
    this.buffer = null
    this.onPitch = null
    this.onError = null
    this.mlResult = null
  }

  get isRunning(): boolean { return this.running }
  get isMLReady(): boolean { return this.mlReady }

  // ─── Main Loop ──────────────────────────────────────────────────────────

  private tick = () => {
    if (!this.running) return

    const now = performance.now()
    const frameDelta = now - this.lastFrameTime
    this.lastFrameTime = now
    this.frameCount++

    if (!this.analyser || !this.pitchyDetector || !this.buffer || !this.audioCtx) {
      this.rafId = requestAnimationFrame(this.tick)
      return
    }

    this.analyser.getFloatTimeDomainData(this.buffer)

    // ─── Echo suppression ──────────────────────────────────────────────
    // Browser AEC handles speakers vs mic well, but laptop speakers + no
    // headphones still leak generated piano tones into the mic, causing
    // false-positive matches. Skip pitch detection briefly after a tone.
    if (typeof window !== 'undefined') {
      const last = (window as any).__pdLastToneAt as number | undefined
      const span = (window as any).__pdToneSuppressMs as number | undefined
      if (last && span && performance.now() - last < span) {
        this.smoothedFreq = 0
        this.emitSilence()
        this.rafId = requestAnimationFrame(this.tick)
        return
      }
    }

    // ─── Noise gate ───────────────────────────────────────────────────
    let sumSq = 0
    for (let i = 0; i < this.buffer.length; i++) sumSq += this.buffer[i] * this.buffer[i]
    const rms = Math.sqrt(sumSq / this.buffer.length)
    const dbFS = 20 * Math.log10(rms + 1e-10)

    if (dbFS < this.config.noiseGateDb) {
      this.smoothedFreq = 0
      this.vibrato.reset()
      this.onset.reset()
      this.emitSilence()
      this.rafId = requestAnimationFrame(this.tick)
      return
    }

    // ─── pitchy (every frame) ─────────────────────────────────────────
    const [pitchyFreq, pitchyClarity] = this.pitchyDetector.findPitch(
      this.buffer, this.audioCtx.sampleRate
    )

    let pitchyValid = pitchyClarity > 0.8 && pitchyFreq > 55 && pitchyFreq < 2000
    let pitchyConf = pitchyValid ? pitchyClarity : 0

    // ─── ML (every Nth frame, adaptive) ───────────────────────────────
    const shouldRunML =
      this.config.enableML &&
      this.mlReady &&
      !this.mlBusy &&
      this.frameCount % this.config.mlEveryNFrames === 0 &&
      frameDelta < 20  // skip if frame budget is tight (adaptive)

    // Note: detectPitchCrepe is SYNCHRONOUS (tf.tidy blocks). Both detectors
    // process the exact same audio buffer in the same frame — no temporal skew.
    // If PESTO is added with async inference, results must be frame-tagged.
    if (shouldRunML) {
      this.mlBusy = true
      const result = detectPitchCrepe(this.buffer, this.audioCtx.sampleRate)
      this.mlBusy = false

      if (result && result.confidence > 0.5) {
        this.mlResult = {
          freq: result.frequency,
          note: result.note,
          cents: result.cents,
          confidence: result.confidence,
          ts: now,
        }
      }
    }

    // ─── Fusion ───────────────────────────────────────────────────────
    let fusedFreq: number
    let fusedConf: number
    let source: FusedPitch['source']

    // ML result is "fresh" if less than 150ms old
    const mlFresh = this.mlResult && (now - this.mlResult.ts < 150)
    const mlConf = mlFresh ? this.mlResult!.confidence : 0
    const mlFreq = mlFresh ? this.mlResult!.freq : 0

    if (pitchyValid && mlFresh && mlConf > 0) {
      // Both available — confidence-weighted blend
      // Calibrate: pitchy clarity (0-1) and CREPE confidence (0-1) have different scales
      // pitchy clarity > 0.9 is "good", CREPE confidence > 0.8 is "good"
      // Normalize both to a common scale
      const pWeight = Math.pow(pitchyConf, 2)     // square to emphasize high confidence
      const mWeight = Math.pow(mlConf, 1.5)        // slightly less aggressive
      const totalWeight = pWeight + mWeight

      // Check for harmonic disagreement before blending
      const ratio = mlFreq / pitchyFreq
      const semitoneDiff = Math.abs(12 * Math.log2(mlFreq / pitchyFreq))

      if (ratio > 1.8 && ratio < 2.2) {
        // Octave above — harmonic confusion, trust pitchy (autocorrelation nails fundamental)
        fusedFreq = pitchyFreq
        fusedConf = pitchyConf * 0.8
        source = 'pitchy'
      } else if (ratio > 0.45 && ratio < 0.55) {
        // Octave below — trust pitchy
        fusedFreq = pitchyFreq
        fusedConf = pitchyConf * 0.8
        source = 'pitchy'
      } else if (ratio > 1.4 && ratio < 1.6) {
        // Perfect fifth (3:2) — common autocorrelation error, trust ML
        fusedFreq = mlFreq
        fusedConf = mlConf * 0.8
        source = 'ml'
      } else if (ratio > 2.8 && ratio < 3.2) {
        // 3x harmonic — trust pitchy
        fusedFreq = pitchyFreq
        fusedConf = pitchyConf * 0.7
        source = 'pitchy'
      } else if (semitoneDiff > 2) {
        // Detectors disagree by more than 2 semitones — DON'T blend (geometric
        // mean of unrelated pitches is meaningless). Pick higher confidence.
        if (mlConf > pitchyConf) {
          fusedFreq = mlFreq; fusedConf = mlConf * 0.7; source = 'ml'
        } else {
          fusedFreq = pitchyFreq; fusedConf = pitchyConf * 0.7; source = 'pitchy'
        }
      } else {
        // Agreement within 2 semitones — safe to blend in log space
        const logP = Math.log2(pitchyFreq)
        const logM = Math.log2(mlFreq)
        const logFused = (pWeight * logP + mWeight * logM) / totalWeight
        fusedFreq = Math.pow(2, logFused)
        fusedConf = Math.min(1, (pWeight + mWeight) / 2)
        source = 'fused'
      }
    } else if (pitchyValid) {
      // pitchy only
      fusedFreq = pitchyFreq
      fusedConf = pitchyConf
      source = 'pitchy'
    } else if (mlFresh && mlConf > 0) {
      // ML only
      fusedFreq = mlFreq
      fusedConf = mlConf
      source = 'ml'
    } else {
      // Nothing
      this.smoothedFreq = 0
      this.vibrato.reset()
      this.onset.reset()
      this.emitSilence()
      this.rafId = requestAnimationFrame(this.tick)
      return
    }

    // ─── EMA Smoothing ────────────────────────────────────────────────
    if (this.smoothedFreq === 0) {
      this.smoothedFreq = fusedFreq
    } else {
      // Smooth in log space (musical intervals are logarithmic)
      const logSmoothed = Math.log2(this.smoothedFreq)
      const logNew = Math.log2(fusedFreq)
      this.smoothedFreq = Math.pow(2, this.emaAlpha * logNew + (1 - this.emaAlpha) * logSmoothed)
    }

    // ─── Note lookup ──────────────────────────────────────────────────
    const noteInfo = freqToNote(this.smoothedFreq)

    // ─── Octave smoothing ─────────────────────────────────────────────
    const smoothed = this.octaveSmoother.smooth(this.smoothedFreq, noteInfo.name, fusedConf)
    const finalNote = smoothed.note
    const finalFreq = smoothed.freq
    const finalNoteInfo = finalNote === noteInfo.name ? noteInfo : freqToNote(finalFreq)

    // ─── Vibrato detection ────────────────────────────────────────────
    this.vibrato.push(finalNoteInfo.cents)
    const isVibrato = this.vibrato.detect(this.config.vibratoMinHz, this.config.vibratoMaxHz)

    // ─── Onset detection ──────────────────────────────────────────────
    this.onset.push(finalNoteInfo.cents)
    const isSettled = this.onset.isSettled(this.config.onsetVarianceThreshold)

    // ─── Staff position ───────────────────────────────────────────────
    const staffPos = freqToStaffPosition(finalFreq)

    // ─── Emit ─────────────────────────────────────────────────────────
    this.onPitch?.({
      note: finalNote,
      frequency: finalFreq,
      cents: isVibrato ? Math.round(this.vibrato.centerCents) : finalNoteInfo.cents,
      confidence: fusedConf,
      isActive: true,
      isSettled,
      isVibrato,
      staffPosition: staffPos,
      source,
    })

    this.rafId = requestAnimationFrame(this.tick)
  }

  private emitSilence() {
    this.onPitch?.({
      note: '',
      frequency: 0,
      cents: 0,
      confidence: 0,
      isActive: false,
      isSettled: false,
      isVibrato: false,
      staffPosition: 0,
      source: 'none',
    })
  }
}
