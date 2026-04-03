// ═══════════════════════════════════════════════════════════════════════════════
// Staff Renderer — Pure Canvas 2D Drawing Functions
// ═══════════════════════════════════════════════════════════════════════════════
//
// Renders a musically-accurate grand staff with proper engraving:
// - Canvas-drawn treble & bass clefs (not Unicode)
// - 4/4 time signature
// - Curly brace connecting staves
// - Proper filled note heads with stems
// - Synesthesia colors, voice orb, pitch ribbon trail
//
// Pure functions — no React, no state. Takes canvas context + data, draws.
// ═══════════════════════════════════════════════════════════════════════════════

import { NOTE_COLORS } from '@/lib/fsrs'

// ─── Layout Constants ───────────────────────────────────────────────────────

export interface StaffLayout {
  width: number
  height: number
  staffX: number            // left edge of staff lines (music area)
  staffRight: number        // right edge of staff lines
  trebleTop: number         // Y of top treble staff line
  bassBottom: number        // Y of bottom bass staff line
  lineSpacing: number       // pixels between adjacent staff lines
  trebleLines: number[]     // Y positions of 5 treble lines
  bassLines: number[]       // Y positions of 5 bass lines
  middleCY: number          // Y position of middle C (between staves)
  clefWidth: number         // space reserved for clef symbols
  clefX: number             // X where clef drawing starts
  timeSigX: number          // X where time signature starts
  braceX: number            // X for the curly brace
  noteHeadRx: number        // note head ellipse horizontal radius
  noteHeadRy: number        // note head ellipse vertical radius
}

export function computeLayout(width: number, height: number): StaffLayout {
  const padding = 36
  // Reserve space proportional to staff size (bounded for small/large screens)
  const lineSpacingEst = (height * 0.62 * 0.82 / 2) / 4  // estimate before full calc
  const clefAreaWidth = Math.max(Math.min(lineSpacingEst * 1.8, 82), 46)
  const timeSigAreaWidth = Math.max(Math.min(lineSpacingEst * 0.85, 38), 22)
  const staffX = padding + clefAreaWidth + timeSigAreaWidth
  const staffRight = width - padding - 44

  // Grand staff: treble on top, bass on bottom, gap in middle for middle C
  const totalStaffHeight = height * 0.62
  const staffGap = totalStaffHeight * 0.18
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
    clefWidth: clefAreaWidth,
    clefX: padding + 4,
    timeSigX: padding + clefAreaWidth + 4,
    braceX: padding - 2,
    noteHeadRx: lineSpacing * 0.62,
    noteHeadRy: lineSpacing * 0.44,
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

// ─── Background ─────────────────────────────────────────────────────────────

export function drawBackground(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
  const grad = ctx.createLinearGradient(0, 0, 0, layout.height)
  grad.addColorStop(0, '#08080f')
  grad.addColorStop(0.5, '#0a0a14')
  grad.addColorStop(1, '#06060c')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, layout.width, layout.height)
}

// ─── Curly Brace ────────────────────────────────────────────────────────────

