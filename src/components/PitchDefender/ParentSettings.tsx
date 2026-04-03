'use client'

import { useState } from 'react'
import { NOTE_COLORS } from '@/lib/fsrs'
import { KEYBOARD_ORDER, NOTE_LABELS } from './types'

export interface GameSettings {
  enabledNotes: string[]       // which notes are in the pool
  clef: 'treble' | 'bass' | 'both'
  pitchTolerance: 'beginner' | 'intermediate' | 'advanced'
  descentSpeed: 'slow' | 'normal' | 'fast'
  maxWaves: number
  showNoteLabels: boolean      // show labels on aliens (training wheels)
}

export const DEFAULT_SETTINGS: GameSettings = {
  enabledNotes: KEYBOARD_ORDER.filter(n => n.endsWith('4') || n === 'C5') as unknown as string[],
  clef: 'treble',
  pitchTolerance: 'beginner',
  descentSpeed: 'normal',
  maxWaves: 10,
  showNoteLabels: false,
}

interface ParentSettingsProps {
  settings: GameSettings
  onSave: (settings: GameSettings) => void
  onClose: () => void
}

export default function ParentSettings({ settings, onSave, onClose }: ParentSettingsProps) {
  const [local, setLocal] = useState<GameSettings>({ ...settings })

  const toggleNote = (note: string) => {
    const enabled = local.enabledNotes.includes(note)
    if (enabled && local.enabledNotes.length <= 2) return // min 2 notes
    setLocal(prev => ({
      ...prev,
      enabledNotes: enabled
        ? prev.enabledNotes.filter(n => n !== note)
        : [...prev.enabledNotes, note],
    }))
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{
        background: 'linear-gradient(135deg, rgba(30,30,50,0.95), rgba(20,20,35,0.98))',
        border: '1px solid rgba(100,100,140,0.2)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <h2 className="text-xl font-bold text-white mb-4">Parent Settings</h2>

        {/* Note Pool */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 uppercase tracking-wider">Enabled Notes</label>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(KEYBOARD_ORDER as readonly string[]).map(note => {
              const enabled = local.enabledNotes.includes(note)
              const hue = NOTE_COLORS[note]?.hue ?? 0
              return (
                <button key={note} onClick={() => toggleNote(note)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: enabled ? `hsl(${hue}, 60%, 25%)` : 'rgba(40,40,60,0.4)',
                    border: enabled ? `2px solid hsl(${hue}, 70%, 50%)` : '2px solid rgba(60,60,80,0.3)',
                    color: enabled ? 'white' : '#555',
                    opacity: enabled ? 1 : 0.5,
                  }}>
                  {NOTE_LABELS[note]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Clef */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 uppercase tracking-wider">Clef</label>
          <div className="flex gap-2 mt-2">
            {(['treble', 'bass', 'both'] as const).map(c => (
              <button key={c} onClick={() => setLocal(s => ({ ...s, clef: c }))}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                style={{
                  background: local.clef === c ? 'rgba(63, 191, 181, 0.2)' : 'rgba(40,40,60,0.4)',
                  border: local.clef === c ? '2px solid #3FBFB5' : '2px solid rgba(60,60,80,0.3)',
                  color: local.clef === c ? '#3FBFB5' : '#888',
                }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Pitch Tolerance */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 uppercase tracking-wider">Pitch Tolerance (Echo Cannon)</label>
          <div className="flex gap-2 mt-2">
            {(['beginner', 'intermediate', 'advanced'] as const).map(t => (
              <button key={t} onClick={() => setLocal(s => ({ ...s, pitchTolerance: t }))}
                className="px-3 py-2 rounded-lg text-xs font-medium transition-all capitalize"
                style={{
                  background: local.pitchTolerance === t ? 'rgba(63, 191, 181, 0.2)' : 'rgba(40,40,60,0.4)',
                  border: local.pitchTolerance === t ? '2px solid #3FBFB5' : '2px solid rgba(60,60,80,0.3)',
                  color: local.pitchTolerance === t ? '#3FBFB5' : '#888',
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Descent Speed */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 uppercase tracking-wider">Descent Speed</label>
          <div className="flex gap-2 mt-2">
            {(['slow', 'normal', 'fast'] as const).map(s => (
              <button key={s} onClick={() => setLocal(prev => ({ ...prev, descentSpeed: s }))}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                style={{
                  background: local.descentSpeed === s ? 'rgba(63, 191, 181, 0.2)' : 'rgba(40,40,60,0.4)',
                  border: local.descentSpeed === s ? '2px solid #3FBFB5' : '2px solid rgba(60,60,80,0.3)',
                  color: local.descentSpeed === s ? '#3FBFB5' : '#888',
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Show Note Labels */}
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => setLocal(s => ({ ...s, showNoteLabels: !s.showNoteLabels }))}
            className="w-10 h-6 rounded-full transition-all"
            style={{
              background: local.showNoteLabels ? '#3FBFB5' : 'rgba(60,60,80,0.5)',
            }}>
            <div className="w-4 h-4 rounded-full bg-white transition-all" style={{
              marginLeft: local.showNoteLabels ? 22 : 2,
              marginTop: 4,
            }} />
          </button>
          <span className="text-sm text-gray-300">Show note labels on aliens (training mode)</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => { onSave(local); onClose() }}
            className="flex-1 py-3 rounded-xl font-bold text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #3FBFB5, #2a8a82)' }}>
            SAVE
          </button>
          <button onClick={onClose}
            className="px-6 py-3 rounded-xl font-medium text-gray-400 transition-all active:scale-95"
            style={{ background: 'rgba(40,40,60,0.6)', border: '1px solid rgba(80,80,100,0.3)' }}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}
