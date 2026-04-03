'use client'

import { NOTE_COLORS, currentR, type NoteMemory } from '@/lib/fsrs'
import { KEYBOARD_ORDER, NOTE_LABELS, INTRO_ORDER } from './types'

interface GameOverProps {
  score: number
  wave: number
  totalCorrect: number
  totalAttempts: number
  maxCombo: number
  unlockedNotes: string[]
  fsrsMemory: Record<string, NoteMemory>
  isNewHighScore: boolean
  onPlayAgain: () => void
  onMenu: () => void
}

export default function GameOver({
  score, wave, totalCorrect, totalAttempts, maxCombo,
  unlockedNotes, fsrsMemory, isNewHighScore,
  onPlayAgain, onMenu,
}: GameOverProps) {
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.9) 100%)' }}>

      {/* Title */}
      <div
        className="text-5xl font-black text-white mb-2"
        style={{
          animation: 'gameOverReveal 1s ease-out forwards',
          textShadow: '0 0 30px rgba(255,255,255,0.3)',
        }}
      >
        {wave >= 10 ? 'VICTORY' : 'GAME OVER'}
      </div>

      {isNewHighScore && (
        <div className="text-lg font-bold text-yellow-400 mb-4"
          style={{ animation: 'comboFlash 1.5s ease-in-out infinite', textShadow: '0 0 15px #e8a838' }}>
          NEW HIGH SCORE!
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-4 mb-6">
        <StatItem label="SCORE" value={score.toLocaleString()} color="#fff" />
        <StatItem label="WAVES" value={String(wave)} color="#3FBFB5" />
        <StatItem label="ACCURACY" value={`${accuracy}%`} color={accuracy >= 80 ? '#4ade80' : accuracy >= 60 ? '#e8a838' : '#f87171'} />
        <StatItem label="BEST COMBO" value={String(maxCombo)} color="#C060E0" />
      </div>

      {/* Note mastery bars */}
      <div className="w-full max-w-sm mb-6">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 text-center">
          Note Memory Health
        </div>
        <div className="flex gap-1.5 justify-center">
          {INTRO_ORDER.map(note => {
            const unlocked = unlockedNotes.includes(note)
            const mem = fsrsMemory[note]
            const r = mem ? currentR(mem) : 0
            const color = NOTE_COLORS[note]
            const hue = color?.hue ?? 0

            return (
              <div key={note} className="flex flex-col items-center gap-1">
                {/* Bar */}
                <div
                  className="relative overflow-hidden rounded-sm"
                  style={{ width: 28, height: 60, background: 'rgba(30,30,40,0.6)', border: '1px solid rgba(60,60,80,0.3)' }}
                >
                  {unlocked && (
                    <div
                      className="absolute bottom-0 left-0 right-0 transition-all duration-500"
                      style={{
                        height: `${Math.round(r * 100)}%`,
                        background: `linear-gradient(to top, hsl(${hue}, 70%, 45%), hsl(${hue}, 80%, 60%))`,
                        boxShadow: `0 0 6px hsl(${hue}, 70%, 50%)60`,
                      }}
                    />
                  )}
                </div>
                {/* Label */}
                <div className="text-xs font-mono" style={{ color: unlocked ? `hsl(${hue}, 70%, 65%)` : '#444' }}>
                  {NOTE_LABELS[note]}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onPlayAgain}
          className="px-8 py-3 rounded-xl font-bold text-white text-lg transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #3FBFB5, #2a8a82)',
            boxShadow: '0 0 20px #3FBFB540, 0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          PLAY AGAIN
        </button>
        <button
          onClick={onMenu}
          className="px-6 py-3 rounded-xl font-medium text-gray-300 text-lg transition-all active:scale-95"
          style={{
            background: 'rgba(40,40,60,0.6)',
            border: '1px solid rgba(100,100,140,0.3)',
          }}
        >
          MENU
        </button>
      </div>
    </div>
  )
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  )
}
