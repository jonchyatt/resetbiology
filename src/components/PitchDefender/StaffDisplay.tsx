'use client'

// Musical staff SVG renderer for Staff Defender mode
// Shows a note on treble or bass clef for the player to identify/sing
// Professional engraving: proper note head proportions, stem direction, clef sizing

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

const TREBLE_POSITIONS: Record<string, number> = {
  'C3': -8, 'D3': -7, 'E3': -6, 'F3': -5, 'G3': -4, 'A3': -3, 'B3': -2,
  'C4': -1,
  'D4': 0,  'E4': 1,  'F4': 2,  'G4': 3,
  'A4': 4,  'B4': 5,  'C5': 6,  'D5': 7,  'E5': 8,
  'F5': 9,  'G5': 10, 'A5': 11, 'B5': 12,
}

const BASS_POSITIONS: Record<string, number> = {
  'C2': -2, 'D2': -1, 'E2': 0,  'F2': 1,  'G2': 2,
  'A2': 3,  'B2': 4,  'C3': 5,  'D3': 6,  'E3': 7,
  'F3': 8,  'G3': 9,  'A3': 10, 'B3': 11,
  'C4': 12,
}

export default function StaffDisplay({ note, clef = 'treble', size = 1, glowColor = '#3FBFB5' }: StaffDisplayProps) {
  const positions = clef === 'treble' ? TREBLE_POSITIONS : BASS_POSITIONS
  const notePos = positions[note] ?? 0

  const w = 88 * size
  const h = 64 * size
  const lineSpacing = 8.5 * size
  const staffTop = 11 * size
  const staffMid = staffTop + 2 * lineSpacing // middle line of 5-line staff

  // Note Y: staffMid is position for B4 in treble (middle line)
  // Each position unit = half a lineSpacing
  const noteY = staffMid - (notePos - 5) * (lineSpacing / 2)

  // Stem direction: below middle line (pos <= 5) = stem up, above = stem down
  const stemUp = notePos <= 5

  // Note head dimensions (proper music engraving proportions)
  const noteRx = 5.5 * size   // ~1.2 staff spaces wide
  const noteRy = 3.8 * size   // ~0.85 staff spaces tall
  const noteRotation = -18     // degrees, standard tilt

  // Stem dimensions
  const stemLength = 22 * size  // ~3.5 staff spaces
  const stemX = stemUp
    ? w / 2 + noteRx * 0.88
    : w / 2 - noteRx * 0.88
  const stemY1 = noteY
  const stemY2 = stemUp ? noteY - stemLength : noteY + stemLength

  // Ledger lines
  const needsLedgerBelow = notePos < 1
  const needsLedgerAbove = notePos > 9
  const ledgerLinesBelow = needsLedgerBelow ? Math.ceil((1 - notePos) / 2) : 0
  const ledgerLinesAbove = needsLedgerAbove ? Math.ceil((notePos - 9) / 2) : 0

  // Clef positioning
  const clefX = 9 * size
  const trebleClefY = staffTop + 3 * lineSpacing  // G line area
  const bassClefY = staffTop + 1.5 * lineSpacing   // F line area

  // Time signature position
  const timeSigX = 25 * size

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="pointer-events-none">
      {/* Staff lines — more visible */}
      {[0, 1, 2, 3, 4].map(i => (
        <line
          key={i}
          x1={4 * size} y1={staffTop + i * lineSpacing}
          x2={w - 4 * size} y2={staffTop + i * lineSpacing}
          stroke="rgba(200, 210, 240, 0.55)"
          strokeWidth={1.2 * size}
        />
      ))}

      {/* Left barline */}
      <line
        x1={4 * size} y1={staffTop}
        x2={4 * size} y2={staffTop + 4 * lineSpacing}
        stroke="rgba(200, 210, 240, 0.4)"
        strokeWidth={1.2 * size}
      />

      {/* Clef symbol — larger, better positioned */}
      <text
        x={clefX}
        y={clef === 'treble' ? trebleClefY : bassClefY}
        fill="rgba(200, 215, 245, 0.82)"
        fontSize={clef === 'treble' ? 32 * size : 22 * size}
        fontFamily="'Times New Roman', 'Georgia', serif"
        dominantBaseline="central"
      >
        {clef === 'treble' ? '\u{1D11E}' : '\u{1D122}'}
      </text>

      {/* Time signature — compact "4/4" */}
      <text
        x={timeSigX}
        y={staffTop + 1.3 * lineSpacing}
        fill="rgba(200, 215, 245, 0.7)"
        fontSize={9 * size}
        fontWeight="bold"
        fontFamily="'Georgia', serif"
        textAnchor="middle"
        dominantBaseline="central"
      >
        4
      </text>
      <text
        x={timeSigX}
        y={staffTop + 2.7 * lineSpacing}
        fill="rgba(200, 215, 245, 0.7)"
        fontSize={9 * size}
        fontWeight="bold"
        fontFamily="'Georgia', serif"
        textAnchor="middle"
        dominantBaseline="central"
      >
        4
      </text>

      {/* Ledger lines below staff */}
      {Array.from({ length: ledgerLinesBelow }).map((_, i) => {
        const ly = staffTop + 4 * lineSpacing + (i + 1) * lineSpacing
        return (
          <line key={`lb${i}`}
            x1={w / 2 - 10 * size} y1={ly}
            x2={w / 2 + 10 * size} y2={ly}
            stroke="rgba(200, 210, 240, 0.55)"
            strokeWidth={1.2 * size}
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
            stroke="rgba(200, 210, 240, 0.55)"
            strokeWidth={1.2 * size}
          />
        )
      })}

      {/* Note head — proper filled ellipse with tilt */}
      <ellipse
        cx={w / 2}
        cy={noteY}
        rx={noteRx}
        ry={noteRy}
        fill={glowColor}
        stroke="white"
        strokeWidth={0.8 * size}
        style={{
          filter: `drop-shadow(0 0 ${4 * size}px ${glowColor})`,
        }}
        transform={`rotate(${noteRotation} ${w / 2} ${noteY})`}
      />

      {/* Note stem — correct side based on position */}
      <line
        x1={stemX}
        y1={stemY1}
        x2={stemX}
        y2={stemY2}
        stroke="white"
        strokeWidth={1.4 * size}
        opacity={0.85}
        strokeLinecap="round"
      />
    </svg>
  )
}
