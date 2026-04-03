'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { PitchDetector } from 'pitchy'

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

// Map sharp names to their enharmonic equivalents we use in the game
function normalizeNote(note: string): string {
  // We only use natural notes (no sharps/flats in the game)
  return note.replace('#', '#') // keep as-is for cent calculation
}

export interface PitchInfo {
  note: string          // Nearest note name (e.g., "C4", "A3")
  frequency: number     // Detected frequency in Hz
  cents: number         // Cents deviation from nearest note (-50 to +50)
  confidence: number    // Detection confidence (0-1)
  isActive: boolean     // Whether mic is detecting meaningful input
}

export interface PitchDetectionState {
  isListening: boolean
  pitch: PitchInfo | null
  error: string | null
}

export function usePitchDetection() {
  const [state, setState] = useState<PitchDetectionState>({
    isListening: false,
    pitch: null,
    error: null,
  })

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const detectorRef = useRef<PitchDetector<Float32Array> | null>(null)
  const pitchRef = useRef<PitchInfo | null>(null)

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

      setState({ isListening: true, pitch: null, error: null })

      // Start analysis loop
      const buffer = new Float32Array(analyser.fftSize)

      function analyze() {
        if (!analyserRef.current || !detectorRef.current) return

        analyserRef.current.getFloatTimeDomainData(buffer)
        const [frequency, clarity] = detectorRef.current.findPitch(buffer, ctx.sampleRate)

        if (clarity > 0.85 && frequency > 60 && frequency < 2000) {
          // Find nearest note
          let minDist = Infinity
          let nearestNote = 'C4'
          let nearestFreq = 261.63

          for (const [name, freq] of NOTE_FREQS) {
            const dist = Math.abs(1200 * Math.log2(frequency / freq))
            if (dist < minDist) {
              minDist = dist
              nearestNote = name
              nearestFreq = freq
            }
          }

          // Calculate cents deviation
          const cents = 1200 * Math.log2(frequency / nearestFreq)

          const info: PitchInfo = {
            note: nearestNote,
            frequency,
            cents: Math.round(cents),
            confidence: clarity,
            isActive: true,
          }
          pitchRef.current = info
          setState(prev => ({ ...prev, pitch: info }))
        } else {
          const info: PitchInfo = {
            note: pitchRef.current?.note ?? '',
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

// Helper: check if a detected note matches a target note (octave-flexible for beginners)
export function notesMatch(
  detected: string,
  target: string,
  options: { octaveFlexible?: boolean; centsThreshold?: number } = {}
): boolean {
  const { octaveFlexible = false, centsThreshold = 50 } = options

  if (octaveFlexible) {
    // Strip octave number for comparison
    const detName = detected.replace(/\d+$/, '')
    const targName = target.replace(/\d+$/, '')
    return detName === targName
  }

  return detected === target
}
