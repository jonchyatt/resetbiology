// ═══════════════════════════════════════════════════════════════════════════════
// PESTO Pitch Detection — ONNX Runtime Web Browser Inference
// ═══════════════════════════════════════════════════════════════════════════════
//
// PESTO (Pitch Estimation with Self-supervised Transposition-equivariant
// Objective) — Sony CSL Paris, 2023-2025.
//
// 130K parameters, <10ms inference, 92%+ accuracy. Exported to ONNX with
// CQT preprocessing baked in — takes raw audio, outputs pitch + confidence.
//
// Model: mir-1k_g7 checkpoint, patched for ONNX (view_as_complex → manual mag)
// ═══════════════════════════════════════════════════════════════════════════════

import * as ort from 'onnxruntime-web'

const MODEL_URL = '/models/pesto/pesto-mir1k-g7.onnx'
const MODEL_SAMPLE_RATE = 16000  // PESTO expects 16kHz

let _session: ort.InferenceSession | null = null
let _loading = false

// ─── Model Lifecycle ────────────────────────────────────────────────────────

export async function loadPestoModel(): Promise<void> {
  if (_session || _loading) return
  _loading = true
  try {
    // Prefer WASM backend (CPU) — avoids GPU contention with game visuals
    ort.env.wasm.numThreads = 1
    _session = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
    })

    // Warm up — first inference compiles WASM
    const warmup = new ort.Tensor('float32', new Float32Array(4096), [1, 4096])
    await _session.run({ audio: warmup })
  } catch (err) {
    console.error('PESTO model load failed:', err)
    _session = null
  } finally {
    _loading = false
  }
}

export function isPestoLoaded(): boolean { return _session !== null }
export function isPestoLoading(): boolean { return _loading }

// ─── Resampling ─────────────────────────────────────────────────────────────

function resampleLinear(buf: Float32Array, srcRate: number, targetRate: number): Float32Array {
  if (srcRate === targetRate) return buf
  const ratio = srcRate / targetRate
  const outLen = Math.ceil(buf.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio
    const lo = Math.floor(srcIdx)
    const hi = Math.min(lo + 1, buf.length - 1)
    const frac = srcIdx - lo
    out[i] = buf[lo] * (1 - frac) + buf[hi] * frac
  }
  return out
}

// ─── Note Lookup ────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function freqToNote(freq: number): { name: string; cents: number } {
  const semitone = 12 * Math.log2(freq / 440) + 69
  const rounded = Math.round(semitone)
  const cents = Math.round((semitone - rounded) * 100)
  const octave = Math.floor(rounded / 12) - 1
  const noteIdx = ((rounded % 12) + 12) % 12
  return { name: `${NOTE_NAMES[noteIdx]}${octave}`, cents }
}

// ─── Inference ──────────────────────────────────────────────────────────────

export interface PestoResult {
  frequency: number     // Hz
  note: string          // nearest note name
  cents: number         // deviation from nearest note (-50 to +50)
  confidence: number    // 0-1
  latencyMs: number     // wall-clock inference time
}

export async function detectPitchPesto(
  audioBuffer: Float32Array,
  sampleRate: number,
): Promise<PestoResult | null> {
  if (!_session) return null

  const t0 = performance.now()

  // Resample to 16kHz
  const resampled = resampleLinear(audioBuffer, sampleRate, MODEL_SAMPLE_RATE)

  // Need at least ~2048 samples for meaningful output
  if (resampled.length < 1024) return null

  // Create input tensor
  const inputTensor = new ort.Tensor('float32', resampled, [1, resampled.length])

  try {
    const results = await _session.run({ audio: inputTensor })

    const pitchData = results.pitch.data as Float32Array
    const confData = results.confidence.data as Float32Array

    // Take the LAST frame (most recent audio)
    const numFrames = pitchData.length
    if (numFrames === 0) return null

    const lastIdx = numFrames - 1
    const frequency = pitchData[lastIdx]
    const confidence = confData[lastIdx]

    // Filter: frequency must be in vocal range, confidence must be meaningful
    if (frequency < 55 || frequency > 2000 || confidence < 0.3) {
      return null
    }

    const latencyMs = performance.now() - t0
    const noteInfo = freqToNote(frequency)

    return {
      frequency,
      note: noteInfo.name,
      cents: noteInfo.cents,
      confidence,
      latencyMs,
    }
  } catch (err) {
    console.error('PESTO inference error:', err)
    return null
  }
}
