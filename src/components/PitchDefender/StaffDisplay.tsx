'use client'

// Musical staff SVG renderer for Staff Defender mode
// Shows a note on treble or bass clef for the player to identify/sing

interface StaffDisplayProps {
  note: string           // e.g., "C4", "A3"
  clef: 'treble' | 'bass'
  size?: number          // overall size multiplier (default 1)
  glowColor?: string     // alien-colored glow
}

// Note positions on staff (semitones from middle C = C4)
// Staff line positions: bottom line = 0, each line/space = 0.5 step
// Treble clef: bottom line = E4, top line = F5
// Bass clef: bottom line = G2, top line = A3

// Map note to Y position on treble clef staff (0 = middle of staff)
// Each step = half a line spacing
const TREBLE_POSITIONS: Record<string, number> = {
  // Below staff (ledger lines)
  'C3': -8, 'D3': -7, 'E3': -6, 'F3': -5, 'G3': -4, 'A3': -3, 'B3': -2,
  'C4': -1, // Middle C — one ledger line below treble staff
  'D4': 0,  'E4': 1,  'F4': 2,  'G4': 3,
  'A4': 4,  'B4': 5,  'C5': 6,  'D5': 7,  'E5': 8,
  'F5': 9,  'G5': 10, 'A5': 11, 'B5': 12,
}

const BASS_POSITIONS: Record<string, number> = {
  'C2': -2, 'D2': -1, 'E2': 0,  'F2': 1,  'G2': 2,
  'A2': 3,  'B2': 4,  'C3': 5,  'D3': 6,  'E3': 7,
  'F3': 8,  'G3': 9,  'A3': 10, 'B3': 11,
  'C4': 12, // Middle C — one ledger line above bass staff
}

export default function StaffDisplay({ note, clef = 'treble', size = 1, glowColor = '#3FBFB5' }: StaffDisplayProps) {
  const positions = clef === 'treble' ? TREBLE_POSITIONS : BASS_POSITIONS
  const notePos = positions[note] ?? 0

  const w = 80 * size
  const h = 60 * size
  const lineSpacing = 8 * size
  const staffTop = 10 * size
  const staffMid = staffTop + 2 * lineSpacing // middle line of 5-line staff

  // Note Y: staffMid is position for B4 in treble (middle line)
  // Each position unit = half a lineSpacing
  const noteY = staffMid - (notePos - 5) * (lineSpacing / 2) // 5 = B4 in treble (middle line)

  // Determine if note needs ledger lines
  const needsLedgerBelow = notePos < 1  // below bottom staff line (E4 in treble)
  const needsLedgerAbove = notePos > 9  // above top staff line (F5 in treble)
  const isOnLine = notePos % 2 === 1    // odd positions are on lines

  // How many ledger lines needed
  const ledgerLinesBelow = needsLedgerBelow ? Math.ceil((1 - notePos) / 2) : 0
  const ledgerLinesAbove = needsLedgerAbove ? Math.ceil((notePos - 9) / 2) : 0

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="pointer-events-none">
      {/* Staff lines (5 lines) */}
      {[0, 1, 2, 3, 4].map(i => (
        <line
          key={i}
          x1={4 * size} y1={staffTop + i * lineSpacing}
          x2={w - 4 * size} y2={staffTop + i * lineSpacing}
          stroke="rgba(200, 200, 220, 0.5)"
          strokeWidth={1}
        />
      ))}

      {/* Clef symbol (simplified) */}
      <text
        x={8 * size}
        y={clef === 'treble' ? staffTop + 3.2 * lineSpacing : staffTop + 2 * lineSpacing}
        fill="rgba(200, 200, 220, 0.7)"
        fontSize={clef === 'treble' ? 28 * size : 20 * size}
        fontFamily="serif"
      >
        {clef === 'treble' ? '\u{1D11E}' : '\u{1D122}'}
      </text>

      {/* Ledger lines below staff */}
      {Array.from({ length: ledgerLinesBelow }).map((_, i) => {
        const ly = staffTop + 4 * lineSpacing + (i + 1) * lineSpacing
        return (
          <line key={`lb${i}`}
            x1={w / 2 - 10 * size} y1={ly}
            x2={w / 2 + 10 * size} y2={ly}
            stroke="rgba(200, 200, 220, 0.5)"
            strokeWidth={1}
          />
        )
      })}

      {/* Ledger lines above staff */}
      {Array.from({ length: ledgerLinesAbove }).map((_, i) => {
        const ly = staffTop - (i + 1) * lineSpacing
        return (
          <line key={`la${i}`}
            x1={w / 2 - 10 * size} y1={ly}
            x2={w / 2 + 10 * size} y2={ly}
            stroke="rgba(200, 200, 220, 0.5)"
            strokeWidth={1}
          />
        )
      })}

      {/* Note head */}
      <ellipse
        cx={w / 2}
        cy={noteY}
        rx={5 * size}
        ry={4 * size}
        fill={glowColor}
        stroke="white"
        strokeWidth={1}
        style={{
          filter: `drop-shadow(0 0 ${4 * size}px ${glowColor})`,
        }}
        transform={`rotate(-15 ${w / 2} ${noteY})`}
      />

      {/* Note stem */}
      <line
        x1={w / 2 + 4.5 * size}
        y1={noteY}
        x2={w / 2 + 4.5 * size}
        y2={noteY - 20 * size}
        stroke="white"
        strokeWidth={1.5 * size}
        opacity={0.8}
      />
    </svg>
  )
}
