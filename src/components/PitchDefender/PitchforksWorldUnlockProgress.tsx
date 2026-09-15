import React from 'react'
import type {
  PitchforksMasteryNoteProjection,
  PitchforksMasteryProjection,
} from './pitchforksMasteryProjection'
import { PITCHFORKS_MASTERY_SESSION_COUNT } from './pitchforksMasteryProjection'

export interface PitchforksWorldUnlockProgressProps {
  /** Read-only state projected from the player's loaded campaign snapshots. */
  projection?: PitchforksMasteryProjection | null
}

function sessionCount(note: PitchforksMasteryNoteProjection): number {
  return Array.isArray(note?.voiceMastery?.sessionIds)
    ? note.voiceMastery.sessionIds.length
    : 0
}

function noteLabel(note: PitchforksMasteryNoteProjection): string {
  return typeof note?.note === 'string' && note.note.trim().length > 0
    ? note.note
    : 'Unavailable note'
}

function completionCount(notes: readonly PitchforksMasteryNoteProjection[]): number {
  return notes.reduce(
    (total, note) => total + Math.min(sessionCount(note), PITCHFORKS_MASTERY_SESSION_COUNT),
    0,
  )
}

/**
 * The campaign gate's player-facing readout. It deliberately consumes only
 * the projection's durable, distinct voice-session evidence; it does not
 * create or infer progress from levels, scores, or listening practice.
 */
export function PitchforksWorldUnlockProgress({ projection }: PitchforksWorldUnlockProgressProps) {
  const notes = Array.isArray(projection?.notes) ? projection.notes : []
  const requiredSessions = notes.length * PITCHFORKS_MASTERY_SESSION_COUNT
  const completedSessions = completionCount(notes)

  return (
    <section
      data-testid="pf3-world-unlock-progress"
      aria-labelledby="pf3-world-unlock-progress-heading"
      className="mt-3 border border-cyan-700 bg-cyan-950/20 p-3 text-left text-cyan-100"
    >
      <h2 id="pf3-world-unlock-progress-heading" className="text-sm font-black tracking-widest">
        VILLAGE GATE PROGRESS
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-gray-300">
        Complete {PITCHFORKS_MASTERY_SESSION_COUNT} distinct voice mastery sessions for each admitted note.
      </p>
      <p
        data-testid="pf3-world-unlock-progress-input-note"
        className="mt-2 border border-cyan-800/80 bg-black/20 px-3 py-2 text-xs leading-relaxed text-cyan-50"
      >
        Listen &amp; Tap builds recognition practice; those sessions do not currently count toward World Map unlocks. Voice Lightning sessions are required for campaign progress and new-area unlocks.
      </p>
      {notes.length === 0 ? (
        <p
          data-testid="pf3-world-unlock-progress-empty"
          role="status"
          aria-live="polite"
          className="mt-3 border border-amber-500/70 bg-amber-950/25 p-3 text-sm font-bold text-amber-100"
        >
          Complete the comfortable-range check to begin your admitted-note progress.
        </p>
      ) : (
        <>
          <p
            data-testid="pf3-world-unlock-progress-total"
            className="mt-3 border border-cyan-800/80 bg-black/20 px-3 py-2 text-sm font-black"
          >
            {completedSessions}/{requiredSessions} voice mastery sessions
            {projection?.worldClear === true ? ' · READY' : ''}
          </p>
          <ul
            data-testid="pf3-world-unlock-progress-notes"
            aria-label="Voice mastery sessions by note"
            className="mt-2 grid gap-1.5 sm:grid-cols-2"
          >
            {notes.map(note => {
              const label = noteLabel(note)
              const completed = Math.min(sessionCount(note), PITCHFORKS_MASTERY_SESSION_COUNT)
              const mastered = note.voiceEverMastered === true
              return (
                <li
                  key={label}
                  data-testid={`pf3-world-unlock-progress-${label}`}
                  className="flex min-h-11 items-center justify-between gap-2 border border-gray-700/80 bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="font-black">{label}</span>
                  <span className={mastered ? 'font-black text-green-200' : 'font-bold text-cyan-100'}>
                    {completed}/{PITCHFORKS_MASTERY_SESSION_COUNT} sessions{mastered ? ' ✓' : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

export default PitchforksWorldUnlockProgress
