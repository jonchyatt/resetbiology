import React, { type ReactElement } from 'react'

import type {
  PitchforksMasteryNoteProjection,
  PitchforksMasteryProjection,
  PitchforksMasteryTrackStatus,
} from './pitchforksMasteryProjection'

export interface PitchforksMasteryPanelProps {
  /** Read-only note state projected by the caller from its already-loaded snapshots. */
  projection?: PitchforksMasteryProjection | null
}

type Track = 'voice' | 'ear'

type StatusCopy = Readonly<{
  label: string
  detail: string
  className: string
}>

function knownStatus(value: unknown): value is PitchforksMasteryTrackStatus {
  return value === 'new' || value === 'learning' || value === 'review' || value === 'missing' || value === 'invalid'
}

function voiceMilestoneCopy(rawStatus: unknown, everMastered: boolean): 'earned' | 'still learning' | 'unavailable' {
  const status = knownStatus(rawStatus) ? rawStatus : 'invalid'

  // A durable receipt can still prove earned history without a current
  // snapshot; missing/invalid current data cannot be labeled as learning.
  if ((status === 'missing' || status === 'invalid') && !everMastered) return 'unavailable'
  return everMastered ? 'earned' : 'still learning'
}

function statusCopy(track: Track, rawStatus: unknown, due: boolean): StatusCopy {
  const status = knownStatus(rawStatus) ? rawStatus : 'invalid'
  const subject = track === 'voice' ? 'singing' : 'listening'

  switch (status) {
    case 'missing':
      return {
        label: 'Practice needed',
        detail: `${subject[0].toUpperCase()}${subject.slice(1)} practice is needed before we can assess this note.`,
        className: 'border-amber-500/70 bg-amber-950/25 text-amber-100',
      }
    case 'invalid':
      return {
        label: 'Unavailable',
        detail: `${subject[0].toUpperCase()}${subject.slice(1)} progress is unavailable right now.`,
        className: 'border-red-500/70 bg-red-950/25 text-red-100',
      }
    case 'new':
      return {
        label: 'Practice needed',
        detail: `${subject[0].toUpperCase()}${subject.slice(1)} practice has not been established yet.`,
        className: 'border-amber-500/70 bg-amber-950/25 text-amber-100',
      }
    case 'learning':
      return due
        ? {
            label: 'Practice needed',
            detail: `Current ${subject} learning is due for practice.`,
            className: 'border-amber-500/70 bg-amber-950/25 text-amber-100',
          }
        : {
            label: 'Learning',
            detail: `Current ${subject} learning is in progress.`,
            className: 'border-cyan-700/70 bg-cyan-950/20 text-cyan-100',
          }
    case 'review':
      return due
        ? {
            label: 'Review due',
            detail: `Current ${subject} review is due.`,
            className: 'border-amber-500/70 bg-amber-950/25 text-amber-100',
          }
        : {
            label: 'In review',
            detail: `Current ${subject} review is scheduled.`,
            className: 'border-green-700/70 bg-green-950/20 text-green-100',
          }
  }
}

function noteText(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'Unavailable note'
}

function TrackStatus({ note, track }: Readonly<{ note: PitchforksMasteryNoteProjection | null; track: Track }>): ReactElement {
  const isVoice = track === 'voice'
  const trackLabel = isVoice ? 'Voice (singing)' : 'Ear (listening)'
  const rawStatus = isVoice ? note?.voiceStatus : note?.earStatus
  const due = isVoice ? note?.voiceDue === true : note?.earDue === true
  const copy = statusCopy(track, rawStatus, due)
  const safeStatus = knownStatus(rawStatus) ? rawStatus : 'invalid'
  const voiceMilestone = voiceMilestoneCopy(rawStatus, note?.voiceEverMastered === true)
  const idNote = noteText(note?.note)
  const testId = `pitchforks-mastery-${track}-${idNote}`

  return (
    <div
      data-testid={testId}
      data-track={track}
      data-status={safeStatus}
      data-due={String(due)}
      {...(isVoice ? { 'data-voice-ever-mastered': String(note?.voiceEverMastered === true) } : { 'data-ear-ledger': 'none' })}
      className={`min-w-0 border p-2.5 ${copy.className}`}
      aria-label={`${trackLabel}: ${copy.label}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h4 className="min-w-0 text-[11px] font-black tracking-widest text-white">{trackLabel}</h4>
        <span className="shrink-0 text-right text-[11px] font-black">{copy.label}</span>
      </div>
      {isVoice ? (
        <p data-testid={`${testId}-history`} className="mt-1 text-[11px] font-bold leading-relaxed text-cyan-100">
          Singing milestone: {voiceMilestone}.
        </p>
      ) : (
        <p data-testid={`${testId}-ledger`} className="mt-1 text-[11px] font-bold leading-relaxed text-cyan-100">
          Listening practice is tracked separately.
        </p>
      )}
      <p className="mt-1 text-[11px] leading-relaxed text-gray-300">{copy.detail}</p>
    </div>
  )
}

/**
 * Small read-only W2-ATLAS subleaf. It presents only the supplied per-note
 * projection; gameplay state remains outside this presenter.
 */
export function PitchforksMasteryPanel({ projection }: PitchforksMasteryPanelProps): ReactElement {
  const notes = Array.isArray(projection?.notes) ? projection.notes : []

  return (
    <section
      data-testid="pitchforks-mastery-panel"
      aria-labelledby="pitchforks-mastery-panel-heading"
      className="w-full max-w-lg border border-cyan-900/70 bg-cyan-950/15 p-3 text-white"
    >
      <header className="mb-3">
        <h2 id="pitchforks-mastery-panel-heading" className="text-xs font-black tracking-widest text-cyan-100">
          NOTE MASTERY
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-300">
          Singing history and current review stay separate from listening practice.
        </p>
      </header>

      {notes.length === 0 ? (
        <p
          data-testid="pitchforks-mastery-empty"
          role="status"
          aria-live="polite"
          className="border border-amber-500/70 bg-amber-950/25 p-3 text-xs font-bold leading-relaxed text-amber-100"
        >
          Assessment needed: practice a comfortable note to begin.
        </p>
      ) : (
        <ol data-testid="pitchforks-mastery-notes" className="grid gap-2" aria-label="Your note mastery">
          {notes.map((note, index) => {
            const label = noteText(note?.note)
            return (
              <li
                key={`${label}-${index}`}
                data-testid={`pitchforks-mastery-note-${label}`}
                data-note={label}
                data-voice-mastered={String(note?.voiceEverMastered === true)}
                className="min-w-0 border border-gray-700/80 bg-black/20 p-2.5"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="min-w-0 break-words text-sm font-black tracking-widest text-white">{label}</h3>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-400">Your note</span>
                </div>
                <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                  <TrackStatus note={note} track="voice" />
                  <TrackStatus note={note} track="ear" />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

export default PitchforksMasteryPanel
