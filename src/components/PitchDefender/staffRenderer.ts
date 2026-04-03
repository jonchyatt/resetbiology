// ═══════════════════════════════════════════════════════════════════════════════
// Staff Renderer — Pure Canvas 2D Drawing Functions
// ═══════════════════════════════════════════════════════════════════════════════
//
// Renders a musically-accurate grand staff with synesthesia colors,
// voice orb, pitch ribbon trail, accuracy rings, and note labels.
//
// Pure functions — no React, no state. Takes canvas context + data, draws.
// ═══════════════════════════════════════════════════════════════════════════════

import { NOTE_COLORS } from '@/lib/fsrs'

// ─── Layout Constants ───────────────────────────────────────────────────────

export interface StaffLayout {
  width: number
  height: number
  staffX: number            // left edge of staff lines
  staffRight: number        // right edge of staff lines
  trebleTop: number         // Y of top treble staff line
  bassBottom: number        // Y of bottom bass staff line
  lineSpacing: number       // pixels between adjacent staff lines
  trebleLines: number[]     // Y positions of 5 treble lines
  bassLines: number[]       // Y positions of 5 bass lines
  middleCY: number          // Y position of middle C (between staves)
  clefWidth: number         // space reserved for clef symbols
}

export function computeLayout(width: number, height: number): StaffLayout {
  const padding = 40
  const clefWidth = 60
  const staffX = padding + clefWidth  // room for clef symbols
  const staffRight = width - padding - 40  // room for note labels

  // Grand staff: treble on top, bass on bottom, gap in middle for middle C
  const totalStaffHeight = height * 0.65
  const staffGap = totalStaffHeight * 0.18  // gap between treble and bass
  const singleStaffHeight = (totalStaffHeight - staffGap) / 2

  const centerY = height * 0.48
  const trebleBottom = centerY - staffGap / 2
  const bassTop = centerY + staffGap / 2

  const lineSpacing = singleStaffHeight / 4  // 5 lines = 4 spaces

  const trebleLines = Array.from({ length: 5 }, (_, i) => trebleBottom - (4 - i) * lineSpacing)
  const bassLines = Array.from({ length: 5 }, (_, i) => bassTop + i * lineSpacing)

  return {
    width, height,
    staffX, staffRight,
    trebleTop: trebleLines[0],
    bassBottom: bassLines[4],
    lineSpacing,
    trebleLines,
    bassLines,
    middleCY: centerY,
    clefWidth,
  }
}

// ─── Semitone → Y Position ──────────────────────────────────────────────────
// Maps semitones-from-C4 to Y coordinate on the grand staff
// Uses diatonic (white-key) spacing — sharps/flats sit between lines

// Diatonic note positions (semitones from C within an octave → staff steps from C)
// C=0, D=1, E=2, F=3, G=4, A=5, B=6
const SEMITONE_TO_DIATONIC: Record<number, number> = {
  0: 0,   // C
  1: 0.5, // C#/Db
  2: 1,   // D
  3: 1.5, // D#/Eb
  4: 2,   // E
  5: 3,   // F
  6: 3.5, // F#/Gb
  7: 4,   // G
  8: 4.5, // G#/Ab
  9: 5,   // A
  10: 5.5, // A#/Bb
  11: 6,  // B
}

export function staffPositionToY(semitones: number, layout: StaffLayout): number {
  // semitones is continuous from C4 (0 = C4, 12 = C5, -12 = C3, etc.)
  const octaveOffset = Math.floor(semitones / 12)
  const noteInOctave = ((semitones % 12) + 12) % 12
  const diatonicPos = SEMITONE_TO_DIATONIC[Math.round(noteInOctave)] ?? noteInOctave / 2

  // Total diatonic steps from C4
  const totalDiatonic = octaveOffset * 7 + diatonicPos

  // Middle C (C4) sits on a ledger line between the staves
  // Each diatonic step = half a lineSpacing
  const halfSpace = layout.lineSpacing / 2
  return layout.middleCY - totalDiatonic * halfSpace
}

// ─── Synesthesia Color ──────────────────────────────────────────────────────

function getNoteColor(semitones: number): { hue: number; r: number; g: number; b: number } {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const idx = ((Math.round(semitones) % 12) + 12) % 12
  const octave = 4 + Math.floor(semitones / 12)
  const name = `${noteNames[idx]}${octave}`
  const color = NOTE_COLORS[name]
  const hue = color?.hue ?? (idx * 30)

  // HSL to RGB approximation for canvas
  const h = hue / 360
  const s = 0.7
  const l = 0.55
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  return {
    hue,
    r: Math.round(hue2rgb(h + 1/3) * 255),
    g: Math.round(hue2rgb(h) * 255),
    b: Math.round(hue2rgb(h - 1/3) * 255),
  }
}

