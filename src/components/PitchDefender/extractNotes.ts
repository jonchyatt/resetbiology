// ═══════════════════════════════════════════════════════════════════════════════
// extractNotes — Shared OSMD note extraction utility
// ═══════════════════════════════════════════════════════════════════════════════
//
// Parses MusicXML via OSMD and extracts individual notes with pitch, duration,
// measure number, and part assignment. Used by:
// - Choir Practice Coach (guided sing-along)
// - NoteRunner / Synthesia mode (scrolling game)
// - Pitchforks (interval-based game levels)
// - Rhythm Clap (rhythm extraction)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExtractedNote {
  pitch: string         // e.g., "C4", "D#5"
  semitones: number     // from C4 (0 = C4, 2 = D4, etc.)
  frequency: number     // Hz
  duration: number      // beats (1 = quarter, 0.5 = eighth, etc.)
  measure: number       // measure number (1-based)
  partIndex: number     // which SATB part
  partName: string      // "Soprano", "Alto", etc.
  isRest: boolean
}

export interface ExtractionResult {
  notes: ExtractedNote[]
  parts: string[]
  tempo: number
  title: string
}

const NOTE_NAMES_ALL = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function pitchToSemitones(step: string, octave: number, accidental: number): number {
  const baseIdx = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(step)
  const semitoneMap = [0, 2, 4, 5, 7, 9, 11]
  return semitoneMap[baseIdx] + accidental + (octave - 4) * 12
}

function semitonesToFreq(semi: number): number {
  return 261.63 * Math.pow(2, semi / 12)
}

export async function extractNotesFromXML(xmlData: string | Uint8Array): Promise<ExtractionResult> {
  const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')

  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:800px'
  document.body.appendChild(container)

  try {
    const osmd = new OpenSheetMusicDisplay(container, {
      autoResize: false,
      drawTitle: false,
      drawingParameters: 'compact',
      disableCursor: false,
    })

    if (xmlData instanceof Uint8Array) {
      await osmd.load(xmlData as any)
    } else {
      await osmd.load(xmlData)
    }
    osmd.render()

    const notes: ExtractedNote[] = []
    const partNames: string[] = []

    const sheetParts = osmd.Sheet?.Parts || []
    for (const p of sheetParts) {
      partNames.push(p.Name || p.NameLabel?.text || 'Part')
    }

    let tempo = 100
    try {
      const firstMeasure = osmd.Sheet?.SourceMeasures?.[0]
      if (firstMeasure?.TempoInBPM) tempo = firstMeasure.TempoInBPM
    } catch {}

    const title = osmd.Sheet?.TitleString || 'Untitled'

    const cursor = osmd.cursor
    cursor.show()
    cursor.reset()

    let measureNum = 1
    let lastMeasureIdx = -1

    while (!cursor.Iterator.EndReached) {
      const iter = cursor.Iterator
      const currentMeasureIdx = iter.CurrentMeasureIndex
      if (currentMeasureIdx !== lastMeasureIdx) {
        measureNum = currentMeasureIdx + 1
        lastMeasureIdx = currentMeasureIdx
      }

      try {
        const voiceEntries = iter.CurrentVoiceEntries || []
        for (const ve of voiceEntries) {
          const veNotes = ve.Notes || []
          for (const note of veNotes) {
            if (!note.Pitch && !note.isRest()) continue

            let partIdx = 0
            try {
              const staff = note.ParentStaffEntry?.ParentStaff
              if (staff) {
                partIdx = sheetParts.findIndex((p: any) => p.Staves?.includes(staff))
                if (partIdx < 0) partIdx = 0
              }
            } catch {}

            if (note.isRest()) {
              const durBeats = note.Length?.RealValue ? note.Length.RealValue * 4 : 1
              notes.push({
                pitch: 'rest',
                semitones: 0,
                frequency: 0,
                duration: durBeats,
                measure: measureNum,
                partIndex: partIdx,
                partName: partNames[partIdx] || 'Part',
                isRest: true,
              })
            } else if (note.Pitch) {
              const step = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][note.Pitch.FundamentalNote] || 'C'
              const acc = note.Pitch.Accidental || 0
              const oct = note.Pitch.Octave + 3
              const accStr = acc > 0 ? '#' : acc < 0 ? 'b' : ''
              const pitchName = `${step}${accStr}${oct}`
              const semi = pitchToSemitones(step, oct, acc)
              const durBeats = note.Length?.RealValue ? note.Length.RealValue * 4 : 1

              notes.push({
                pitch: pitchName,
                semitones: semi,
                frequency: semitonesToFreq(semi),
                duration: durBeats,
                measure: measureNum,
                partIndex: partIdx,
                partName: partNames[partIdx] || 'Part',
                isRest: false,
              })
            }
          }
        }
      } catch {}

      cursor.next()
    }

    return { notes, parts: partNames, tempo, title }
  } finally {
    try { document.body.removeChild(container) } catch {}
  }
}

// ─── Convenience: extract as semitone array for NoteRunner ──────────────────

export function notesToSemitoneArray(notes: ExtractedNote[], partIndex: number): number[] {
  return notes
    .filter(n => n.partIndex === partIndex && !n.isRest)
    .map(n => n.semitones)
}

// ─── Convenience: extract intervals for Pitchforks ──────────────────────────

export interface IntervalPattern {
  from: number      // semitones from C4
  to: number        // semitones from C4
  interval: number  // absolute semitone distance
  direction: 'up' | 'down' | 'same'
  fromName: string
  toName: string
  measure: number
}

export function extractIntervals(notes: ExtractedNote[], partIndex: number): IntervalPattern[] {
  const partNotes = notes.filter(n => n.partIndex === partIndex && !n.isRest)
  const intervals: IntervalPattern[] = []

  for (let i = 1; i < partNotes.length; i++) {
    const prev = partNotes[i - 1]
    const curr = partNotes[i]
    const diff = curr.semitones - prev.semitones
    intervals.push({
      from: prev.semitones,
      to: curr.semitones,
      interval: Math.abs(diff),
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same',
      fromName: prev.pitch,
      toName: curr.pitch,
      measure: curr.measure,
    })
  }

  return intervals
}
