import React, { type ReactElement } from 'react'

export type PitchforksSongcraftLane = 'voice' | 'ear'

export interface PitchforksSongcraftSong {
  readonly sourceKey: string
  readonly title: string
  readonly source?: 'composer' | 'builtin'
}

export type SongcraftPanelActiveKind = 'note' | 'rest' | 'unsupported' | 'complete'
export type SongcraftPanelMicStatus = 'off' | 'starting' | 'listening' | 'error'

export interface SongcraftPanelView {
  readonly title: string
  readonly position: number
  readonly total: number
  readonly kind: SongcraftPanelActiveKind
  readonly noteLabel: string | null
  readonly message: string
  readonly progress01: number
  readonly assisted: boolean
  readonly micStatus: SongcraftPanelMicStatus
  readonly busy: boolean
  readonly canAnswer: boolean
  readonly answerOptions: readonly string[]
  readonly pendingSave: boolean
  readonly needsRetry: boolean
}

export interface SongcraftPanelProps {
  readonly songs: readonly PitchforksSongcraftSong[]
  readonly selectedKey: string
  readonly onSelect: (key: string) => void
  readonly lane: PitchforksSongcraftLane
  readonly onLaneChange: (lane: PitchforksSongcraftLane) => void
  readonly onBegin: () => void
  readonly view?: SongcraftPanelView | null
  readonly onStartMic: () => void
  readonly onHear: () => void
  readonly onHint: () => void
  readonly onAnswer: (note: string) => void
  readonly onAcknowledge: () => void
  readonly onRetrySave: () => void
  readonly onRetryNote: () => void
  readonly onReturn: () => void
}

export type PitchforksSongcraftActiveView = SongcraftPanelView
export type PitchforksSongcraftPanelProps = SongcraftPanelProps

const controlClass = 'min-h-12 w-full rounded-sm border px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40'
const cardClass = 'border border-cyan-900/70 bg-[#0d1324] p-4'