// ─── Drawing Functions ──────────────────────────────────────────────────────

export function drawBackground(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
  // Deep dark background with subtle gradient
  const grad = ctx.createLinearGradient(0, 0, 0, layout.height)
  grad.addColorStop(0, '#08080f')
  grad.addColorStop(0.5, '#0a0a14')
  grad.addColorStop(1, '#06060c')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, layout.width, layout.height)
}

export function drawStaffLines(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
  ctx.strokeStyle = 'rgba(140, 150, 180, 0.4)'
  ctx.lineWidth = 1.5

  // Treble staff lines
  for (const y of layout.trebleLines) {
    ctx.beginPath()
    ctx.moveTo(layout.staffX, y)
    ctx.lineTo(layout.staffRight, y)
    ctx.stroke()
  }

  // Bass staff lines
  for (const y of layout.bassLines) {
    ctx.beginPath()
    ctx.moveTo(layout.staffX, y)
    ctx.lineTo(layout.staffRight, y)
    ctx.stroke()
  }

  // Middle C ledger line (short, dashed)
  ctx.strokeStyle = 'rgba(120, 130, 160, 0.15)'
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  const ledgerWidth = 40
  const cx = (layout.staffX + layout.staffRight) / 2
  ctx.moveTo(cx - ledgerWidth, layout.middleCY)
  ctx.lineTo(cx + ledgerWidth, layout.middleCY)
  ctx.stroke()
  ctx.setLineDash([])

  // Barline at left edge
  ctx.strokeStyle = 'rgba(120, 130, 160, 0.3)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(layout.staffX, layout.trebleLines[0])
  ctx.lineTo(layout.staffX, layout.bassLines[4])
  ctx.stroke()
}

export function drawClefs(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
  // Treble clef (𝄞) — sized to span the 5 treble staff lines
  const trebleSize = layout.lineSpacing * 3.8
  ctx.font = `${trebleSize}px serif`
  ctx.fillStyle = 'rgba(180, 190, 220, 0.6)'
  ctx.textBaseline = 'middle'
  ctx.fillText('𝄞', layout.staffX - layout.clefWidth + 10, layout.trebleLines[2] + layout.lineSpacing * 0.2)

  // Bass clef (𝄢) — sized to span the 5 bass staff lines
  const bassSize = layout.lineSpacing * 2.2
  ctx.font = `${bassSize}px serif`
  ctx.fillText('𝄢', layout.staffX - layout.clefWidth + 14, layout.bassLines[1])
}

export function drawNoteLabels(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
  // Label note names on the right edge of the staff
  const labels = [
    { name: 'C3', semi: -12 }, { name: 'E3', semi: -8 }, { name: 'G3', semi: -5 },
    { name: 'A3', semi: -3 }, { name: 'C4', semi: 0 },
    { name: 'E4', semi: 4 }, { name: 'G4', semi: 7 },
    { name: 'A4', semi: 9 }, { name: 'C5', semi: 12 },
    { name: 'E5', semi: 16 }, { name: 'G5', semi: 19 },
  ]

  ctx.font = '11px monospace'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'

  for (const { name, semi } of labels) {
    const y = staffPositionToY(semi, layout)
    const color = getNoteColor(semi)
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`
    ctx.fillText(name, layout.staffRight + 8, y)
  }
}

export function drawSynesthesiaGlow(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
  // Subtle color wash across the staff — each region tinted by its note color
  for (let semi = -15; semi <= 22; semi++) {
    const y = staffPositionToY(semi, layout)
    const color = getNoteColor(semi)
    const grad = ctx.createLinearGradient(layout.staffX, 0, layout.staffRight, 0)
    grad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
    grad.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, 0.02)`)
    grad.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, 0.02)`)
    grad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
    ctx.fillStyle = grad
    ctx.fillRect(layout.staffX, y - layout.lineSpacing / 4, layout.staffRight - layout.staffX, layout.lineSpacing / 2)
  }
}

// ─── Voice Orb ──────────────────────────────────────────────────────────────

export function drawVoiceOrb(
  ctx: CanvasRenderingContext2D,
  layout: StaffLayout,
  staffPosition: number,  // semitones from C4
  confidence: number,
  isSettled: boolean,
  isVibrato: boolean,
) {
  const y = staffPositionToY(staffPosition, layout)
  const x = (layout.staffX + layout.staffRight) / 2
  const color = getNoteColor(staffPosition)
  const radius = 12 + confidence * 6  // 12-18px based on confidence

  // Outer glow
  const glowRadius = radius * 3
  const glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, glowRadius)
  glow.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.3 * confidence})`)
  glow.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.1 * confidence})`)
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2)

  // Main orb
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  const orbGrad = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, radius)
  orbGrad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * confidence})`)
  orbGrad.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.8 * confidence})`)
  orbGrad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.3 * confidence})`)
  ctx.fillStyle = orbGrad
  ctx.fill()

  // Settled ring
  if (isSettled) {
    ctx.strokeStyle = `rgba(100, 255, 160, ${0.6 * confidence})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Vibrato shimmer — pulsing ring
  if (isVibrato) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 80)
    ctx.strokeStyle = `rgba(200, 180, 255, ${0.4 * pulse})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, radius + 8 + pulse * 4, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Ledger lines for the orb position (if outside staff)
  drawLedgerLinesAt(ctx, layout, staffPosition, x)
}

