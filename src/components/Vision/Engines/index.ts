'use client'

/**
 * Engine registry (W0.5 wiring) — maps exerciseId → interactive engine.
 * Engines are lazy-loaded so the session page doesn't pay for all of them.
 * Anything NOT in this map falls back to GuidedExercise v1 inside the
 * SessionRunner (v1-alongside-v2 doctrine — nothing ever breaks).
 * Plan: docs/plans/vision-training-interactive-overhaul.md §5 (WP4)
 */

import dynamic from 'next/dynamic'
import type { VisionEngineComponent } from './types'

const DownshiftEngine = dynamic(() => import('./DownshiftEngine'), { ssr: false }) as VisionEngineComponent
const FocusRhythmEngine = dynamic(() => import('./FocusRhythmEngine'), { ssr: false }) as VisionEngineComponent
const PursuitEngine = dynamic(() => import('./PursuitEngine'), { ssr: false }) as VisionEngineComponent
const SaccadeEngine = dynamic(() => import('./SaccadeEngine'), { ssr: false }) as VisionEngineComponent
const PeripheralEngine = dynamic(() => import('./PeripheralEngine'), { ssr: false }) as VisionEngineComponent
const SnellenWalksEngine = dynamic(() => import('./SnellenWalksEngine'), { ssr: false }) as VisionEngineComponent
const GaborAcuityEngine = dynamic(() => import('./GaborAcuityEngine'), { ssr: false }) as VisionEngineComponent

export const engineRegistry: Record<string, VisionEngineComponent> = {
  'palming-reset': DownshiftEngine,
  'box-breath-vision': DownshiftEngine,
  'focus-pushups': FocusRhythmEngine,
  'focus-trombone': FocusRhythmEngine,
  'smooth-tracking': PursuitEngine,
  'figure8-fixation': PursuitEngine,
  'eye-jumps': SaccadeEngine,
  'peripheral-pointing': PeripheralEngine,
  'mirror-scan': PeripheralEngine,
  'laterality-ladder': PeripheralEngine,
  'snellen-layering-walks': SnellenWalksEngine,
  'gabor-contrast': GaborAcuityEngine,
}

export function getEngine(exerciseId: string): VisionEngineComponent | null {
  return engineRegistry[exerciseId] ?? null
}
