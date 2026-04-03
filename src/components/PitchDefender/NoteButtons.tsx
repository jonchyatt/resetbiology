'use client'

import { NOTE_COLORS } from '@/lib/fsrs'
import { KEYBOARD_ORDER, NOTE_LABELS } from './types'

interface NoteButtonsProps {
  unlockedNotes: string[]
  onNoteSelected: (note: string) => void
  disabled: boolean
  lastCorrectNote: string | null
  lastWrongNote: string | null
}

export default function NoteButtons({
  unlockedNotes,
  onNoteSelected,
  disabled,
  lastCorrectNote,
  lastWrongNote,
}: NoteButtonsProps) {
  // Split into octave rows for clean layout
  const oct3 = KEYBOARD_ORDER.filter(n => n.endsWith('3'))
  const oct4plus = KEYBOARD_ORDER.filter(n => !n.endsWith('3'))
  const hasOct3 = oct3.some(n => unlockedNotes.includes(n))

  const renderButton = (note: string) => {
    const unlocked = unlockedNotes.includes(note)
    const color = NOTE_COLORS[note]
    const hue = color?.hue ?? 0
    const isCorrectFlash = lastCorrectNote === note
    const isWrongFlash = lastWrongNote === note

    return (
      <button
        key={note}
        disabled={disabled || !unlocked}
        onClick={() => unlocked && !disabled && onNoteSelected(note)}
        className="relative flex items-center justify-center font-bold transition-all select-none active:scale-95"
        style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          fontSize: 13,
          fontFamily: 'monospace',
          color: unlocked ? 'white' : '#555',
          background: unlocked
            ? `linear-gradient(135deg, hsl(${hue}, 60%, 25%) 0%, hsl(${hue}, 50%, 15%) 100%)`
            : 'rgba(30, 30, 40, 0.6)',
          border: unlocked
            ? `2px solid hsl(${hue}, 70%, 50%)`
            : '2px solid rgba(60, 60, 80, 0.4)',
          boxShadow: isCorrectFlash
            ? `0 0 20px hsl(${hue}, 80%, 60%), 0 0 40px hsl(${hue}, 80%, 60%), inset 0 0 15px hsl(${hue}, 80%, 60%)`
            : isWrongFlash
            ? `0 0 20px hsl(0, 80%, 50%), inset 0 0 10px hsl(0, 80%, 50%)`
            : unlocked
            ? `0 0 8px hsl(${hue}, 60%, 40%)40, inset 0 1px 0 hsl(${hue}, 60%, 40%)30`
            : 'none',
          cursor: unlocked && !disabled ? 'pointer' : 'default',
          opacity: unlocked ? 1 : 0.35,
          animation: isCorrectFlash
            ? 'buttonPress 0.2s ease-out'
            : isWrongFlash
            ? 'alienShake 0.3s ease-out'
            : undefined,
          minWidth: 48,
          minHeight: 48,
        }}
      >
        {unlocked && (
          <div
            className="absolute inset-0 rounded-[8px] opacity-0 transition-opacity"
            style={{
              background: `radial-gradient(circle, hsl(${hue}, 80%, 60%)30, transparent 70%)`,
            }}
          />
        )}
        {!unlocked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
            className="absolute top-0.5 right-0.5">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
        <span className="relative z-10">{NOTE_LABELS[note]}</span>
      </button>
    )
  }

  return (
    <div className="px-3 py-2" style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Octave 3 row — only show when any oct3 note is unlocked */}
      {hasOct3 && (
        <div className="flex justify-center gap-1.5 mb-1.5">
          {oct3.map(renderButton)}
        </div>
      )}
      {/* Octave 4+ row */}
      <div className="flex justify-center gap-1.5">
        {oct4plus.map(renderButton)}
      </div>
    </div>
  )
}