function drawLedgerLinesAt(ctx: CanvasRenderingContext2D, layout: StaffLayout, semi: number, centerX: number) {
  ctx.strokeStyle = 'rgba(120, 130, 160, 0.3)'
  ctx.lineWidth = 1.5
  const ledgerW = 24

  // Notes above treble staff
  const topStaffSemi = 17 // F5 = top treble line
  if (semi > topStaffSemi) {
    for (let s = topStaffSemi + 2; s <= semi + 1; s += 2) {
      // Only draw on line positions (even diatonic steps from a line)
      const diatonicCheck = SEMITONE_TO_DIATONIC[((s % 12) + 12) % 12]
      if (diatonicCheck !== undefined && diatonicCheck % 1 === 0) {
        const ly = staffPositionToY(s, layout)
        ctx.beginPath()
        ctx.moveTo(centerX - ledgerW, ly)
        ctx.lineTo(centerX + ledgerW, ly)
        ctx.stroke()
      }
    }
  }

  // Notes below bass staff (similar logic)
  const bottomStaffSemi = -17 // G2 = bottom bass line
  if (semi < bottomStaffSemi) {
    for (let s = bottomStaffSemi - 2; s >= semi - 1; s -= 2) {
      const diatonicCheck = SEMITONE_TO_DIATONIC[((s % 12) + 12) % 12]
      if (diatonicCheck !== undefined && diatonicCheck % 1 === 0) {
        const ly = staffPositionToY(s, layout)
        ctx.beginPath()
        ctx.moveTo(centerX - ledgerW, ly)
        ctx.lineTo(centerX + ledgerW, ly)
        ctx.stroke()
      }
    }
  }
}

// ─── Pitch Ribbon Trail ─────────────────────────────────────────────────────

export interface TrailPoint {
  staffPosition: number
  confidence: number
  timestamp: number
}

