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
  return (
    <div className="flex justify-center gap-2 px-3 py-3 flex-wrap" style={{ maxWidth: 500, margin: '0 auto' }}>
      {KEYBOARD_ORDER.map(note => {
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
              width: 54,
              height: 54,
              borderRadius: 12,
              fontSize: 16,
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
              // Touch target minimum
              minWidth: 48,
              minHeight: 48,
            }}
          >
            {/* Glow overlay for active state */}
            {unlocked && (
              <div
                className="absolute inset-0 rounded-[10px] opacity-0 transition-opacity"
                style={{
                  background: `radial-gradient(circle, hsl(${hue}, 80%, 60%)30, transparent 70%)`,
                }}
              />
            )}

            {/* Lock icon for locked notes */}
            {!unlocked && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
                className="absolute top-1 right-1">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}

            <span className="relative z-10">{NOTE_LABELS[note]}</span>
          </button>
        )
      })}
    </div>
  )
}
