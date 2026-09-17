'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PitchforksMasteryProjection } from './pitchforksMasteryProjection'
import type { SongcraftPracticeState } from './pitchforksSongcraftPractice'
import {
  advancePitchforksSongcraftVoiceSample, observePitchforksSongcraftGeneration,
  pitchforksSongcraftTargetFrequency, resetPitchforksSongcraftVisibilityState,
  SONGCRAFT_HOLD_MS, SONGCRAFT_STALE_AFTER_MS,
  type PitchforksSongcraftMicrophone,
} from './PitchforksSongcraft'
import { PITCHFORKS_PITCH_PROFILE } from './pitchDetectionSmoothing'
import { pitchforksMicUnreliable } from './pitchforksTunerFeedback'
import { advanceTempoEncore, canEnterTempoEncore, startTempoEncore, tempoEncoreCurrent,
  tempoEncoreInitialBpm, tempoEncoreRawOffsets, tempoEncoreReceipt, type TempoEncoreState } from './pitchforksTempoEncore'

export interface PitchforksTempoEncoreProps {
  readonly completedPractice: SongcraftPracticeState
  readonly masteryProjection?: PitchforksMasteryProjection
  readonly admittedNotes: readonly string[]
  readonly microphone: PitchforksSongcraftMicrophone
  readonly matchingSuppressed: () => boolean
  readonly onReturnUntimed: () => void
}

