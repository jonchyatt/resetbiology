'use client'

import { useEffect, useRef, useState } from 'react'
import { drawGaborPatch, fitCanvasToElement } from '@/lib/vision/canvasKit'

interface GaborPatchProps {
  // Size of the patch in pixels
  size?: number
  // Orientation in degrees (0 = vertical stripes, 90 = horizontal)
  orientation?: number
  // Spatial frequency (cycles per patch width) - higher = more stripes
  frequency?: number
  // Contrast 0-1 (1 = full contrast, 0 = invisible)
  contrast?: number
  // Gaussian envelope sigma (controls how much the edges fade)
  sigma?: number
  // Phase offset in degrees (shifts the wave pattern)
  phase?: number
  // Background color (gray for best contrast perception)
  backgroundColor?: string
  // Optional className for positioning
  className?: string
  // Animation - for attention/tracking exercises
  animate?: boolean
  animationSpeed?: number // rotations per second
}

/**
 * GaborPatch - A scientifically accurate Gabor patch for perceptual learning.
 */
export default function GaborPatch({
  size = 100,
  orientation = 0,
  frequency = 4,
  contrast = 1,
  sigma,
  phase = 0,
  backgroundColor = '#808080', // Mid-gray for optimal contrast perception
  className = '',
  animate = false,
  animationSpeed = 0.5
}: GaborPatchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const phaseRef = useRef(phase)
  const [layoutVersion, setLayoutVersion] = useState(0)

  // Default sigma to 1/4 of patch size for nice falloff
  const effectiveSigma = sigma ?? size / 4

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const refreshLayout = () => setLayoutVersion(version => version + 1)
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(refreshLayout)
    observer?.observe(canvas)
    window.addEventListener('resize', refreshLayout)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', refreshLayout)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const renderGabor = (currentPhase: number) => {
      fitCanvasToElement(canvas)
      ctx.clearRect(0, 0, size, size)
      drawGaborPatch(ctx, size / 2, size / 2, {
        size,
        orientation,
        frequency,
        contrast,
        sigma: effectiveSigma,
        phase: currentPhase,
        rasterMode: 'legacy-opaque',
        ...(animate ? { phaseQuantizationDegrees: 20 } : {}),
      })
    }

    if (animate) {
      let lastTime = performance.now()

      const animateFrame = (time: number) => {
        const deltaTime = (time - lastTime) / 1000 // Convert to seconds
        lastTime = time

        // Update phase based on animation speed (degrees per second)
        phaseRef.current += animationSpeed * 360 * deltaTime
        if (phaseRef.current >= 360) phaseRef.current -= 360

        renderGabor(phaseRef.current)
        animationRef.current = requestAnimationFrame(animateFrame)
      }

      animationRef.current = requestAnimationFrame(animateFrame)

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      }
    } else {
      renderGabor(phase)
    }
  }, [size, orientation, frequency, contrast, effectiveSigma, phase, animate, animationSpeed, layoutVersion])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      style={{ backgroundColor, width: size, height: size }}
    />
  )
}

/**
 * Preset configurations for common Gabor patch uses
 */
export const GABOR_PRESETS = {
  // Standard training patch - medium frequency, high contrast
  standard: {
    frequency: 4,
    contrast: 1,
    orientation: 0
  },
  // Low contrast - for threshold training
  lowContrast: {
    frequency: 4,
    contrast: 0.3,
    orientation: 0
  },
  // High frequency - for fine detail training
  highFrequency: {
    frequency: 8,
    contrast: 1,
    orientation: 0
  },
  // Low frequency - for peripheral vision training
  lowFrequency: {
    frequency: 2,
    contrast: 1,
    orientation: 0
  },
  // Tilted left (for orientation discrimination)
  tiltedLeft: {
    frequency: 4,
    contrast: 1,
    orientation: -15
  },
  // Tilted right (for orientation discrimination)
  tiltedRight: {
    frequency: 4,
    contrast: 1,
    orientation: 15
  }
}

/**
 * Generate a random orientation within a range
 */
export function randomOrientation(range: number = 180): number {
  return Math.random() * range - range / 2
}

/**
 * Generate orientations for left/right discrimination task
 * Returns orientation tilted left (-) or right (+) by the given amount
 */
export function generateTiltedOrientation(tiltAmount: number = 15): { orientation: number; isLeft: boolean } {
  const isLeft = Math.random() < 0.5
  return {
    orientation: isLeft ? -tiltAmount : tiltAmount,
    isLeft
  }
}

/**
 * Adaptive staircase for contrast threshold measurement
 * Returns next contrast level based on correct/incorrect response
 */
export class ContrastStaircase {
  private contrast: number
  private stepSize: number
  private minStep: number
  private reversals: number[]
  private lastResponse: boolean | null
  private direction: 'up' | 'down' | null

  constructor(
    initialContrast: number = 0.5,
    initialStep: number = 0.1,
    minStep: number = 0.01
  ) {
    this.contrast = initialContrast
    this.stepSize = initialStep
    this.minStep = minStep
    this.reversals = []
    this.lastResponse = null
    this.direction = null
  }

  // Update based on response (true = correct, false = incorrect)
  update(correct: boolean): number {
    const newDirection = correct ? 'down' : 'up'

    // Check for reversal
    if (this.direction !== null && this.direction !== newDirection) {
      this.reversals.push(this.contrast)
      // Reduce step size after reversal (but not below minimum)
      this.stepSize = Math.max(this.stepSize * 0.8, this.minStep)
    }

    this.direction = newDirection
    this.lastResponse = correct

    // Adjust contrast
    if (correct) {
      // Got it right - make it harder (lower contrast)
      this.contrast = Math.max(0.01, this.contrast - this.stepSize)
    } else {
      // Got it wrong - make it easier (higher contrast)
      this.contrast = Math.min(1, this.contrast + this.stepSize)
    }

    return this.contrast
  }

  getCurrentContrast(): number {
    return this.contrast
  }

  getReversalCount(): number {
    return this.reversals.length
  }

  // Get threshold estimate (average of last N reversals)
  getThresholdEstimate(lastN: number = 6): number | null {
    if (this.reversals.length < lastN) return null
    const lastReversals = this.reversals.slice(-lastN)
    return lastReversals.reduce((a, b) => a + b, 0) / lastReversals.length
  }
}
