'use client'

// CREPE vs pitchy — Side-by-side pitch detection benchmark
// Feeds identical audio to both detectors and compares accuracy + latency

import { useState, useRef, useCallback, useEffect } from 'react'
import { PitchDetector } from 'pitchy'
import { loadCrepeModel, isModelLoaded, isModelLoading, detectPitchCrepe, type CrepeResult } from './crepeDetector'

// ─── Note lookup (same as usePitchDetection) ────────────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NOTE_FREQS: [string, number][] = []
for (let oct = 2; oct <= 6; oct++) {
  for (let i = 0; i < 12; i++) {
    NOTE_FREQS.push([`${NOTE_NAMES[i]}${oct}`, 440 * Math.pow(2, (oct - 4) + (i - 9) / 12)])
  }
}

function freqToNote(freq: number): { name: string; cents: number } {
  let minDist = Infinity, nearest = 'C4', nearestFreq = 261.63
  for (const [name, f] of NOTE_FREQS) {
    const d = Math.abs(1200 * Math.log2(freq / f))
    if (d < minDist) { minDist = d; nearest = name; nearestFreq = f }
  }
  return { name: nearest, cents: Math.round(1200 * Math.log2(freq / nearestFreq)) }
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface PitchyResult {
  note: string; frequency: number; cents: number; confidence: number; latencyMs: number
}

interface LogEntry {
  ts: number
  pitchy: PitchyResult | null
  crepe: CrepeResult | null
  agree: boolean
  testToneHz: number | null
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CrepeBenchmark() {
  const [modelState, setModelState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [micState, setMicState] = useState<'off' | 'starting' | 'on'>('off')
  const [pitchyResult, setPitchyResult] = useState<PitchyResult | null>(null)
  const [crepeResult, setCrepeResult] = useState<CrepeResult | null>(null)
  const [stats, setStats] = useState({ total: 0, agree: 0, pitchyAvgMs: 0, crepeAvgMs: 0 })
  const [testTone, setTestTone] = useState<number | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const detectorRef = useRef<PitchDetector<Float32Array> | null>(null)
  const crepeRunningRef = useRef(false)
  const toneOscRef = useRef<OscillatorNode | null>(null)
  const statsRef = useRef({ total: 0, agreeCount: 0, pitchySumMs: 0, crepeSumMs: 0 })

  // ─── Load CREPE model ───────────────────────────────────────────────────
  const handleLoadModel = useCallback(async () => {
    setModelState('loading')
    try {
      await loadCrepeModel()
      setModelState('ready')
    } catch (err) {
      console.error('CREPE load failed:', err)
      setModelState('error')
    }
  }, [])

  // ─── Start mic + analysis loop ──────────────────────────────────────────
  const handleStartMic = useCallback(async () => {
    setMicState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      src.connect(analyser)

      audioCtxRef.current = ctx
      analyserRef.current = analyser
      streamRef.current = stream
      detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize)

      setMicState('on')

      const buffer = new Float32Array(analyser.fftSize)

      function tick() {
        if (!analyserRef.current || !detectorRef.current) return
        analyserRef.current.getFloatTimeDomainData(buffer)

        // ── pitchy (runs every frame) ──
        const t0p = performance.now()
        const [freq, clarity] = detectorRef.current.findPitch(buffer, ctx.sampleRate)
        const pitchyMs = performance.now() - t0p

        let pitchyRes: PitchyResult | null = null
        if (clarity > 0.85 && freq > 60 && freq < 2000) {
          const n = freqToNote(freq)
          pitchyRes = { note: n.name, frequency: freq, cents: n.cents, confidence: clarity, latencyMs: pitchyMs }
        }
        setPitchyResult(pitchyRes)

        // ── CREPE (skip if previous inference still running) ──
        let crepeRes: CrepeResult | null = null
        if (isModelLoaded() && !crepeRunningRef.current) {
          crepeRunningRef.current = true
          crepeRes = detectPitchCrepe(buffer, ctx.sampleRate)
          crepeRunningRef.current = false
          // Filter low-confidence
          if (crepeRes && crepeRes.confidence < 0.5) crepeRes = null
        }
        setCrepeResult(crepeRes)

        // ── Stats ──
        if (pitchyRes || crepeRes) {
          const s = statsRef.current
          s.total++
          const agree = pitchyRes && crepeRes
            ? pitchyRes.note.replace(/\d+$/, '') === crepeRes.note.replace(/\d+$/, '')
            : false
          if (agree) s.agreeCount++
          if (pitchyRes) s.pitchySumMs += pitchyRes.latencyMs
          if (crepeRes) s.crepeSumMs += crepeRes.latencyMs

          setStats({
            total: s.total,
            agree: s.total > 0 ? Math.round((s.agreeCount / s.total) * 100) : 0,
            pitchyAvgMs: s.total > 0 ? Math.round(s.pitchySumMs / s.total * 10) / 10 : 0,
            crepeAvgMs: s.total > 0 ? Math.round(s.crepeSumMs / s.total * 10) / 10 : 0,
          })

          // Log last 50 entries
          setLog(prev => {
            const entry: LogEntry = { ts: Date.now(), pitchy: pitchyRes, crepe: crepeRes, agree, testToneHz: toneOscRef.current ? testTone : null }
            const next = [...prev, entry]
            return next.length > 50 ? next.slice(-50) : next
          })
        }

        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      console.error('Mic failed:', err)
      setMicState('off')
    }
  }, [testTone])

  // ─── Stop mic ───────────────────────────────────────────────────────────
  const handleStopMic = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    streamRef.current = null
    detectorRef.current = null
    setMicState('off')
    setPitchyResult(null)
    setCrepeResult(null)
  }, [])

  // ─── Test tone generator ────────────────────────────────────────────────
  const toggleTestTone = useCallback((freq: number) => {
    if (toneOscRef.current) {
      toneOscRef.current.stop()
      toneOscRef.current.disconnect()
      toneOscRef.current = null
      setTestTone(null)
      return
    }
    const ctx = audioCtxRef.current
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.value = 0.15
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    toneOscRef.current = osc
    setTestTone(freq)
  }, [])

  // Cleanup
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    toneOscRef.current?.stop()
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">CREPE vs pitchy — Pitch Detection Benchmark</h1>
        <p className="text-gray-400 mb-6">Side-by-side comparison: same mic input, both detectors</p>

        {/* Controls */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleLoadModel}
            disabled={modelState === 'loading' || modelState === 'ready'}
            className="px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              background: modelState === 'ready' ? '#22c55e20' : modelState === 'loading' ? '#f59e0b20' : '#3b82f620',
              border: `2px solid ${modelState === 'ready' ? '#22c55e' : modelState === 'loading' ? '#f59e0b' : '#3b82f6'}`,
              color: modelState === 'ready' ? '#22c55e' : modelState === 'loading' ? '#f59e0b' : '#3b82f6',
            }}
          >
            {modelState === 'idle' ? 'Load CREPE Model (2MB)' : modelState === 'loading' ? 'Loading...' : modelState === 'ready' ? 'Model Ready' : 'Load Failed'}
          </button>

          <button
            onClick={micState === 'on' ? handleStopMic : handleStartMic}
            disabled={modelState !== 'ready' || micState === 'starting'}
            className="px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              background: micState === 'on' ? '#ef444420' : '#22c55e20',
              border: `2px solid ${micState === 'on' ? '#ef4444' : '#22c55e'}`,
              color: micState === 'on' ? '#ef4444' : '#22c55e',
              opacity: modelState !== 'ready' ? 0.4 : 1,
            }}
          >
            {micState === 'on' ? 'Stop Mic' : micState === 'starting' ? 'Starting...' : 'Start Mic'}
          </button>

          <button
            onClick={() => { statsRef.current = { total: 0, agreeCount: 0, pitchySumMs: 0, crepeSumMs: 0 }; setStats({ total: 0, agree: 0, pitchyAvgMs: 0, crepeAvgMs: 0 }); setLog([]) }}
            className="px-4 py-2 rounded-lg font-medium border-2 border-gray-600 text-gray-400 hover:text-white transition-all"
          >
            Reset Stats
          </button>
        </div>

        {/* Test tones */}
        {micState === 'on' && (
          <div className="mb-6">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Test Tones (ground truth)</div>
            <div className="flex gap-2 flex-wrap">
              {[
                ['C4', 261.63], ['D4', 293.66], ['E4', 329.63], ['F4', 349.23],
                ['G4', 392.00], ['A4', 440.00], ['B4', 493.88], ['C5', 523.25],
              ].map(([name, freq]) => (
                <button
                  key={name as string}
                  onClick={() => toggleTestTone(freq as number)}
                  className="px-3 py-1.5 rounded-lg text-sm font-mono transition-all"
                  style={{
                    background: testTone === freq ? '#8b5cf620' : '#1f2937',
                    border: `1px solid ${testTone === freq ? '#8b5cf6' : '#374151'}`,
                    color: testTone === freq ? '#8b5cf6' : '#9ca3af',
                  }}
                >
                  {name as string} ({freq as number}Hz)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Side-by-side results */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <DetectorCard
            title="pitchy (McLeod)"
            subtitle="Autocorrelation — current engine"
            color="#3b82f6"
            result={pitchyResult ? {
              note: pitchyResult.note,
              frequency: pitchyResult.frequency,
              cents: pitchyResult.cents,
              confidence: pitchyResult.confidence,
              latencyMs: pitchyResult.latencyMs,
            } : null}
            testToneHz={testTone}
          />
          <DetectorCard
            title="CREPE (CNN)"
            subtitle="ML model — 360-bin CNN"
            color="#8b5cf6"
            result={crepeResult ? {
              note: crepeResult.note,
              frequency: crepeResult.frequency,
              cents: crepeResult.cents,
              confidence: crepeResult.confidence,
              latencyMs: crepeResult.latencyMs,
            } : null}
            testToneHz={testTone}
          />
        </div>

        {/* Stats summary */}
        <div className="rounded-xl p-4 mb-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Running Stats ({stats.total} samples)</div>
          <div className="grid grid-cols-4 gap-4">
            <Stat label="Note Agreement" value={`${stats.agree}%`} color={stats.agree > 90 ? '#22c55e' : stats.agree > 70 ? '#f59e0b' : '#ef4444'} />
            <Stat label="pitchy Avg Latency" value={`${stats.pitchyAvgMs}ms`} color="#3b82f6" />
            <Stat label="CREPE Avg Latency" value={`${stats.crepeAvgMs}ms`} color="#8b5cf6" />
            <Stat label="CREPE/pitchy Ratio" value={stats.pitchyAvgMs > 0 ? `${(stats.crepeAvgMs / stats.pitchyAvgMs).toFixed(1)}x` : '-'} color="#9ca3af" />
          </div>
        </div>

        {/* Recent log */}
        <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Detection Log (last 50)</div>
          <div className="font-mono text-xs overflow-auto max-h-64 space-y-0.5">
            {log.slice().reverse().map((e, i) => (
              <div key={i} className="flex gap-4" style={{ color: e.agree ? '#22c55e80' : '#ef444480' }}>
                <span className="text-gray-600 w-12">{new Date(e.ts).toLocaleTimeString().split(' ')[0]}</span>
                <span className="w-20" style={{ color: '#3b82f6' }}>{e.pitchy?.note ?? '---'} {e.pitchy ? `${e.pitchy.cents > 0 ? '+' : ''}${e.pitchy.cents}c` : ''}</span>
                <span className="w-20" style={{ color: '#8b5cf6' }}>{e.crepe?.note ?? '---'} {e.crepe ? `${e.crepe.cents > 0 ? '+' : ''}${e.crepe.cents}c` : ''}</span>
                <span className="w-16">{e.agree ? 'AGREE' : 'DIFF'}</span>
                {e.testToneHz && <span className="text-gray-500">tone:{e.testToneHz}Hz</span>}
              </div>
            ))}
            {log.length === 0 && <div className="text-gray-600">Start mic to begin benchmarking...</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function DetectorCard({ title, subtitle, color, result, testToneHz }: {
  title: string; subtitle: string; color: string
  result: { note: string; frequency: number; cents: number; confidence: number; latencyMs: number } | null
  testToneHz: number | null
}) {
  const isCorrect = testToneHz && result
    ? Math.abs(result.frequency - testToneHz) < testToneHz * 0.03 // within 3% = ~50 cents
    : null

  return (
    <div className="rounded-xl p-4" style={{ background: '#111827', border: `1px solid ${color}30` }}>
      <div className="text-lg font-bold mb-0.5" style={{ color }}>{title}</div>
      <div className="text-xs text-gray-500 mb-3">{subtitle}</div>

      {result ? (
        <div className="space-y-2">
          <div className="text-4xl font-bold text-white">{result.note}</div>
          <div className="text-sm text-gray-400">{result.frequency.toFixed(1)} Hz</div>
          <div className="flex gap-4 text-sm">
            <span style={{ color: Math.abs(result.cents) <= 10 ? '#22c55e' : Math.abs(result.cents) <= 25 ? '#f59e0b' : '#ef4444' }}>
              {result.cents > 0 ? '+' : ''}{result.cents}c
            </span>
            <span className="text-gray-500">conf: {(result.confidence * 100).toFixed(0)}%</span>
            <span className="text-gray-500">{result.latencyMs.toFixed(1)}ms</span>
          </div>
          {isCorrect !== null && (
            <div className="text-xs font-bold" style={{ color: isCorrect ? '#22c55e' : '#ef4444' }}>
              {isCorrect ? 'CORRECT' : `WRONG (expected ${testToneHz}Hz)`}
            </div>
          )}
        </div>
      ) : (
        <div className="text-2xl text-gray-700">---</div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  )
}