/** No persistence or audio playback port is accepted by this practice leaf. */
export function PitchforksTempoEncore(props: PitchforksTempoEncoreProps) {
  const phrase = props.completedPractice.phrase
  const [bpm, setBpm] = useState(() => tempoEncoreInitialBpm(phrase))
  const [session, setSession] = useState<TempoEncoreState | null>(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('Start your microphone, then begin when ready.')
  const [holdProgress, setHoldProgress] = useState(0)
  const [receipts, setReceipts] = useState<readonly { id: string; json: string }[]>([])
  const runId = useRef('')
  const savedRun = useRef('')
  const live = useRef(props)
  live.current = props
  const state = useRef<TempoEncoreState | null>(null)
  const mounted = useRef(false)
  const startToken = useRef(0)
  const frameId = useRef<number | null>(null)
  const targetOrdinal = useRef<number | null>(null)
  const hold = useRef({ heldMs: 0, matched: false })
  const dropout = useRef(0)
  const generation = useRef(resetPitchforksSongcraftVisibilityState(0).generation)
  const eligible = canEnterTempoEncore(phrase, props.completedPractice, props.masteryProjection)
    && phrase.occurrences.every(note => note.isRest || props.admittedNotes.includes(note.pitchName ?? ''))

  const publish = (next: TempoEncoreState) => {
    state.current = next
    if (mounted.current) setSession(next)
    if (next.status !== 'running' && runId.current && savedRun.current !== runId.current) {
      savedRun.current = runId.current
      const receipt = { id: runId.current, json: tempoEncoreReceipt(next, runId.current) }
      if (mounted.current) setReceipts(previous => [...previous, receipt])
    }
  }
  const stop = () => {
    startToken.current += 1
    if (frameId.current !== null) cancelAnimationFrame(frameId.current)
    frameId.current = null
    try { live.current.microphone.stop() } catch {}
  }
  const cancel = (reason: string) => {
    if (state.current?.status === 'running') publish(advanceTempoEncore(state.current, { type: 'cancel', now: performance.now() }))
    stop()
    setPending(false)
    setHoldProgress(0)
    setMessage(reason)
  }

  useEffect(() => {
    mounted.current = true
    const hidden = () => {
      if (document.visibilityState !== 'visible') cancel('Practice cancelled while the page was hidden. Begin a fresh take when ready.')
    }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      mounted.current = false
      stop()
      document.removeEventListener('visibilitychange', hidden)
    }
    // Callbacks read current microphone ownership from live, not stale props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const current = session ? tempoEncoreCurrent(session) : undefined
  useLayoutEffect(() => {
    if (!current || state.current?.status !== 'running') return
    // React's commit observation uses the same clock as input and scheduling.
    // This is not a measurement of physical screen presentation latency.
    publish(advanceTempoEncore(state.current, { type: 'visual', ordinal: current.ordinal, now: performance.now() }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.ordinal])

  const startMicrophone = async () => {
    if (pending || state.current?.status === 'running') return
    const token = ++startToken.current
    setPending(true)
    try {
      await live.current.microphone.start()
      if (!mounted.current || token !== startToken.current) {
        try { live.current.microphone.stop() } catch {}
        return
      }
      setMessage('Microphone started. Begin for a four-beat visual count-in.')
    } catch {
      if (mounted.current && token === startToken.current) setMessage('Microphone needs attention. Check permission and try again.')
    } finally {
      if (mounted.current && token === startToken.current) setPending(false)
    }
  }

  const begin = () => {
    if (!eligible || pending || state.current?.status === 'running') return
    if (receipts.length >= 20) {
      setMessage('Twenty takes retained. Download your receipts and return to untimed practice before starting another session.')
      return
    }
    if (document.visibilityState !== 'visible' || live.current.matchingSuppressed()) {
      setMessage('Wait for reference audio to finish before measuring.')
      return
    }
    const mic = live.current.microphone
    const health = mic.healthRef.current
    if (!mic.isListening || mic.error || health.audioContextState !== 'running'
      || health.trackReadyState !== 'live' || health.trackMuted) {
      setMessage('Start a healthy microphone before beginning.')
      return
    }
    try {
      const next = startTempoEncore(phrase, props.completedPractice, props.masteryProjection, bpm, performance.now())
      // Unsupported pitch/MIDI data is never replaced with a convenient note.
      if (phrase.occurrences.some(note => !note.isRest && pitchforksSongcraftTargetFrequency(note, props.admittedNotes) === null)) throw new Error('This phrase contains an unsupported note. Return to untimed practice.')
      runId.current = crypto.randomUUID()
      generation.current = resetPitchforksSongcraftVisibilityState(mic.generationRef.current).generation
      hold.current = { heldMs: 0, matched: false }
      targetOrdinal.current = null
      dropout.current = 0
      setHoldProgress(0)
      publish(next)
      setMessage('Follow the visual beat. Sing each note; stay silent through rests.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start this phrase.')
      return
    }

    const frame = () => {
      if (!mounted.current || state.current?.status !== 'running') return
      const now = performance.now()
      const p = live.current
      if (document.visibilityState !== 'visible' || p.matchingSuppressed()
        || !canEnterTempoEncore(phrase, p.completedPractice, p.masteryProjection)
        || p.completedPractice.phrase.sourceSha256 !== state.current.sourceSha256
        || p.completedPractice.phrase.occurrences.some(note => !note.isRest && !p.admittedNotes.includes(note.pitchName ?? ''))) {
        cancel('Practice cancelled because the source, eligibility, or measurement conditions changed.')
        return
      }
      let next = advanceTempoEncore(state.current, { type: 'tick', now })
      const row = tempoEncoreCurrent(next)
      const microphone = p.microphone
      const rawGeneration = microphone.generationRef.current
      if (!Number.isFinite(rawGeneration) || rawGeneration < (generation.current.lastGeneration ?? rawGeneration)) {
        cancel('The microphone restarted. Begin a fresh take when ready.')
        return
      }
      if ((row?.ordinal ?? null) !== targetOrdinal.current) {
        targetOrdinal.current = row?.ordinal ?? null
        hold.current = { heldMs: 0, matched: false }
        dropout.current = 0
        generation.current = resetPitchforksSongcraftVisibilityState(rawGeneration).generation
        setHoldProgress(0)
      }
      const observation = observePitchforksSongcraftGeneration(generation.current, rawGeneration, now)
      generation.current = observation.state
      const micHealth = microphone.healthRef.current
      const unreliable = pitchforksMicUnreliable({ hasTarget: true, isListening: microphone.isListening,
        micError: microphone.error, ...micHealth, matchingSuppressed: false, pageVisible: true,
        generationObserved: observation.state.generationObserved,
        generationAgeMs: observation.state.generationObserved ? now - observation.state.generationObservedAt : Infinity,
        staleAfterMs: SONGCRAFT_STALE_AFTER_MS })
      // Allow the first new generation; hardware faults always stop measurement.
      if (!microphone.isListening || microphone.error || micHealth.audioContextState !== 'running'
        || micHealth.trackReadyState !== 'live' || micHealth.trackMuted) {
        cancel('Microphone interrupted. This take is cancelled; start again when ready.')
        return
      }
      if (row && !row.isRest && row.visualAt !== null) {
        const occurrence = phrase.occurrences.find(note => note.ordinal === row.ordinal)
        const step = advancePitchforksSongcraftVoiceSample(hold.current, observation,
          microphone.pitchRef.current, pitchforksSongcraftTargetFrequency(occurrence, p.admittedNotes), !unreliable)
        hold.current = step.hold
        if (unreliable || step.sampleState === 'unavailable') {
          dropout.current += 1
          if (unreliable || dropout.current >= PITCHFORKS_PITCH_PROFILE.dropoutResetFrames) hold.current = { heldMs: 0, matched: false }
        } else dropout.current = 0
        if (observation.generationAdvanced && !observation.staleRecovery && !unreliable) {
          next = advanceTempoEncore(next, { type: 'detector', now, ordinal: row.ordinal,
            matching: step.sampleState === 'match', held: hold.current.matched })
        }
        setHoldProgress(Math.min(1, hold.current.heldMs / SONGCRAFT_HOLD_MS))
        setMessage(unreliable ? 'Waiting for fresh microphone observations.' : step.sampleState === 'wrong'
          ? 'Sing the authored note in its exact octave.' : hold.current.matched ? 'Pitch hold observed. Follow the next cue.' : 'Sing and hold the displayed note.')
      }
      publish(next)
      if (next.status === 'complete') {
        stop()
        setMessage('Take finished. These are raw software observations; device latency is unmeasured.')
      } else frameId.current = requestAnimationFrame(frame)
    }
    frameId.current = requestAnimationFrame(frame)
  }

  const running = session?.status === 'running'
  const beat = session ? Math.floor((session.observedAt - session.startedAt) / (60_000 / session.bpm)) : 0
  const offset = (value: number | null) => value === null ? 'Not observed' : `${value >= 0 ? '+' : ''}${value.toFixed(1)} ms`
  const download = (receipt: { id: string; json: string }) => {
    const url = URL.createObjectURL(new Blob([receipt.json], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `pitchforks-tempo-encore-${receipt.id}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <main className="fixed inset-0 overflow-y-auto bg-[#070914] p-4 text-white"><section aria-label="Optional Tempo Encore" className="mx-auto w-full max-w-2xl space-y-4 rounded-2xl border border-amber-400/40 bg-slate-950 p-4 text-white">
    <h2 className="text-xl font-semibold">Tempo Encore · optional practice</h2>
    <p>{phrase.title}</p>
    {phrase.sourceTempoBpm !== undefined && <p>Song tempo {phrase.sourceTempoBpm} BPM</p>}
    <p className="text-sm text-white">Uncalibrated practice timing. A visual beat for a phrase you already practised. No timing grade or mastery award. No reference tone plays during measurement.</p>
    <label className="flex flex-wrap items-center gap-3">Tempo (beats per minute)
      <input aria-label="Tempo beats per minute" type="number" min={30} max={180} step={1} value={bpm} disabled={running || pending}
        onChange={event => setBpm(Number(event.target.value))} className="w-24 rounded border border-slate-500 bg-slate-900 p-2" />
    </label>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={running || pending} onClick={() => void startMicrophone()} className="rounded border px-4 py-3 disabled:opacity-40">{pending ? 'Starting microphone…' : 'Start microphone'}</button>
      <button type="button" disabled={!eligible || running || pending} onClick={begin} className="rounded bg-amber-300 px-4 py-3 text-amber-950 disabled:opacity-40">Begin tempo practice</button>
      {running && <button type="button" onClick={() => cancel('Take cancelled. Retry slower or return to untimed practice.')} className="rounded border px-4 py-3">Cancel take</button>}
      <button type="button" onClick={() => {
        const wasRunning = state.current?.status === 'running'
        cancel('Returned to untimed practice.')
        if (wasRunning && state.current) download({ id: runId.current, json: tempoEncoreReceipt(state.current, runId.current) })
        props.onReturnUntimed()
      }} className="rounded border px-4 py-3">Return to untimed</button>
    </div>
    {!eligible && <p>Complete this exact phrase unaided and establish existing VOICE mastery for its notes before using Tempo Encore.</p>}
    {running && <div className="rounded-xl border border-amber-300/50 p-6 text-center">
      <p className="text-sm">{beat < 4 ? 'Count in' : 'Beat'} {beat < 4 ? beat + 1 : ((beat - 4) % 4) + 1}</p>
      <p className="mt-3 text-4xl font-bold">{current ? current.isRest ? 'Rest' : current.note : 'Get ready'}</p>
      {current && !current.isRest && holdProgress > 0 && <div role="progressbar" aria-label="Exact pitch hold" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(holdProgress * 100)} className="mx-auto mt-3 h-2 max-w-48 overflow-hidden rounded bg-slate-700">
        <div style={{ width: `${holdProgress * 100}%`, background: holdProgress >= 0.8 ? '#4ade80' : '#fbbf24', height: '100%' }} />
      </div>}
    </div>}
    <p role="status">{message}</p>
    {session && !running && <div className="space-y-3">
      <p className="text-sm">Offsets from each scheduled cue. Input means the first fresh matching detector observation, not physical onset. No latency compensation or pass/fail threshold.</p>
      <ol className="space-y-2">{session.observations.map(row => {
        const offsets = tempoEncoreRawOffsets(row)
        return <li key={row.ordinal} className="rounded border border-slate-700 p-3 text-sm">
          <strong>{row.ordinal + 1}. {row.isRest ? 'Rest (not scored)' : row.note}</strong>
          <p>Visual: {offset(offsets.visualOffsetMs)} · Input: {offset(offsets.inputOffsetMs)} · Hold: {offset(offsets.holdOffsetMs)}</p>
        </li>
      })}</ol>
      <details><summary>Raw monotonic timestamps</summary><pre className="max-h-64 overflow-auto text-xs">{JSON.stringify(session, null, 2)}</pre></details>
    </div>}
    {receipts.length > 0 && <div className="space-y-2">
      <p className="text-sm">Download each take before returning; receipts stay only in this practice screen.</p>
      {receipts.map((receipt, index) => <button key={receipt.id} type="button" onClick={() => download(receipt)} className="mr-2 rounded border px-4 py-3">Download take {index + 1}</button>)}
    </div>}
  </section></main>
}