export function drawPitchTrail(
  ctx: CanvasRenderingContext2D,
  layout: StaffLayout,
  trail: TrailPoint[],
  trailDurationMs: number = 3000,
) {
  if (trail.length < 2) return

  const now = performance.now()
  const startX = layout.staffX + layout.clefWidth + 20
  const endX = (layout.staffX + layout.staffRight) / 2 - 30  // stop before voice orb

  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (let i = 1; i < trail.length; i++) {
    const prev = trail[i - 1]
    const curr = trail[i]
    const age = now - curr.timestamp
    if (age > trailDurationMs) continue

    const alpha = Math.max(0, 1 - age / trailDurationMs) * curr.confidence * 0.6
    const t = 1 - age / trailDurationMs  // 0 = old, 1 = new

    // X position based on age (newest = rightmost, oldest = leftmost)
    const x1 = startX + (endX - startX) * (1 - (now - prev.timestamp) / trailDurationMs)
    const x2 = startX + (endX - startX) * t

    const y1 = staffPositionToY(prev.staffPosition, layout)
    const y2 = staffPositionToY(curr.staffPosition, layout)

    const color = getNoteColor(curr.staffPosition)
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
    ctx.lineWidth = 2 + curr.confidence * 3

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
}

// ─── Target Note ────────────────────────────────────────────────────────────

export function drawTargetNote(
  ctx: CanvasRenderingContext2D,
  layout: StaffLayout,
  semitones: number,
  proximityFactor: number,  // 0 = far, 1 = matched (drives bloom effect)
) {
  const y = staffPositionToY(semitones, layout)
  const x = (layout.staffX + layout.staffRight) / 2
  const color = getNoteColor(semitones)

  // Accuracy rings (bullseye)
  const rings = [
    { radius: 40, color: `rgba(${color.r}, ${color.g}, ${color.b}, 0.05)`, label: '±50c' },
    { radius: 28, color: `rgba(${color.r}, ${color.g}, ${color.b}, 0.08)`, label: '±25c' },
    { radius: 16, color: `rgba(${color.r}, ${color.g}, ${color.b}, 0.12)`, label: '±10c' },
  ]

  for (const ring of rings) {
    ctx.beginPath()
    ctx.arc(x, y, ring.radius, 0, Math.PI * 2)
    ctx.fillStyle = ring.color
    ctx.fill()
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.15)`
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Proximity bloom — target glows brighter as voice approaches
  if (proximityFactor > 0) {
    const bloomRadius = 50 * proximityFactor
    const bloom = ctx.createRadialGradient(x, y, 0, x, y, bloomRadius)
    bloom.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.3 * proximityFactor})`)
    bloom.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = bloom
    ctx.fillRect(x - bloomRadius, y - bloomRadius, bloomRadius * 2, bloomRadius * 2)
  }

  // Note head (hollow oval)
  ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${0.5 + 0.5 * proximityFactor})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(x, y, 8, 6, -0.3, 0, Math.PI * 2)
  ctx.stroke()

  // Note name label
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const idx = ((Math.round(semitones) % 12) + 12) % 12
  const octave = 4 + Math.floor(semitones / 12)
  const name = `${noteNames[idx]}${octave}`

  ctx.font = 'bold 13px monospace'
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${0.6 + 0.4 * proximityFactor})`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(name, x, y + 14)

  // Ledger lines if needed
  drawLedgerLinesAt(ctx, layout, semitones, x)
}

// ─── Cents Deviation Indicator ──────────────────────────────────────────────

export function drawCentsIndicator(
  ctx: CanvasRenderingContext2D,
  layout: StaffLayout,
  cents: number,
  confidence: number,
) {
  const x = layout.staffRight - 50
  const centerY = layout.height / 2
  const barHeight = 80

  // Track
  ctx.fillStyle = 'rgba(30, 30, 50, 0.5)'
  ctx.fillRect(x - 4, centerY - barHeight / 2, 8, barHeight)

  // Center line
  ctx.fillStyle = 'rgba(100, 255, 160, 0.3)'
  ctx.fillRect(x - 8, centerY - 1, 16, 2)

  // Marker
  const markerY = centerY - (cents / 50) * (barHeight / 2)
  const clampedY = Math.max(centerY - barHeight / 2, Math.min(centerY + barHeight / 2, markerY))
  const isClose = Math.abs(cents) <= 10
  const markerColor = isClose ? 'rgba(100, 255, 160, 0.9)' : Math.abs(cents) <= 25 ? 'rgba(255, 200, 60, 0.8)' : 'rgba(255, 80, 80, 0.7)'

  ctx.beginPath()
  ctx.arc(x, clampedY, 5, 0, Math.PI * 2)
  ctx.fillStyle = markerColor
  ctx.fill()

  // Cents text
  ctx.font = '11px monospace'
  ctx.fillStyle = markerColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${cents > 0 ? '+' : ''}${cents}c`, x, clampedY - 12)
}

// ─── Full Staff Render ──────────────────────────────────────────────────────

export interface StaffRenderData {
  voiceActive: boolean
  staffPosition: number     // semitones from C4
  confidence: number
  cents: number
  isSettled: boolean
  isVibrato: boolean
  trail: TrailPoint[]
  targetNote?: number       // semitones from C4 (optional target)
}

export function renderStaff(
  ctx: CanvasRenderingContext2D,
  layout: StaffLayout,
  data: StaffRenderData,
) {
  ctx.clearRect(0, 0, layout.width, layout.height)

  drawBackground(ctx, layout)
  drawSynesthesiaGlow(ctx, layout)
  drawStaffLines(ctx, layout)
  drawClefs(ctx, layout)
  drawNoteLabels(ctx, layout)

  // Pitch trail (draw before orb so orb is on top)
  drawPitchTrail(ctx, layout, data.trail)

  // Target note with proximity bloom
  if (data.targetNote !== undefined && data.voiceActive) {
    const proximity = Math.max(0, 1 - Math.abs(data.staffPosition - data.targetNote) / 6)
    drawTargetNote(ctx, layout, data.targetNote, proximity)
  } else if (data.targetNote !== undefined) {
    drawTargetNote(ctx, layout, data.targetNote, 0)
  }

  // Voice orb
  if (data.voiceActive) {
    drawVoiceOrb(ctx, layout, data.staffPosition, data.confidence, data.isSettled, data.isVibrato)
    drawCentsIndicator(ctx, layout, data.cents, data.confidence)
  }
}
