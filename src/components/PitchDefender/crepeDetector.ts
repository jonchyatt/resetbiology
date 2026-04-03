// CREPE Pitch Detection — TensorFlow.js browser inference
// Based on: https://github.com/marl/crepe (Jong Wook Kim et al., ICASSP 2018)
// Model: "tiny" capacity (~2MB) from the official gh-pages demo

import * as tf from '@tensorflow/tfjs'

const MODEL_URL = '/models/crepe/model.json'
const SAMPLE_RATE = 16000       // CREPE expects 16kHz audio
const FRAME_SIZE = 1024         // 1024 samples @ 16kHz = 64ms
const CENT_OFFSET = 1997.3794   // cents value of bin 0 (~32.7 Hz = C1)
const CENTS_PER_BIN = 20        // 360 bins × 20 cents = 7200 cents (6 octaves)

let _model: tf.LayersModel | null = null
let _loading = false

export async function loadCrepeModel(): Promise<void> {
  if (_model || _loading) return
  _loading = true
  try {
    _model = await tf.loadLayersModel(MODEL_URL)
    // Warm up — first inference is always slower (shader compilation)
    const dummy = tf.zeros([1, FRAME_SIZE])
    const out = _model.predict(dummy) as tf.Tensor
    out.dispose()
    dummy.dispose()
  } finally {
    _loading = false
  }
}

export function isModelLoaded(): boolean { return _model !== null }
export function isModelLoading(): boolean { return _loading }

export interface CrepeResult {
  frequency: number     // Hz
  note: string          // nearest note name (e.g. "A4")
  cents: number         // deviation from nearest note (-50 to +50)
  confidence: number    // 0-1 (voicing probability)
  latencyMs: number     // wall-clock inference time
}

// ─── Resampling ─────────────────────────────────────────────────────────────

function resampleLinear(buf: Float32Array, srcRate: number): Float32Array {
  if (srcRate === SAMPLE_RATE) return buf.slice(0, FRAME_SIZE)
  const ratio = srcRate / SAMPLE_RATE
  const outLen = Math.ceil(buf.length / ratio)
  const out = new Float32Array(Math.max(outLen, FRAME_SIZE))
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio
    const lo = Math.floor(srcIdx)
    const hi = Math.min(lo + 1, buf.length - 1)
    const frac = srcIdx - lo
    out[i] = buf[lo] * (1 - frac) + buf[hi] * frac
  }
  return out
}

// ─── Note lookup ────────────────────────────────────────────────────────────

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

export function detectPitchCrepe(audioBuffer: Float32Array, sampleRate: number): CrepeResult | null {
  if (!_model) return null

  const t0 = performance.now()

  // Resample to 16kHz and take 1024 samples
  const resampled = resampleLinear(audioBuffer, sampleRate)
  const frame = resampled.slice(0, FRAME_SIZE)

  // Extract values via closure — tf.tidy only handles tensor disposal
  let frequency = 0
  let confidence = 0
  let silent = false

  tf.tidy(() => {
    const tensor = tf.tensor1d(frame)
    const mean = tensor.mean()
    const centered = tensor.sub(mean)
    const norm = centered.norm()
    const std = norm.div(tf.scalar(Math.sqrt(FRAME_SIZE)))
    const stdVal = std.dataSync()[0]

    if (stdVal < 1e-6) { silent = true; return }

    const normalized = centered.div(std)
    const input = normalized.reshape([1, FRAME_SIZE])

    // Model prediction → 360 pitch bins
    const activation = (_model!.predict(input) as tf.Tensor).reshape([360])
    const data = activation.dataSync() as Float32Array

    // Confidence = max activation
    let maxVal = -Infinity
    let maxIdx = 0
    for (let i = 0; i < 360; i++) {
      if (data[i] > maxVal) { maxVal = data[i]; maxIdx = i }
    }

    // Weighted average around peak for sub-bin precision
    const lo = Math.max(0, maxIdx - 4)
    const hi = Math.min(360, maxIdx + 5)
    let wSum = 0, wTotal = 0
    for (let i = lo; i < hi; i++) {
      wSum += data[i] * i
      wTotal += data[i]
    }
    const bin = wTotal > 0 ? wSum / wTotal : maxIdx

    // Bin → cents → Hz
    const absCents = CENT_OFFSET + bin * CENTS_PER_BIN
    frequency = 10 * Math.pow(2, absCents / 1200)
    confidence = maxVal
  })

  const latencyMs = performance.now() - t0
  if (silent || frequency === 0) return null

  const noteInfo = freqToNote(frequency)
  return { frequency, note: noteInfo.name, cents: noteInfo.cents, confidence, latencyMs }
}