function progressValue(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function micLabel(status: SongcraftPanelMicStatus): string {
  switch (status) {
    case 'starting': return 'Starting'
    case 'listening': return 'Listening'
    case 'error': return 'Error'
    case 'off': return 'Off'
  }
}

function LaneButton({
  active,
  children,
  onClick,
}: Readonly<{
  active: boolean
  children: string
  onClick: () => void
}>): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`${controlClass} ${active ? 'border-amber-300 bg-amber-950/40 text-amber-100' : 'border-gray-700 bg-[#070914] text-gray-100'}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function RecoveryControls({
  active,
  onRetrySave,
  onRetryNote,
}: Readonly<{
  active: SongcraftPanelView
  onRetrySave: () => void
  onRetryNote: () => void
}>): ReactElement | null {
  if (active.pendingSave) {
    return (
      <button
        type="button"
        data-testid="pitchforks-songcraft-retry-save"
        className={`${controlClass} border-amber-300 text-amber-100`}
        disabled={active.busy}
        onClick={onRetrySave}
      >
        RETRY SAVING
      </button>
    )
  }
  if (active.needsRetry) {
    return (
      <button
        type="button"
        data-testid="pitchforks-songcraft-retry-note"
        className={`${controlClass} border-green-300 text-green-100`}
        disabled={active.busy}
        onClick={onRetryNote}
      >
        TRY THIS NOTE AGAIN
      </button>
    )
  }
  return null
}

function NoteControls({
  active,
  lane,
  onStartMic,
  onHear,
  onHint,
  onAnswer,
}: Readonly<{
  active: SongcraftPanelView
  lane: PitchforksSongcraftLane
  onStartMic: () => void
  onHear: () => void
  onHint: () => void
  onAnswer: (note: string) => void
}>): ReactElement {
  const busy = active.busy
  const micStarting = active.micStatus === 'starting'
  const micListening = active.micStatus === 'listening'

  return (
    <div data-testid="pitchforks-songcraft-note-controls" className="grid gap-3">
      {lane === 'voice' ? (
        <div data-testid="pitchforks-songcraft-voice-controls" className="grid gap-3">
          <div className="flex min-h-12 items-center justify-between gap-3 border border-gray-700/80 bg-black/20 px-3 py-2 text-xs">
            <span className="font-bold uppercase tracking-widest text-gray-300">Microphone</span>
            <span data-testid="pitchforks-songcraft-mic-status" className="font-black uppercase tracking-widest text-cyan-100">
              {micLabel(active.micStatus)}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-gray-300">Sing the note when you are ready. Your voice is the practice input.</p>
          <button
            type="button"
            data-testid="pitchforks-songcraft-start-mic"
            className={`${controlClass} border-green-300 bg-green-950/50 text-green-100`}
            disabled={busy || micStarting || micListening}
            onClick={onStartMic}
          >
            {micStarting ? 'STARTING MIC…' : micListening ? 'MIC LISTENING' : 'START MIC'}
          </button>
        </div>
      ) : (
        <div data-testid="pitchforks-songcraft-ear-controls" className="grid gap-3">
          <p className="text-xs leading-relaxed text-gray-300">Listen to the challenge, then choose the note you heard.</p>
          <div className="grid grid-cols-2 gap-3" aria-label="Choose the note heard">
            {active.answerOptions.map(note => (
              <button
                key={note}
                type="button"
                data-testid={`pitchforks-songcraft-answer-${note}`}
                className={`${controlClass} border-cyan-400 text-cyan-100`}
                disabled={busy || !active.canAnswer}
                onClick={() => onAnswer(note)}
              >
                {note}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          data-testid="pitchforks-songcraft-hear"
          className={`${controlClass} border-cyan-300 text-cyan-100`}
          disabled={busy}
          onClick={onHear}
        >
          HEAR NOTE
        </button>
        <button
          type="button"
          data-testid="pitchforks-songcraft-hint"
          className={`${controlClass} border-amber-500 text-amber-100`}
          disabled={busy}
          onClick={onHint}
        >
          HINT · HEAR NOTE
        </button>
      </div>
    </div>
  )
}

function ActiveContent({
  active,
  lane,
  onStartMic,
  onHear,
  onHint,
  onAnswer,
  onAcknowledge,
  onRetrySave,
  onRetryNote,
}: Readonly<{
  active: SongcraftPanelView
  lane: PitchforksSongcraftLane
  onStartMic: () => void
  onHear: () => void
  onHint: () => void
  onAnswer: (note: string) => void
  onAcknowledge: () => void
  onRetrySave: () => void
  onRetryNote: () => void
}>): ReactElement {
  if (active.pendingSave || active.needsRetry) {
    return <RecoveryControls active={active} onRetrySave={onRetrySave} onRetryNote={onRetryNote} />
  }

  switch (active.kind) {
    case 'note':
      return (
        <div data-testid="pitchforks-songcraft-note-view" className="grid gap-4">
          <div className="border border-green-700/70 bg-green-950/20 p-4 text-center">
            <h2 className="break-words text-3xl font-black tracking-widest text-white">{lane === 'ear' ? 'Mystery note' : (active.noteLabel ?? 'Current note')}</h2>
            <p className="mt-2 text-sm font-bold text-amber-100">Practice at your pace</p>
          </div>
          <NoteControls
            active={active}
            lane={lane}
            onStartMic={onStartMic}
            onHear={onHear}
            onHint={onHint}
            onAnswer={onAnswer}
          />
        </div>
      )
    case 'rest':
      return (
        <div data-testid="pitchforks-songcraft-rest-view" className="grid gap-3 border border-cyan-700/70 bg-cyan-950/20 p-4 text-center">
          <h2 className="text-lg font-black text-cyan-100">Rest — continue when ready.</h2>
          <button
            type="button"
            data-testid="pitchforks-songcraft-acknowledge"
            className={`${controlClass} border-cyan-300 text-cyan-100`}
            disabled={active.busy}
            onClick={onAcknowledge}
          >
            CONTINUE
          </button>
        </div>
      )
    case 'unsupported':
      return (
        <div data-testid="pitchforks-songcraft-unsupported-view" className="grid gap-3 border border-amber-500/70 bg-amber-950/25 p-4 text-center">
          <p className="text-3xl font-black text-white">{active.noteLabel ?? 'Unadmitted note'}</p>
          <h2 className="text-lg font-black leading-relaxed text-amber-100">This note is outside your current practice range. Continue without credit.</h2>
          <button
            type="button"
            data-testid="pitchforks-songcraft-acknowledge"
            className={`${controlClass} border-amber-300 text-amber-100`}
            disabled={active.busy}
            onClick={onAcknowledge}
          >
            CONTINUE WITHOUT CREDIT
          </button>
        </div>
      )
    case 'complete':
      return (
        <div data-testid="pitchforks-songcraft-complete-view" className="grid gap-2 border border-green-400/50 bg-green-950/30 p-4 text-center">
          <h2 className="text-lg font-black text-green-200">Practice complete</h2>
          <p className="font-bold text-green-100">{active.assisted ? 'Completed with help' : 'Practice finished'}</p>
        </div>
      )
  }
}

function SelectionView({
  songs,
  selectedKey,
  onSelect,
  lane,
  onLaneChange,
  onBegin,
}: Readonly<{
  songs: readonly PitchforksSongcraftSong[]
  selectedKey: string
  onSelect: (key: string) => void
  lane: PitchforksSongcraftLane
  onLaneChange: (lane: PitchforksSongcraftLane) => void
  onBegin: () => void
}>): ReactElement {
  if (songs.length === 0) {
    return (
      <section data-testid="pitchforks-songcraft-empty" className={`${cardClass} grid gap-3`}>
        <p role="status" aria-live="polite" aria-atomic="true" className="text-sm font-bold leading-relaxed text-amber-100">
          No Composer songs found.
        </p>
        <p className="text-sm leading-relaxed text-gray-300">Built-in exercises appear when their exact notes are in your confirmed comfortable range. You can also create your own song.</p>
        <a href="/pitch-defender/composer" className="inline-flex min-h-12 items-center justify-center border border-cyan-300 px-4 py-3 text-sm font-bold text-cyan-100">
          OPEN COMPOSER
        </a>
      </section>
    )
  }

  return (
    <section data-testid="pitchforks-songcraft-selection" className={`${cardClass} grid gap-4`}>
      <div className="grid gap-2">
        <label htmlFor="pitchforks-songcraft-song" className="text-xs font-black uppercase tracking-widest text-amber-100">Practice song</label>
        <select
          id="pitchforks-songcraft-song"
          data-testid="pitchforks-songcraft-song-select"
          className="min-h-12 w-full border border-gray-700 bg-[#070914] px-3 py-2 text-sm font-bold text-white"
          value={selectedKey}
          onChange={event => onSelect(event.currentTarget.value)}
        >
          {songs.some(song => song.source !== 'builtin') && <optgroup label="My Composer songs">
            {songs.filter(song => song.source !== 'builtin').map(song => <option key={song.sourceKey} value={song.sourceKey}>★ {song.title}</option>)}
          </optgroup>}
          {songs.some(song => song.source === 'builtin') && <optgroup label="Built-in practice">
            {songs.filter(song => song.source === 'builtin').map(song => <option key={song.sourceKey} value={song.sourceKey}>{song.title}</option>)}
          </optgroup>}
        </select>
        <p className="text-xs leading-relaxed text-gray-300">Built-in exercises use only your confirmed notes. Your Composer songs keep every note exactly as written.</p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-xs font-black uppercase tracking-widest text-amber-100">Practice lane</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LaneButton active={lane === 'voice'} onClick={() => onLaneChange('voice')}>VOICE · SINGING</LaneButton>
          <LaneButton active={lane === 'ear'} onClick={() => onLaneChange('ear')}>EAR · LISTENING</LaneButton>
        </div>
      </fieldset>

      <button
        type="button"
        data-testid="pitchforks-songcraft-begin"
        className={`${controlClass} border-green-300 bg-green-950/50 text-green-100`}
        disabled={selectedKey.length === 0}
        onClick={onBegin}
      >
        BEGIN PRACTICE
      </button>
    </section>
  )
}

/**
 * Controlled Songcraft presentation. Practice, audio, and persistence stay
 * in the caller; this leaf only renders supplied state and emits intent.
 */
export function PitchforksSongcraftPanel({
  songs,
  selectedKey,
  onSelect,
  lane,
  onLaneChange,
  onBegin,
  view,
  onStartMic,
  onHear,
  onHint,
  onAnswer,
  onAcknowledge,
  onRetrySave,
  onRetryNote,
  onReturn,
}: SongcraftPanelProps): ReactElement {
  const current = view ?? null
  const headingId = 'pitchforks-songcraft-panel-heading'

  return (
    <main
      data-testid="pitchforks-songcraft-panel"
      aria-labelledby={headingId}
      className="fixed inset-0 overflow-x-hidden overflow-y-auto bg-[#070914] text-gray-100"
      style={{ fontFamily: 'monospace', paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
    >
      <header className="mx-auto w-full max-w-[720px] px-4 pb-3 pt-5 text-center">
        <p className="text-[10px] tracking-widest text-amber-200">SONGCRAFT · NO TIMER · PRIVATE PRACTICE</p>
        <h1 id={headingId} className="mt-2 text-xl font-black tracking-widest text-amber-100">SONGCRAFT</h1>
        {current ? (
          <div className="mt-2 grid gap-1 text-xs text-gray-300">
            <p data-testid="pitchforks-songcraft-active-title" className="break-words font-bold text-white">{current.title}</p>
            <p data-testid="pitchforks-songcraft-position">Position {current.position} of {current.total} · {lane === 'voice' ? 'Voice · singing' : 'Ear · listening'}</p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-300">Choose your song or a built-in exercise. Practice at your pace.</p>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 pb-6">
        {current ? (
          <section data-testid="pitchforks-songcraft-active" className="grid gap-4">
            <progress
              data-testid="pitchforks-songcraft-progress"
              className="h-2 w-full accent-cyan-300"
              value={progressValue(current.progress01)}
              max={1}
              aria-label="Practice progress"
            />
            <p role="status" aria-live="polite" aria-atomic="true" data-testid="pitchforks-songcraft-status" className="min-h-12 text-center text-sm leading-relaxed text-cyan-100">
              {current.message}
            </p>
            <div className={cardClass}>
              <ActiveContent
                active={current}
                lane={lane}
                onStartMic={onStartMic}
                onHear={onHear}
                onHint={onHint}
                onAnswer={onAnswer}
                onAcknowledge={onAcknowledge}
                onRetrySave={onRetrySave}
                onRetryNote={onRetryNote}
              />
            </div>
          </section>
        ) : (
          <SelectionView
            songs={songs}
            selectedKey={selectedKey}
            onSelect={onSelect}
            lane={lane}
            onLaneChange={onLaneChange}
            onBegin={onBegin}
          />
        )}

        <button
          type="button"
          data-testid="pitchforks-songcraft-return"
          className={`${controlClass} border-gray-600 text-gray-300`}
          onClick={onReturn}
        >
          RETURN
        </button>
      </div>
    </main>
  )
}

export default PitchforksSongcraftPanel