function drawBrace(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
  const x = layout.braceX
  const topY = layout.trebleLines[0]
  const bottomY = layout.bassLines[4]
  const midY = (topY + bottomY) / 2
  const halfH = (bottomY - topY) / 2

  ctx.save()
  ctx.strokeStyle = 'rgba(180, 195, 230, 0.6)'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Upper half of brace
  ctx.beginPath()
  ctx.moveTo(x + 4, topY)
  ctx.bezierCurveTo(
    x - 4, topY + halfH * 0.3,
    x - 4, midY - halfH * 0.15,
    x - 8, midY,
  )
  ctx.stroke()

  // Lower half of brace
  ctx.beginPath()
  ctx.moveTo(x - 8, midY)
  ctx.bezierCurveTo(
    x - 4, midY + halfH * 0.15,
    x - 4, bottomY - halfH * 0.3,
    x + 4, bottomY,
  )
  ctx.stroke()

  // Tip at center
  ctx.beginPath()
  ctx.arc(x - 9, midY, 1.5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(180, 195, 230, 0.6)'
  ctx.fill()

  ctx.restore()
}

// ─── Staff Lines ────────────────────────────────────────────────────────────

export function drawStaffLines(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
  ctx.strokeStyle = 'rgba(160, 172, 210, 0.6)'
  ctx.lineWidth = 1.8

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

  // Middle C ledger line (short, dashed, more visible than before)
  ctx.strokeStyle = 'rgba(140, 155, 190, 0.22)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([8, 5])
  ctx.beginPath()
  const ledgerWidth = 50
  const cx = (layout.staffX + layout.staffRight) / 2
  ctx.moveTo(cx - ledgerWidth, layout.middleCY)
  ctx.lineTo(cx + ledgerWidth, layout.middleCY)
  ctx.stroke()
  ctx.setLineDash([])

  // Barline at left edge — thin + thick double barline
  ctx.strokeStyle = 'rgba(160, 172, 210, 0.45)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(layout.staffX, layout.trebleLines[0])
  ctx.lineTo(layout.staffX, layout.trebleLines[4])
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(layout.staffX, layout.bassLines[0])
  ctx.lineTo(layout.staffX, layout.bassLines[4])
  ctx.stroke()

  // Connecting barline between staves (thin)
  ctx.strokeStyle = 'rgba(140, 155, 190, 0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(layout.staffX, layout.trebleLines[4])
  ctx.lineTo(layout.staffX, layout.bassLines[0])
  ctx.stroke()
}

// ─── Treble Clef (Canvas Path) ──────────────────────────────────────────────

function drawTrebleClef(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
  // G line = 2nd from bottom of treble staff = trebleLines[3]
  const gY = layout.trebleLines[3]
  const ls = layout.lineSpacing
  // Center the clef horizontally in the clef area
  const cx = layout.clefX + Math.min(ls * 0.9, 28)

  ctx.save()
  ctx.strokeStyle = 'rgba(200, 215, 245, 0.88)'
  ctx.fillStyle = 'rgba(200, 215, 245, 0.88)'
  ctx.lineWidth = Math.max(ls * 0.13, 2.2)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // === One continuous stroke: bottom hook → up → top cap → down → spiral ===
  ctx.beginPath()

  // 1. Bottom hook
  ctx.moveTo(cx + ls * 0.3, gY + ls * 3.0)
  ctx.bezierCurveTo(
    cx - ls * 0.1, gY + ls * 3.15,
    cx - ls * 0.35, gY + ls * 2.5,
    cx - ls * 0.1, gY + ls * 1.8,
  )

  // 2. Rise up through the staff curving gently right
  ctx.bezierCurveTo(
    cx + ls * 0.15, gY + ls * 0.8,
    cx + ls * 0.45, gY - ls * 0.3,
    cx + ls * 0.35, gY - ls * 1.8,
  )

  // 3. Continue up past top of staff, curving left
  ctx.bezierCurveTo(
    cx + ls * 0.25, gY - ls * 3.0,
    cx - ls * 0.1, gY - ls * 4.0,
    cx + ls * 0.05, gY - ls * 4.3,
  )

  // 4. Top cap — small hook curving right then back
  ctx.bezierCurveTo(
    cx + ls * 0.35, gY - ls * 4.65,
    cx + ls * 0.45, gY - ls * 4.0,
    cx + ls * 0.15, gY - ls * 3.4,
  )

  // 5. Descend back down through center of staff
  ctx.bezierCurveTo(
    cx - ls * 0.15, gY - ls * 2.3,
    cx - ls * 0.5, gY - ls * 0.8,
    cx - ls * 0.4, gY + ls * 0.2,
  )

  // 6. The spiral: curve right and below G line
  ctx.bezierCurveTo(
    cx - ls * 0.25, gY + ls * 1.0,
    cx + ls * 0.35, gY + ls * 1.3,
    cx + ls * 0.6, gY + ls * 0.65,
  )

  // 7. Spiral continues: up past G line going right (tighter)
  ctx.bezierCurveTo(
    cx + ls * 0.8, gY + ls * 0.05,
    cx + ls * 0.65, gY - ls * 0.55,
    cx + ls * 0.25, gY - ls * 0.5,
  )

  // 8. Spiral closes: curves left and slightly down
  ctx.bezierCurveTo(
    cx - ls * 0.05, gY - ls * 0.45,
    cx - ls * 0.35, gY - ls * 0.1,
    cx - ls * 0.3, gY + ls * 0.15,
  )

  ctx.stroke()

  // Bottom dot
  ctx.beginPath()
  ctx.arc(cx + ls * 0.15, gY + ls * 3.1, Math.max(ls * 0.16, 2.5), 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

// ─── Bass Clef (Canvas Path) ────────────────────────────────────────────────

function drawBassClef(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
  // F line = 2nd from top of bass staff = bassLines[1]
  const fY = layout.bassLines[1]
  const ls = layout.lineSpacing
  const cx = layout.clefX + Math.min(ls * 0.7, 22)

  ctx.save()
  ctx.strokeStyle = 'rgba(200, 215, 245, 0.88)'
  ctx.fillStyle = 'rgba(200, 215, 245, 0.88)'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Main body: filled dot at F line
  const dotR = Math.max(ls * 0.3, 4)
  ctx.beginPath()
  ctx.arc(cx, fY, dotR, 0, Math.PI * 2)
  ctx.fill()

  // Curved tail going right then down
  ctx.lineWidth = Math.max(ls * 0.12, 2)
  ctx.beginPath()
  ctx.moveTo(cx + dotR, fY - ls * 0.1)
  ctx.bezierCurveTo(
    cx + ls * 0.9, fY - ls * 0.5,
    cx + ls * 1.1, fY + ls * 0.3,
    cx + ls * 0.7, fY + ls * 1.3,
  )
  ctx.bezierCurveTo(
    cx + ls * 0.4, fY + ls * 2.0,
    cx - ls * 0.2, fY + ls * 2.3,
    cx - ls * 0.5, fY + ls * 1.8,
  )
  ctx.stroke()

  // Two dots flanking the F line
  const dotPairX = cx + ls * 1.15
  const dotPairR = Math.max(ls * 0.12, 2)
  ctx.beginPath()
  ctx.arc(dotPairX, fY - ls * 0.42, dotPairR, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(dotPairX, fY + ls * 0.42, dotPairR, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

// ─── Clefs (combined) ───────────────────────────────────────────────────────

export function drawClefs(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
  drawTrebleClef(ctx, layout)
  drawBassClef(ctx, layout)
}

// ─── Time Signature ─────────────────────────────────────────────────────────

function drawTimeSignature(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
  const ls = layout.lineSpacing
  const fontSize = Math.max(ls * 1.5, 16)
  const x = layout.timeSigX + Math.min(ls * 0.45, 12)

  ctx.save()
  ctx.fillStyle = 'rgba(200, 215, 245, 0.78)'
  ctx.font = `${fontSize}px 'Georgia', 'Times New Roman', serif`
  ctx.textAlign = 'center'

  // Treble staff: "4" on top half, "4" on bottom half
  const trebleMid = (layout.trebleLines[0] + layout.trebleLines[4]) / 2
  ctx.textBaseline = 'bottom'
  ctx.fillText('4', x, trebleMid + 2)
  ctx.textBaseline = 'top'
  ctx.fillText('4', x, trebleMid - 2)

  // Bass staff: "4" on top half, "4" on bottom half
  const bassMid = (layout.bassLines[0] + layout.bassLines[4]) / 2
  ctx.textBaseline = 'bottom'
  ctx.fillText('4', x, bassMid + 2)
  ctx.textBaseline = 'top'
  ctx.fillText('4', x, bassMid - 2)

  ctx.restore()
}

// ─── Note Labels ────────────────────────────────────────────────────────────

export function drawNoteLabels(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
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
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`
    ctx.fillText(name, layout.staffRight + 10, y)
  }
}

// ─── Synesthesia Glow ───────────────────────────────────────────────────────

export function drawSynesthesiaGlow(ctx: CanvasRenderingContext2D, layout: StaffLayout) {
  for (let semi = -15; semi <= 22; semi++) {
    const y = staffPositionToY(semi, layout)
    const color = getNoteColor(semi)
    const grad = ctx.createLinearGradient(layout.staffX, 0, layout.staffRight, 0)
    grad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
    grad.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, 0.025)`)
    grad.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, 0.025)`)
    grad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
    ctx.fillStyle = grad
    ctx.fillRect(layout.staffX, y - layout.lineSpacing / 4, layout.staffRight - layout.staffX, layout.lineSpacing / 2)
  }
}

// ─── Note Head Drawing ──────────────────────────────────────────────────────

const NOTE_ROTATION = -0.32  // ~-18 degrees, standard music engraving tilt

export function drawNoteHeadWithStem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  layout: StaffLayout,
  fillColor: string,
  strokeColor: string,
  options: {
    filled?: boolean
    showStem?: boolean
    scale?: number
    alpha?: number
  } = {},
) {
  const { filled = true, showStem = true, scale = 1, alpha = 1 } = options
  const rx = layout.noteHeadRx * scale
  const ry = layout.noteHeadRy * scale

  // Note head — tilted filled/hollow ellipse
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(NOTE_ROTATION)

  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)

  if (filled) {
    ctx.fillStyle = fillColor
    ctx.fill()
  }
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = Math.max(ry * 0.18, 1.2)
  ctx.stroke()
  ctx.restore()

  // Stem
  if (showStem) {
    // Stem direction: standard engraving — on/below staff middle line → up, above → down
    const staffDivide = (layout.trebleLines[4] + layout.bassLines[0]) / 2
    let stemUp: boolean
    if (y <= staffDivide) {
      // Treble staff region: middle line = B4 (trebleLines[2])
      stemUp = y >= layout.trebleLines[2]
    } else {
      // Bass staff region: middle line = D3 (bassLines[2])
      stemUp = y >= layout.bassLines[2]
    }
    const stemLength = layout.lineSpacing * 3.5 * scale
    const stemX = stemUp
      ? x + rx * 0.88  // right edge for stem up
      : x - rx * 0.88  // left edge for stem down

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = Math.max(2.0 * scale, 1.5)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(stemX, y)
    ctx.lineTo(stemX, stemUp ? y - stemLength : y + stemLength)
    ctx.stroke()
    ctx.restore()
  }
}

// ─── Ledger Lines ───────────────────────────────────────────────────────────

function drawLedgerLinesAt(ctx: CanvasRenderingContext2D, layout: StaffLayout, semi: number, centerX: number) {
  ctx.strokeStyle = 'rgba(160, 172, 210, 0.4)'
  ctx.lineWidth = 1.8
  const ledgerW = layout.noteHeadRx * 1.6

  // Notes above treble staff
  const topStaffSemi = 17 // F5 = top treble line
  if (semi > topStaffSemi) {
    for (let s = topStaffSemi + 2; s <= semi + 1; s += 2) {
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

  // Notes below bass staff
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

  // Middle C ledger line (between staves)
  if (Math.abs(semi) <= 1) {
    ctx.strokeStyle = 'rgba(180, 192, 225, 0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(centerX - ledgerW, layout.middleCY)
    ctx.lineTo(centerX + ledgerW, layout.middleCY)
    ctx.stroke()
  }
}

// ─── Voice Orb ──────────────────────────────────────────────────────────────

export function drawVoiceOrb(
  ctx: CanvasRenderingContext2D,
  layout: StaffLayout,
  staffPosition: number,
  confidence: number,
  isSettled: boolean,
  isVibrato: boolean,
) {
  const y = staffPositionToY(staffPosition, layout)
  const x = (layout.staffX + layout.staffRight) / 2
  const color = getNoteColor(staffPosition)
  const radius = 12 + confidence * 6

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

  // Ledger lines for the orb position
  drawLedgerLinesAt(ctx, layout, staffPosition, x)
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
  const endX = (layout.staffX + layout.staffRight) / 2 - 30

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (let i = 1; i < trail.length; i++) {
    const prev = trail[i - 1]
    const curr = trail[i]
    const age = now - curr.timestamp
    if (age > trailDurationMs) continue

    const alpha = Math.max(0, 1 - age / trailDurationMs) * curr.confidence * 0.6
    const t = 1 - age / trailDurationMs

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
  proximityFactor: number,
) {
  const y = staffPositionToY(semitones, layout)
  const x = (layout.staffX + layout.staffRight) / 2
  const color = getNoteColor(semitones)
  const colorStr = `rgb(${color.r}, ${color.g}, ${color.b})`

  // Accuracy rings (subtle bullseye)
  const rings = [
    { radius: 40, alpha: 0.04 },
    { radius: 28, alpha: 0.06 },
    { radius: 16, alpha: 0.10 },
  ]

  for (const ring of rings) {
    ctx.beginPath()
    ctx.arc(x, y, ring.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${ring.alpha})`
    ctx.fill()
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.12)`
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Proximity bloom
  if (proximityFactor > 0) {
    const bloomRadius = 50 * proximityFactor
    const bloom = ctx.createRadialGradient(x, y, 0, x, y, bloomRadius)
    bloom.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.3 * proximityFactor})`)
    bloom.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = bloom
    ctx.fillRect(x - bloomRadius, y - bloomRadius, bloomRadius * 2, bloomRadius * 2)
  }

  // Proper note head with stem — ensure minimum visibility even without voice
  const noteAlpha = 0.55 + 0.45 * proximityFactor
  const stemAlpha = Math.max(noteAlpha, 0.6)
  drawNoteHeadWithStem(
    ctx, x, y, layout,
    `rgba(${color.r}, ${color.g}, ${color.b}, ${noteAlpha})`,
    `rgba(${color.r}, ${color.g}, ${color.b}, ${stemAlpha})`,
    { filled: true, showStem: true, alpha: 1 },
  )

  // Note name label
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const idx = ((Math.round(semitones) % 12) + 12) % 12
  const octave = 4 + Math.floor(semitones / 12)
  const name = `${noteNames[idx]}${octave}`

  ctx.font = 'bold 13px monospace'
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${0.6 + 0.4 * proximityFactor})`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(name, x, y + layout.noteHeadRy + 16)

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
  staffPosition: number
  confidence: number
  cents: number
  isSettled: boolean
  isVibrato: boolean
  trail: TrailPoint[]
  targetNote?: number
}

export function renderStaff(
  ctx: CanvasRenderingContext2D,
  layout: StaffLayout,
  data: StaffRenderData,
) {
  ctx.clearRect(0, 0, layout.width, layout.height)

  drawBackground(ctx, layout)
  drawSynesthesiaGlow(ctx, layout)
  drawBrace(ctx, layout)
  drawStaffLines(ctx, layout)
  drawClefs(ctx, layout)
  drawTimeSignature(ctx, layout)
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
