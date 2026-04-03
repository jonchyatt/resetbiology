'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// StaffCanvas — React wrapper for the Canvas 2D staff renderer
// ═══════════════════════════════════════════════════════════════════════════════
//
// Connects PitchFusion engine → staffRenderer → Canvas element.
// Manages the animation loop, trail buffer, and canvas resize.
// Shared between PitchTester (diagnostic) and NoteRunner (game).
// ═══════════════════════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback, useState } from 'react'
import { PitchFusion, type FusedPitch, type FusionConfig, DEFAULT_FUSION_CONFIG } from './pitchFusion'
import { computeLayout, renderStaff, type TrailPoint, type StaffLayout } from './staffRenderer'

interface StaffCanvasProps {
  targetNote?: number        // optional target note (semitones from C4)
  fusionConfig?: Partial<FusionConfig>
  onPitch?: (pitch: FusedPitch) => void
  showControls?: boolean
}

export default function StaffCanvas({ targetNote, fusionConfig, onPitch, showControls = true }: StaffCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fusionRef = useRef<PitchFusion | null>(null)
  const layoutRef = useRef<StaffLayout | null>(null)
  const trailRef = useRef<TrailPoint[]>([])
  const pitchRef = useRef<FusedPitch | null>(null)
  const rafRef = useRef<number>(0)

  const [isRunning, setIsRunning] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [mlStatus, setMlStatus] = useState<'off' | 'loading' | 'ready'>('off')

  // ─── Canvas Resize ──────────────────────────────────────────────────────
  const updateLayout = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
    layoutRef.current = computeLayout(rect.width, rect.height)
  }, [])

  useEffect(() => {
    updateLayout()
    window.addEventListener('resize', updateLayout)
    return () => window.removeEventListener('resize', updateLayout)
  }, [updateLayout])

  // ─── Animation Loop ─────────────────────────────────────────────────────
  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current
    const layout = layoutRef.current
    if (!canvas || !layout) {
      rafRef.current = requestAnimationFrame(renderLoop)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pitch = pitchRef.current
    const now = performance.now()

    // Prune old trail points (keep last 3 seconds)
    const trail = trailRef.current
    while (trail.length > 0 && now - trail[0].timestamp > 3000) trail.shift()

    renderStaff(ctx, layout, {
      voiceActive: pitch?.isActive ?? false,
      staffPosition: pitch?.staffPosition ?? 0,
      confidence: pitch?.confidence ?? 0,
      cents: pitch?.cents ?? 0,
      isSettled: pitch?.isSettled ?? false,
      isVibrato: pitch?.isVibrato ?? false,
      trail,
      targetNote,
    })

    rafRef.current = requestAnimationFrame(renderLoop)
  }, [targetNote])

  // Start render loop on mount
  useEffect(() => {
    rafRef.current = requestAnimationFrame(renderLoop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [renderLoop])

  // ─── Start / Stop ───────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setMicError(null)

    const config = { ...DEFAULT_FUSION_CONFIG, ...fusionConfig }
    const fusion = new PitchFusion(config)
    fusionRef.current = fusion

    if (config.enableML) setMlStatus('loading')

    await fusion.start(
      (pitch) => {
        pitchRef.current = pitch
        onPitch?.(pitch)

        // Add to trail
        if (pitch.isActive) {
          trailRef.current.push({
            staffPosition: pitch.staffPosition,
            confidence: pitch.confidence,
            timestamp: performance.now(),
          })
          // Cap trail length
          if (trailRef.current.length > 200) trailRef.current.shift()
        }

        // Update ML status
        if (fusion.isMLReady && mlStatus !== 'ready') setMlStatus('ready')
      },
      (err) => setMicError(err),
    )

    setIsRunning(true)
  }, [fusionConfig, onPitch, mlStatus])

  const handleStop = useCallback(() => {
    fusionRef.current?.stop()
    fusionRef.current = null
    pitchRef.current = null
    trailRef.current = []
    setIsRunning(false)
    setMlStatus('off')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      fusionRef.current?.stop()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────
  const pitch = pitchRef.current

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />

      {/* HUD overlay */}
      {isRunning && pitch?.isActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <div className="text-3xl font-bold text-white" style={{ textShadow: '0 0 20px rgba(100,200,255,0.3)' }}>
            {pitch.note}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {pitch.frequency.toFixed(1)} Hz
            <span className="mx-2">·</span>
            <span style={{ color: Math.abs(pitch.cents) <= 10 ? '#64ffaa' : Math.abs(pitch.cents) <= 25 ? '#ffc83c' : '#ff5050' }}>
              {pitch.cents > 0 ? '+' : ''}{pitch.cents}c
            </span>
            <span className="mx-2">·</span>
            <span className="text-gray-500">{pitch.source}</span>
          </div>
          {pitch.isVibrato && (
            <div className="text-xs text-purple-400 mt-0.5" style={{ textShadow: '0 0 8px rgba(180,130,255,0.5)' }}>
              vibrato
            </div>
          )}
        </div>
      )}

      {/* ML status badge */}
      {isRunning && (
        <div className="absolute top-3 right-3 pointer-events-none">
          <div className="text-xs px-2 py-1 rounded-full" style={{
            background: mlStatus === 'ready' ? 'rgba(100,255,160,0.1)' : mlStatus === 'loading' ? 'rgba(255,200,60,0.1)' : 'rgba(80,80,100,0.1)',
            border: `1px solid ${mlStatus === 'ready' ? 'rgba(100,255,160,0.3)' : mlStatus === 'loading' ? 'rgba(255,200,60,0.3)' : 'rgba(80,80,100,0.2)'}`,
            color: mlStatus === 'ready' ? '#64ffa0' : mlStatus === 'loading' ? '#ffc83c' : '#555',
          }}>
            {mlStatus === 'ready' ? 'ML Active' : mlStatus === 'loading' ? 'ML Loading...' : 'pitchy only'}
          </div>
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
          <button
            onClick={isRunning ? handleStop : handleStart}
            className="px-6 py-2.5 rounded-xl font-bold text-white transition-all active:scale-95"
            style={{
              background: isRunning
                ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
                : 'linear-gradient(135deg, #3FBFB5, #2a8a82)',
              boxShadow: `0 0 20px ${isRunning ? 'rgba(239,68,68,0.3)' : 'rgba(63,191,181,0.3)'}`,
            }}
          >
            {isRunning ? 'STOP' : 'START MIC'}
          </button>
        </div>
      )}

      {/* Error */}
      {micError && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-red-400 text-sm bg-red-900/30 px-4 py-2 rounded-lg border border-red-800/30">
          {micError}
        </div>
      )}
    </div>
  )
}
