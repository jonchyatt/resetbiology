"use client"

import { motion } from "framer-motion"
import { BreathState } from "@/types/breath"
import { useEffect, useRef } from "react"

interface BreathOrbTestProps {
  state: BreathState
  isInhale: boolean
  progress: number
  motionReduced: boolean
  currentHoldDuration?: number
  inhaleMs?: number
  exhaleMs?: number
}

interface Particle {
  x: number
  y: number
  vx: number // velocity
  vy: number
  size: number
  baseSize: number
  life: number // 0 to 1, particle fades as it ages
  hue: number
  brightness: number
  alpha: number
}

export function BreathOrbTest({ state, isInhale, progress, motionReduced, currentHoldDuration = 0, inhaleMs = 3000, exhaleMs = 3000 }: BreathOrbTestProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationFrameRef = useRef<number | undefined>(undefined)
  const stateRef = useRef({ state, isInhale }) // Track current state for animation loop

  // Update state ref whenever props change
  useEffect(() => {
    stateRef.current = { state, isInhale }
  }, [state, isInhale])

  // Get rainbow color palette based on state
  const getColorHues = () => {
    switch (state) {
      case 'breathing_active':
        return isInhale
          ? { min: 180, max: 280 } // Blue → Cyan → Purple (inhale)
          : { min: 30, max: 90 }   // Orange → Yellow → Green (exhale)
      case 'exhale_hold_ready':
      case 'exhale_hold_active':
        return { min: 0, max: 60 } // Red → Orange → Yellow (warm)
      case 'inhale_hold_ready':
      case 'inhale_hold_active':
        return { min: 120, max: 200 } // Green → Cyan → Blue (cool)
      case 'cycle_complete':
      case 'session_complete':
        return { min: 0, max: 360 } // FULL SPECTRUM RAINBOW! 🌈
      case 'paused':
        return { min: 0, max: 0, saturation: 0 } // Gray
      default:
        return { min: 140, max: 180 } // Green-cyan
    }
  }

  const getStateColor = () => {
    switch (state) {
      case 'breathing_active':
        return isInhale ? 'from-blue-400 to-blue-600' : 'from-blue-300 to-blue-500'
      case 'exhale_hold_ready':
      case 'exhale_hold_active':
        return 'from-amber-400 to-orange-500'
      case 'inhale_hold_ready':
      case 'inhale_hold_active':
        return 'from-green-400 to-emerald-500'
      case 'cycle_complete':
        return 'from-purple-400 to-purple-600'
      case 'paused':
        return 'from-gray-400 to-gray-600'
      case 'session_complete':
        return 'from-primary-400 to-secondary-500'
      default:
        return 'from-green-300 to-green-500'
    }
  }

  const getScale = () => {
    if (motionReduced) return 1

    switch (state) {
      case 'breathing_active':
        return isInhale ? 1.2 : 0.8
      case 'exhale_hold_active':
        return 0.6
      case 'inhale_hold_active':
        return 1.4
      case 'cycle_complete':
      case 'session_complete':
        return 1.1
      default:
        return 1
    }
  }

  const getRingProgress = () => {
    if (state === 'breathing_active') return progress
    if (state === 'exhale_hold_active' || state === 'inhale_hold_active') return 1
    return 0
  }

  // Dynamic particle flow system - emanates from center and flows outward
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || motionReduced) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = 256
    const height = 256
    canvas.width = width
    canvas.height = height

    const centerX = width / 2
    const centerY = height / 2
    const maxRadius = 204 // Increased from 120 to 204 (1.7x) - particles reach edge

    // Particle emission settings - ROLLBACK to working values
    const emissionRate = 120 // particles per second (balanced performance)
    let lastEmitTime = Date.now()
    const particleLifetime = 8000 // 8 seconds - MUCH longer life (3x-4x longer spread)

    // ONE-TIME initialization with gentle mist of particles
    // These particles PERSIST across all breath cycles
    if (particlesRef.current.length === 0) {
      // Pre-populate with balanced number of particles
      for (let i = 0; i < 200; i++) {
        const angle = Math.random() * Math.PI * 2
        const distance = Math.random() * 119 // Spread throughout orb (70 * 1.7)
        const speed = 0.15 + Math.random() * 0.25 // Original working speed

        // Use current state's colors
        const colorHues = getColorHues()
        const hueRange = colorHues.max - colorHues.min
        const randomHue = colorHues.min + Math.random() * hueRange

        particlesRef.current.push({
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 0.8 + Math.random() * 0.8, // Smaller: 0.8-1.6px (was 1.5-2.5px)
          baseSize: 2,
          life: 1.0, // Full life - won't fade until breathing starts
          hue: randomHue,
          brightness: 60 + Math.random() * 40,
          alpha: 0.9
        })
      }
    }

    // Create a new particle emanating from center
    const createParticle = () => {
      const colorHues = getColorHues()
      const hueRange = colorHues.max - colorHues.min
      const randomHue = colorHues.min + Math.random() * hueRange

      // Very tight center emission (radius 0.01 in Unity ≈ near center)
      const spawnAngle = Math.random() * Math.PI * 2
      const spawnRadius = Math.random() * 2 // Very small spawn area

      // Moderate outward velocity - same as initial particles
      const speed = 0.15 + Math.random() * 0.25 // Match initial particle speed
      const velocityAngle = spawnAngle + (Math.random() - 0.5) * 0.3

      const particle: Particle = {
        x: centerX + Math.cos(spawnAngle) * spawnRadius,
        y: centerY + Math.sin(spawnAngle) * spawnRadius,
        vx: Math.cos(velocityAngle) * speed,
        vy: Math.sin(velocityAngle) * speed,
        size: 0.8 + Math.random() * 0.8, // Smaller: 0.8-1.6px (was 1.5-2.5px)
        baseSize: 2,
        life: 1.0,
        hue: randomHue,
        brightness: 60 + Math.random() * 40,
        alpha: 0.9
      }
      return particle
    }

    // Animation loop - particles flow from center outward
    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      const now = Date.now()
      const deltaTime = 16 // Approximate 60fps

      // ALWAYS emit new particles (spawn, live, die continuously)
      const timeSinceEmit = now - lastEmitTime
      const particlesToEmit = Math.floor((timeSinceEmit / 1000) * emissionRate)

      if (particlesToEmit > 0) {
        for (let i = 0; i < particlesToEmit; i++) {
          particlesRef.current.push(createParticle())
        }
        lastEmitTime = now
      }

      // Update and render particles
      const particles = particlesRef.current
      const colorHues = getColorHues()
      const saturation = colorHues.saturation !== undefined ? colorHues.saturation : 80

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]

        // Calculate distance from center
        const dx = p.x - centerX
        const dy = p.y - centerY
        const distFromCenter = Math.sqrt(dx * dx + dy * dy)

        // BREATHING-REACTIVE MOVEMENT
        // Exhale: Full speed outward
        // Inhale: Half speed inward (net outward movement over time)
        let velocityMultiplier = 1 // Default: always moving outward

        // Use stateRef to get CURRENT state (not stale closure)
        const currentState = stateRef.current.state
        const currentIsInhale = stateRef.current.isInhale

        if (currentState === 'breathing_active') {
          if (currentIsInhale) {
            // INHALE: Reverse direction at HALF SPEED (particles flow INWARD slower)
            // This creates net outward movement: out at 1x, in at 0.5x = net 0.5x outward
            velocityMultiplier = -0.5
          } else {
            // EXHALE: Full speed outward
            velocityMultiplier = 1
          }
        }

        // Move particle with breathing-adjusted velocity (ALWAYS MOVING)
        p.x += p.vx * velocityMultiplier
        p.y += p.vy * velocityMultiplier

        // Age particle continuously (particles always have lifespan and die)
        p.life -= deltaTime / particleLifetime

        // Remove dead particles or particles that went too far
        if (p.life <= 0 || distFromCenter > maxRadius) {
          particles.splice(i, 1)
          continue
        }

        // Fade out as life decreases (color-over-lifetime from Unity)
        const lifeFade = p.life * p.life // Quadratic fade looks nicer
        const alpha = p.alpha * lifeFade

        // Render particle with stronger glow for nebula effect
        ctx.shadowBlur = 25
        ctx.shadowColor = `hsla(${p.hue}, ${saturation}%, ${p.brightness}%, ${alpha * 0.7})`
        ctx.fillStyle = `hsla(${p.hue}, ${saturation}%, ${p.brightness}%, ${alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.shadowBlur = 0
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [motionReduced]) // Only reset if motionReduced changes - NOT on state/isInhale changes!

  return (
    <div className="relative flex items-center justify-center z-0">
      {/* Static yellow glow behind everything for differentiation */}
      <div
        className="absolute w-64 h-64 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.25) 0%, rgba(251, 191, 36, 0.12) 50%, transparent 100%)',
          filter: 'blur(50px)'
        }}
      />

      {/* Breathing-reactive glow - OUTSIDE motion.div so it doesn't scale */}
      <motion.div
        className="absolute w-64 h-64 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${
            // Center: Full intensity - reaches all the way to edge
            state === 'breathing_active'
              ? (isInhale ? 'rgba(59, 130, 246, 0.7)' : 'rgba(251, 146, 60, 0.7)')
              : state === 'exhale_hold_active'
              ? 'rgba(251, 146, 60, 0.84)'
              : state === 'inhale_hold_active'
              ? 'rgba(52, 211, 153, 0.84)'
              : 'rgba(139, 92, 246, 0.7)'
          } 0%, ${
            // 20%: 80% intensity
            state === 'breathing_active'
              ? (isInhale ? 'rgba(59, 130, 246, 0.56)' : 'rgba(251, 146, 60, 0.56)')
              : state === 'exhale_hold_active'
              ? 'rgba(251, 146, 60, 0.67)'
              : state === 'inhale_hold_active'
              ? 'rgba(52, 211, 153, 0.67)'
              : 'rgba(139, 92, 246, 0.56)'
          } 20%, ${
            // 35%: 60% intensity
            state === 'breathing_active'
              ? (isInhale ? 'rgba(59, 130, 246, 0.42)' : 'rgba(251, 146, 60, 0.42)')
              : state === 'exhale_hold_active'
              ? 'rgba(251, 146, 60, 0.5)'
              : state === 'inhale_hold_active'
              ? 'rgba(52, 211, 153, 0.5)'
              : 'rgba(139, 92, 246, 0.42)'
          } 35%, ${
            // 50%: 40% intensity
            state === 'breathing_active'
              ? (isInhale ? 'rgba(59, 130, 246, 0.28)' : 'rgba(251, 146, 60, 0.28)')
              : state === 'exhale_hold_active'
              ? 'rgba(251, 146, 60, 0.34)'
              : state === 'inhale_hold_active'
              ? 'rgba(52, 211, 153, 0.34)'
              : 'rgba(139, 92, 246, 0.28)'
          } 50%, ${
            // 70%: 15% intensity
            state === 'breathing_active'
              ? (isInhale ? 'rgba(59, 130, 246, 0.11)' : 'rgba(251, 146, 60, 0.11)')
              : state === 'exhale_hold_active'
              ? 'rgba(251, 146, 60, 0.13)'
              : state === 'inhale_hold_active'
              ? 'rgba(52, 211, 153, 0.13)'
              : 'rgba(139, 92, 246, 0.11)'
          } 70%, ${
            // 85%: 5% intensity
            state === 'breathing_active'
              ? (isInhale ? 'rgba(59, 130, 246, 0.04)' : 'rgba(251, 146, 60, 0.04)')
              : state === 'exhale_hold_active'
              ? 'rgba(251, 146, 60, 0.05)'
              : state === 'inhale_hold_active'
              ? 'rgba(52, 211, 153, 0.05)'
              : 'rgba(139, 92, 246, 0.04)'
          } 85%, ${
            // 100%: Still visible at edge (2% intensity)
            state === 'breathing_active'
              ? (isInhale ? 'rgba(59, 130, 246, 0.02)' : 'rgba(251, 146, 60, 0.02)')
              : state === 'exhale_hold_active'
              ? 'rgba(251, 146, 60, 0.03)'
              : state === 'inhale_hold_active'
              ? 'rgba(52, 211, 153, 0.03)'
              : 'rgba(139, 92, 246, 0.02)'
          } 100%)`,
          filter: 'blur(60px)'
        }}
        initial={false}
        animate={{
          opacity: state === 'idle' ? 0 : 1
        }}
        transition={{ duration: 0.5 }}
      />

      {/* Progress Ring */}
      <svg
        className="absolute w-80 h-80 transform -rotate-90"
        viewBox="0 0 200 200"
      >
        <circle
          cx="100"
          cy="100"
          r="90"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          className="text-gray-300"
        />
        <motion.circle
          cx="100"
          cy="100"
          r="90"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="text-primary-400"
          strokeDasharray={565.48}
          strokeDashoffset={565.48 - (565.48 * getRingProgress())}
          strokeLinecap="round"
          initial={false}
          animate={{
            strokeDashoffset: 565.48 - (565.48 * getRingProgress())
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        />
      </svg>

      {/* Main Orb - SIMPLE SCALING DIV WITH RAINBOW SHIMMER */}
      {motionReduced ? (
        <div className="w-64 h-64 rounded-full border-4 border-gray-300 flex items-center justify-center">
          <div className="w-56 h-4 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${getStateColor()}`}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      ) : (
        <motion.div
          className="w-64 h-64 rounded-full relative overflow-hidden"
          animate={{
            scale: getScale(),
            rotate: state === 'session_complete' ? 360 : 0
          }}
          transition={{
            scale: {
              duration: state === 'breathing_active' ?
                (isInhale ? inhaleMs / 1000 : exhaleMs / 1000) : 0.5,
              ease: "easeInOut"
            },
            rotate: {
              duration: 2,
              ease: "easeInOut"
            }
          }}
        >
          {/* Particle Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full rounded-full"
            style={{
              filter: 'blur(1px)',
              mixBlendMode: 'screen'
            }}
          />
        </motion.div>
      )}

      {/* State Label */}
      {state !== 'idle' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="backdrop-blur-sm px-6 py-3 rounded-full text-base font-semibold border transition-all duration-300 bg-black/60 text-white border-white/20 text-center">
            {state === 'breathing_active' && (isInhale ? 'Inhale' : 'Exhale')}
            {state === 'exhale_hold_ready' && 'Ready for Exhale Hold'}
            {state === 'exhale_hold_active' && `Exhale Hold: ${Math.floor(currentHoldDuration / 1000)}s`}
            {state === 'inhale_hold_ready' && 'Ready for Inhale Hold'}
            {state === 'inhale_hold_active' && `Inhale Hold: ${Math.floor(currentHoldDuration / 1000)}s`}
            {state === 'cycle_complete' && 'Cycle Complete'}
            {state === 'paused' && 'Paused'}
            {state === 'session_complete' && 'Session Complete'}
          </div>
        </div>
      )}
    </div>
  )
}
