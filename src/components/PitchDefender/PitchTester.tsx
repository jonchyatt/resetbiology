'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PitchTester — Free-Play Diagnostic with Staff Visualization
// ═══════════════════════════════════════════════════════════════════════════════
//
// Route: /pitch-defender/staff-tester
// Sing into the mic → see exactly where your voice lands on the musical staff.
// Optional target notes for accuracy testing. Reference tone playback.
// Proves the detection pipeline works before building the game on top of it.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback } from 'react'
import StaffCanvas from './StaffCanvas'
import { type FusedPitch } from './pitchFusion'
import { initAudio } from './audioEngine'

const TARGET_NOTES = [
  { name: 'C3', semi: -12 }, { name: 'D3', semi: -10 }, { name: 'E3', semi: -8 },
  { name: 'F3', semi: -7 },  { name: 'G3', semi: -5 },  { name: 'A3', semi: -3 },
  { name: 'B3', semi: -1 },
  { name: 'C4', semi: 0 },   { name: 'D4', semi: 2 },   { name: 'E4', semi: 4 },
  { name: 'F4', semi: 5 },   { name: 'G4', semi: 7 },   { name: 'A4', semi: 9 },
  { name: 'B4', semi: 11 },
  { name: 'C5', semi: 12 },  { name: 'D5', semi: 14 },  { name: 'E5', semi: 16 },
]

// Semitones to frequency
function semiToFreq(semi: number): number {
  return 261.63 * Math.pow(2, semi / 12)
}

export default function PitchTester() {
  const [targetNote, setTargetNote] = useState<number | undefined>(undefined)
  const [lastPitch, setLastPitch] = useState<FusedPitch | null>(null)
  const [stats, setStats] = useState({ samples: 0, avgCents: 0, settled: 0 })
  const [showML, setShowML] = useState(true)
  const statsRef = useRef({ totalCents: 0, count: 0, settledCount: 0 })
  const toneOscRef = useRef<OscillatorNode | null>(null)
  const toneCtxRef = useRef<AudioContext | null>(null)

  const handlePitch = useCallback((pitch: FusedPitch) => {
    setLastPitch(pitch)

    if (pitch.isActive && pitch.isSettled && targetNote !== undefined) {
      const s = statsRef.current
      const deviation = Math.abs(pitch.staffPosition - targetNote)
      s.totalCents += deviation * 100 / 12  // rough cents
      s.count++
      s.settledCount++
      setStats({
        samples: s.count,
        avgCents: Math.round(s.totalCents / s.count),
        settled: s.settledCount,
      })
    }
  }, [targetNote])

  const playReferenceTone = useCallback((semi: number) => {
    // Stop existing tone
    if (toneOscRef.current) {
      toneOscRef.current.stop()
      toneOscRef.current.disconnect()
      toneOscRef.current = null
    }

    initAudio()
    const ctx = toneCtxRef.current ?? new AudioContext()
    toneCtxRef.current = ctx
    if (ctx.state === 'suspended') ctx.resume()

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = semiToFreq(semi)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 2)
    toneOscRef.current = osc
  }, [])

  const resetStats = useCallback(() => {
    statsRef.current = { totalCents: 0, count: 0, settledCount: 0 }
    setStats({ samples: 0, avgCents: 0, settled: 0 })
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-[#08080f] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800/50">
        <div>
          <h1 className="text-xl font-bold text-white">Staff Pitch Tester</h1>
          <p className="text-xs text-gray-500">Sing → see where your voice lands on the staff</p>
        </div>

        <div className="flex items-center gap-4">
          {/* ML toggle */}
          <button
            onClick={() => setShowML(!showML)}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: showML ? 'rgba(139,92,246,0.15)' : 'rgba(40,40,60,0.4)',
              border: `1px solid ${showML ? 'rgba(139,92,246,0.4)' : 'rgba(60,60,80,0.3)'}`,
              color: showML ? '#a78bfa' : '#666',
            }}
          >
            ML Fusion {showML ? 'ON' : 'OFF'}
          </button>

          {/* Stats */}
          {stats.samples > 0 && (
            <div className="flex gap-3 text-xs">
              <span className="text-gray-500">Samples: <span className="text-gray-300">{stats.samples}</span></span>
              <span className="text-gray-500">Avg deviation: <span style={{
                color: stats.avgCents <= 10 ? '#64ffa0' : stats.avgCents <= 25 ? '#ffc83c' : '#ff5050'
              }}>{stats.avgCents}c</span></span>
              <button onClick={resetStats} className="text-gray-600 hover:text-gray-400">reset</button>
            </div>
          )}

          {/* Back link */}
          <a href="/pitch-defender" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← Back to Game
          </a>
        </div>
      </div>

      {/* Staff Canvas (fills remaining space — min-h-0 prevents flex overflow) */}
      <div className="flex-1 relative min-h-0">
        <StaffCanvas
          targetNote={targetNote}
          fusionConfig={{ enableML: showML, noiseGateDb: -45 }}
          onPitch={handlePitch}
        />
      </div>

      {/* Target Note Selector */}
      <div className="px-4 py-3 border-t border-gray-800/50">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Target:</span>

          <button
            onClick={() => { setTargetNote(undefined); resetStats() }}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: targetNote === undefined ? 'rgba(63,191,181,0.15)' : 'rgba(40,40,60,0.4)',
              border: `1px solid ${targetNote === undefined ? 'rgba(63,191,181,0.4)' : 'rgba(60,60,80,0.3)'}`,
              color: targetNote === undefined ? '#3FBFB5' : '#666',
            }}
          >
            Free Play
          </button>

          <div className="flex gap-1 flex-wrap">
            {TARGET_NOTES.map(({ name, semi }) => (
              <button
                key={name}
                onClick={() => { setTargetNote(semi); resetStats() }}
                onDoubleClick={() => playReferenceTone(semi)}
                className="text-xs px-2 py-1 rounded transition-all font-mono"
                title="Click to set target · Double-click to hear reference tone"
                style={{
                  background: targetNote === semi ? 'rgba(139,92,246,0.2)' : 'rgba(30,30,45,0.6)',
                  border: `1px solid ${targetNote === semi ? 'rgba(139,92,246,0.5)' : 'rgba(50,50,70,0.3)'}`,
                  color: targetNote === semi ? '#c4b5fd' : '#777',
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-gray-600 mt-1">
          Click = set target · Double-click = hear reference tone
        </div>
      </div>
    </div>
  )
}
