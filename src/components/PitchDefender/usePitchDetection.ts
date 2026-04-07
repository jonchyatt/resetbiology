'use client'

// Pitch Defender — Microphone Pitch Detection Hook
// Tier 1 optimizations: noise gate, EMA smoothing, note hysteresis

import { useRef, useState, useCallback, useEffect } from 'react'
import { PitchDetector } from 'pitchy'

// ─���─ Detection Constants ────────────────────────────────────────────────────
// Noise gate: -40dB is good for most mics. Cheap mics / quiet children may need
// -50dB (more permissive). Configurable via hook options.
const DEFAULT_NOISE_GATE_DB = -40
const EMA_ALPHA = 0.4           // Smoothing factor (0–1; higher = more responsive)
// Hysteresis: 3 frames at 60fps = ~50ms. Prevents note flickering without
// adding perceptible lag for the 600ms hold-to-fire mechanic in Echo Cannon.
const HYSTERESIS_FRAMES = 3
const MIN_CONFIDENCE = 0.85     // pitchy clarity threshold
const MIN_FREQ = 60             // Hz — below this is rumble/noise
const MAX_FREQ = 2000           // Hz — above this is noise/harmonics

// Note frequencies for octaves 2-6 (covers child and adult vocal ranges)
const NOTE_FREQS: [string, number][] = []
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
for (let octave = 2; octave <= 6; octave++) {
  for (let i = 0; i < 12; i++) {
    const freq = 440 * Math.pow(2, (octave - 4) + (i - 9) / 12)
    const name = `${NOTE_NAMES[i]}${octave}`
    NOTE_FREQS.push([name, freq])
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PitchInfo {
  note: string          // Nearest note name (e.g., "C4", "A3")
  frequency: number     // Smoothed frequency in Hz
  cents: number         // Cents deviation from nearest note (-50 to +50)
  confidence: number    // Detection confidence (0-1)
  isActive: boolean     // Whether mic is detecting stable, meaningful input
}

export interface PitchDetectionState {
  isListening: boolean
  pitch: PitchInfo | null
  error: string | null
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface PitchDetectionOptions {
  noiseGateDb?: number  // dBFS threshold (default -40; use -50 for cheap mics / quiet singers)
}

export function usePitchDetection(options?: PitchDetectionOptions) {
  // Use ref so the analyze loop always reads the latest threshold even if options change
  const noiseGateRef = useRef(options?.noiseGateDb ?? DEFAULT_NOISE_GATE_DB)
  noiseGateRef.current = options?.noiseGateDb ?? DEFAULT_NOISE_GATE_DB
  const [state, setState] = useState<PitchDetectionState>({
    isListening: false,
    pitch: null,
    error: null,
  })

  // Audio pipeline refs
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const detectorRef = useRef<PitchDetector<Float32Array> | null>(null)
  const pitchRef = useRef<PitchInfo | null>(null)

  // Smoothing & hysteresis state
  const smoothedFreqRef = useRef(0)
  const consecutiveRef = useRef({ note: '', count: 0 })
  const lastStableNoteRef = useRef('')

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })

      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048

      source.connect(analyser)

      audioCtxRef.current = ctx
      analyserRef.current = analyser
      streamRef.current = stream
      detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize)

      // Reset smoothing state
      smoothedFreqRef.current = 0
      consecutiveRef.current = { note: '', count: 0 }
      lastStableNoteRef.current = ''

      setState({ isListening: true, pitch: null, error: null })

      const buffer = new Float32Array(analyser.fftSize)

      function analyze() {
        if (!analyserRef.current || !detectorRef.current) return

        analyserRef.current.getFloatTimeDomainData(buffer)

        // ─── ECHO SUPPRESSION ──────────────────────────────────────
        // Skip detection briefly after audioEngine plays a piano tone, so
        // speaker bleed doesn't get reported as a singing match.
        if (typeof window !== 'undefined') {
          const last = (window as any).__pdLastToneAt as number | undefined
          const span = (window as any).__pdToneSuppressMs as number | undefined
          if (last && span && performance.now() - last < span) {
            const info: PitchInfo = {
              note: lastStableNoteRef.current,
              frequency: 0,
              cents: 0,
              confidence: 0,
              isActive: false,
            }
            pitchRef.current = info
            setState(prev => ({ ...prev, pitch: info }))
            rafRef.current = requestAnimationFrame(analyze)
            return
          }
        }

        // ─── NOISE GATE: compute RMS, reject quiet signals ──────────
        let sumSq = 0
        for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i]
        const rms = Math.sqrt(sumSq / buffer.length)
        const dbFS = 20 * Math.log10(rms + 1e-10)

        if (dbFS < noiseGateRef.current) {
          // Below noise floor — silence
          smoothedFreqRef.current = 0
          consecutiveRef.current = { note: '', count: 0 }
          const info: PitchInfo = {
            note: lastStableNoteRef.current,
            frequency: 0,
            cents: 0,
            confidence: 0,
            isActive: false,
          }
          pitchRef.current = info
          setState(prev => ({ ...prev, pitch: info }))
          rafRef.current = requestAnimationFrame(analyze)
          return
        }

        // ─── PITCH DETECTION ────────────────────────────────────────
        const [rawFrequency, clarity] = detectorRef.current.findPitch(buffer, ctx.sampleRate)

        if (clarity > MIN_CONFIDENCE && rawFrequency > MIN_FREQ && rawFrequency < MAX_FREQ) {
          // ─── EMA SMOOTHING ──────────────────────────────────────
          const smoothedFreq = smoothedFreqRef.current === 0
            ? rawFrequency
            : EMA_ALPHA * rawFrequency + (1 - EMA_ALPHA) * smoothedFreqRef.current
          smoothedFreqRef.current = smoothedFreq

          // ─── NEAREST NOTE LOOKUP (on smoothed frequency) ────────
          let minDist = Infinity
          let nearestNote = 'C4'
          let nearestFreq = 261.63

          for (const [name, freq] of NOTE_FREQS) {
            const dist = Math.abs(1200 * Math.log2(smoothedFreq / freq))
            if (dist < minDist) {
              minDist = dist
              nearestNote = name
              nearestFreq = freq
            }
          }

          const cents = 1200 * Math.log2(smoothedFreq / nearestFreq)

          // ─── HYSTERESIS: require N consecutive matching frames ──
          if (nearestNote === consecutiveRef.current.note) {
            consecutiveRef.current.count++
          } else {
            consecutiveRef.current = { note: nearestNote, count: 1 }
          }
          const isStable = consecutiveRef.current.count >= HYSTERESIS_FRAMES

          if (isStable) lastStableNoteRef.current = nearestNote

          const info: PitchInfo = {
            note: isStable ? nearestNote : (lastStableNoteRef.current || nearestNote),
            frequency: smoothedFreq,
            cents: Math.round(cents),
            confidence: clarity,
            isActive: isStable,
          }
          pitchRef.current = info
          setState(prev => ({ ...prev, pitch: info }))
        } else {
          // Low confidence — not a clear pitch
          consecutiveRef.current = { note: '', count: 0 }
          const info: PitchInfo = {
            note: lastStableNoteRef.current,
            frequency: 0,
            cents: 0,
            confidence: clarity,
            isActive: false,
          }
          pitchRef.current = info
          setState(prev => ({ ...prev, pitch: info }))
        }

        rafRef.current = requestAnimationFrame(analyze)
      }

      rafRef.current = requestAnimationFrame(analyze)
    } catch (err) {
      setState({
        isListening: false,
        pitch: null,
        error: err instanceof Error ? err.message : 'Microphone access denied',
      })
    }
  }, [])

  const stopListening = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    analyserRef.current = null
    detectorRef.current = null
    pitchRef.current = null
    smoothedFreqRef.current = 0
    consecutiveRef.current = { note: '', count: 0 }
    lastStableNoteRef.current = ''
    setState({ isListening: false, pitch: null, error: null })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (audioCtxRef.current) audioCtxRef.current.close()
    }
  }, [])

  return {
    ...state,
    pitchRef,
    startListening,
    stopListening,
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Check if a detected note matches a target note (octave-flexible for beginners)
export function notesMatch(
  detected: string,
  target: string,
  options: { octaveFlexible?: boolean; centsThreshold?: number } = {}
): boolean {
  const { octaveFlexible = false } = options

  if (octaveFlexible) {
    const detName = detected.replace(/\d+$/, '')
    const targName = target.replace(/\d+$/, '')
    return detName === targName
  }

  return detected === target
}
