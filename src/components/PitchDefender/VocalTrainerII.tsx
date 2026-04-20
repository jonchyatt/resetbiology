'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// VocalTrainerII — Backward-Chain Pitch Pedagogy
// ═══════════════════════════════════════════════════════════════════════════════
//
// Master a song the way you memorize a monologue: start at the LAST phrase,
// prepend one earlier phrase per advancement, working window caps at 5-7
// phrases, periodic full-tail reviews. Same backwardChain engine LyricsTrainer
// uses — but the recall gate is PITCH PROXIMITY, not Web Speech word-match.
//
// Lyrics are scaffolding (always visible karaoke), not graded. Web Speech is
// unreliable on sung vowels, so we don't even try. The only signal is "are you
// close to the target pitch?" sampled at ~30 Hz against the phrase's notes.
//
// Spec: memory/projects/project_vocal_trainer_ii_backchain_pitch_spec.md
//
// V2-alongside-V1: VocalTrainer.tsx (V1) is untouched; this ships at a new
// route /pitch-defender/vocal-trainer-2.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MonologueState, ReviewSpan, createMonologueState, pickNextSpan,
  canAdvance, advance, lineId, transId, knownRange,
} from './engine/backwardChain'
import { recordResult, pickDepth, reinsert, createItem } from './engine/masteryQueue'
import { usePitchDetection, type PitchInfo } from './usePitchDetection'
import { PITCH_ON_TOLERANCE_CENTS } from './pitchMath'
import type { RawNote } from './extractNotesFromAudio'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LibraryItem {
  id: string
  title: string
  audioUrl: string | null
  templateUrl: string
  createdAt: string | null
  noteCount: number
}

interface FullTemplate {
  id: string
  title: string
  audioUrl: string | null
  notes: RawNote[]
  tempo: number
  durationSec: number
}

interface Phrase {
  startTimeSec: number
  endTimeSec: number
  notes: RawNote[]
  lyric: string
}

type Phase = 'menu' | 'lyrics' | 'practice' | 'recording' | 'feedback'
type OnsetMode = 'track' | 'voice'

interface PhraseScore {
  idx: number
  proximity: number    // 0..1 — mean per-sample proximity over note time
  passed: boolean      // proximity >= PHRASE_PASS_THRESHOLD
}

interface SpanResult {
  spanType: ReviewSpan['type']
  phraseScores: PhraseScore[]
  spanPassed: boolean
}

const PHRASE_PASS_THRESHOLD = 0.70
const PHRASE_GAP_FOR_SPLIT_SEC = 0.5         // note-gap > this → phrase boundary
const SAMPLE_INTERVAL_MS = 33                // ~30 Hz pitch sampling
const VOICE_ONSET_DBFS = -38                 // RMS gate for voice-onset mode
const COUNTDOWN_SEC = 3
const STORAGE_KEY = 'vt2_v1_state'

// ─── Helpers ────────────────────────────────────────────────────────────────

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Auto-derive phrases by splitting on note-gaps. */
function derivePhrases(notes: RawNote[]): Array<{ startTimeSec: number; endTimeSec: number; notes: RawNote[] }> {
  if (notes.length === 0) return []
  const sorted = [...notes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
  const out: Array<{ startTimeSec: number; endTimeSec: number; notes: RawNote[] }> = []
  let currentNotes: RawNote[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    const prevEnd = prev.startTimeSeconds + prev.durationSeconds
    const gap = cur.startTimeSeconds - prevEnd
    if (gap >= PHRASE_GAP_FOR_SPLIT_SEC) {
      const start = currentNotes[0].startTimeSeconds
      const last = currentNotes[currentNotes.length - 1]
      out.push({ startTimeSec: start, endTimeSec: last.startTimeSeconds + last.durationSeconds, notes: currentNotes })
      currentNotes = [cur]
    } else {
      currentNotes.push(cur)
    }
  }
  if (currentNotes.length > 0) {
    const start = currentNotes[0].startTimeSeconds
    const last = currentNotes[currentNotes.length - 1]
    out.push({ startTimeSec: start, endTimeSec: last.startTimeSeconds + last.durationSeconds, notes: currentNotes })
  }
  return out
}

/** Find the active note at phrase-relative time `t` (sec from phrase start). */
function activeNoteAt(phrase: Phrase, tInPhrase: number): RawNote | null {
  for (const n of phrase.notes) {
    const start = n.startTimeSeconds - phrase.startTimeSec
    const end = start + n.durationSeconds
    if (tInPhrase >= start && tInPhrase < end) return n
  }
  return null
}

/** Continuous proximity from cents deviation: 0¢ = 1.0, 100¢ = 0.0. */
function proximityFromCents(cents: number): number {
  return Math.max(0, 1 - Math.abs(cents) / 100)
}

/**
 * Unfolded cents — actual signed deviation from target frequency. Unlike
 * pitchMath.octaveFoldedCents, this does NOT collapse octave equivalents,
 * so singing C5 against a C4 target reads as +1200, not 0. We grade with
 * this because VocalTrainerII is a mastery tool, not an arcade game —
 * wrong-octave singing should not score 100%.
 */
function unfoldedCents(detectedFreq: number, targetFreq: number): number {
  if (detectedFreq <= 0 || targetFreq <= 0) return 0
  return 1200 * Math.log2(detectedFreq / targetFreq)
}

/** Pitch-graded analog of backwardChain.gradeSpan. Updates engine + cycle counters. */
function gradeSpanByPitch(
  state: MonologueState,
  span: ReviewSpan,
  phraseScores: PhraseScore[],
): SpanResult {
  for (const ps of phraseScores) {
    const lid = lineId(ps.idx)
    if (!state.engine.items[lid]) {
      state.engine.items[lid] = createItem(lid, 'line', { lineIdx: ps.idx })
    }
    recordResult(state.engine, lid, ps.passed)
    const item = state.engine.items[lid]
    if (item) reinsert(state.engine, lid, pickDepth(state.engine, item, ps.passed))
  }
  // Transitions: pass when both adjacent phrases passed (mirrors gradeSpan)
  for (let k = 0; k < phraseScores.length - 1; k++) {
    const a = phraseScores[k], b = phraseScores[k + 1]
    const passed = a.passed && b.passed
    const tid = transId(a.idx)
    if (!state.engine.items[tid]) {
      state.engine.items[tid] = createItem(tid, 'transition', { fromIdx: a.idx, toIdx: b.idx })
    }
    recordResult(state.engine, tid, passed)
    const item = state.engine.items[tid]
    if (item) reinsert(state.engine, tid, pickDepth(state.engine, item, passed))
  }
  const passedAll = phraseScores.every(p => p.passed)
  const transitionsAllPassed = (() => {
    for (let k = 0; k < phraseScores.length - 1; k++) {
      if (!(phraseScores[k].passed && phraseScores[k + 1].passed)) return false
    }
    return true
  })()
  const spanPassed = passedAll && transitionsAllPassed

  if (span.type === 'ramp-solo' || span.type === 'ramp-cluster') {
    state.rampRemaining = Math.max(0, state.rampRemaining - 1)
  } else if (span.type === 'working') {
    state.lastWorkingPassed = spanPassed
    state.workingCycle += 1
  } else if (span.type === 'medium') {
    state.lastMediumPassed = spanPassed
    state.mediumCycle += 1
    state.workingCycle = 0
  } else {
    state.lastFullPassed = spanPassed
    state.mediumCycle = 0
    state.workingCycle = 0
  }
  return { spanType: span.type, phraseScores, spanPassed }
}

// ─── Persistence ────────────────────────────────────────────────────────────

interface Persisted {
  templateId: string | null
  monologue: MonologueState | null
  phrases: Phrase[]
  onsetMode: OnsetMode
}

function defaultPersisted(): Persisted {
  return { templateId: null, monologue: null, phrases: [], onsetMode: 'track' }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function VocalTrainerII() {
  const [library, setLibrary] = useState<LibraryItem[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [template, setTemplate] = useState<FullTemplate | null>(null)
  const [persisted, setPersisted] = useState<Persisted>(defaultPersisted)
  const [phase, setPhase] = useState<Phase>('menu')
  const [pendingPhrases, setPendingPhrases] = useState<Array<{ startTimeSec: number; endTimeSec: number; notes: RawNote[] }>>([])
  const [lyricsPaste, setLyricsPaste] = useState('')
  const [currentSpan, setCurrentSpan] = useState<ReviewSpan | null>(null)
  const [currentPhraseInSpan, setCurrentPhraseInSpan] = useState(0)
  const [phraseScores, setPhraseScores] = useState<PhraseScore[]>([])
  const [spanResult, setSpanResult] = useState<SpanResult | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [livePitch, setLivePitch] = useState<PitchInfo | null>(null)
  const [liveCents, setLiveCents] = useState(0)             // cents to current target note
  const [liveProximity, setLiveProximity] = useState(0)     // 0..1
  const [trackVol, setTrackVol] = useState(70)
  const [statusMsg, setStatusMsg] = useState<string>('')

  // Pitch detection (browser-native AEC handles backing-track bleed,
  // same pattern as Pitchforks / ChoirPractice / usePitchDetection's defaults)
  const { pitch, pitchRef, startListening, stopListening, isListening, error: pitchError } =
    usePitchDetection()

  // Audio playback for backing track
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioGainRef = useRef<GainNode | null>(null)

  // Sampling refs
  const samplingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phraseStartWallTimeRef = useRef(0)
  const phraseStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const samplesRef = useRef<Array<{ tInPhrase: number; cents: number; proximity: number; hadNote: boolean }>>([])

  // Latest-callback refs — the sampling interval calls these by ref, not by
  // closure, so it never holds a stale snapshot of state from the render where
  // it was first scheduled. (Codex CRITICAL fix: beginPhraseSampling was
  // closure-capturing the initial finishPhrase, with currentSpan=null.)
  const finishPhraseRef = useRef<(p: Phrase) => void>(() => {})
  const startPhraseRecitationRef = useRef<(span: ReviewSpan, idx: number) => void>(() => {})

  // Sync live pitch state from hook
  useEffect(() => { setLivePitch(pitch) }, [pitch])

  // ─── Persistence ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setPersisted(JSON.parse(raw))
    } catch { /* fresh */ }
  }, [])

  const persist = useCallback((next: Persisted) => {
    setPersisted(next)
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* quota */ }
  }, [])

  // ─── Library fetch ────────────────────────────────────────────────────────
  const refreshLibrary = useCallback(async () => {
    setLoadingLibrary(true)
    try {
      const r = await fetch('/api/vocal-trainer/library', { cache: 'no-store' })
      const j = await r.json()
      setLibrary(j.templates || [])
    } catch (e) {
      console.error('[VocalTrainerII] library fetch failed:', e)
    } finally {
      setLoadingLibrary(false)
    }
  }, [])

  useEffect(() => { refreshLibrary() }, [refreshLibrary])

  // ─── Pick template ────────────────────────────────────────────────────────
  const pickTemplate = useCallback(async (item: LibraryItem) => {
    try {
      const r = await fetch(item.templateUrl, { cache: 'no-store' })
      const tpl = await r.json() as FullTemplate
      setTemplate(tpl)
      const derived = derivePhrases(tpl.notes || [])
      setPendingPhrases(derived)
      setLyricsPaste('')
      setStatusMsg(`Loaded "${tpl.title}" — ${tpl.notes?.length || 0} notes auto-split into ${derived.length} phrases. Now paste matching lyrics, one phrase per line.`)
      setPhase('lyrics')
    } catch (e) {
      setStatusMsg(`Template load failed: ${e instanceof Error ? e.message : e}`)
    }
  }, [])

  // ─── Confirm lyrics + start practice ──────────────────────────────────────
  const confirmLyrics = useCallback(() => {
    if (!template) return
    const lyricLines = lyricsPaste.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
    const phrases: Phrase[] = pendingPhrases.map((p, i) => ({
      ...p,
      lyric: lyricLines[i] ?? `[phrase ${i + 1}]`,
    }))
    if (phrases.length === 0) {
      setStatusMsg('No phrases derived — template may have no notes.')
      return
    }
    const mono = createMonologueState(phrases.map(p => p.lyric))
    persist({ templateId: template.id, monologue: mono, phrases, onsetMode: persisted.onsetMode })
    setPhase('practice')
    setStatusMsg(
      lyricLines.length === phrases.length
        ? `Aligned ${phrases.length} lyrics to ${phrases.length} phrases. Ready.`
        : `WARN: ${lyricLines.length} lyric lines vs ${phrases.length} phrases. Extras ignored, missing filled with [phrase N].`
    )
  }, [template, pendingPhrases, lyricsPaste, persist, persisted.onsetMode])

  // ─── Decode template audio (backing track) ────────────────────────────────
  useEffect(() => {
    if (!template?.audioUrl) return
    let cancelled = false
    ;(async () => {
      try {
        const ctx = audioCtxRef.current ?? new AudioContext()
        audioCtxRef.current = ctx
        if (ctx.state === 'suspended') await ctx.resume()
        const r = await fetch(template.audioUrl!)
        const arr = await r.arrayBuffer()
        const buf = await ctx.decodeAudioData(arr.slice(0))
        if (!cancelled) audioBufferRef.current = buf
      } catch (e) {
        console.warn('[VocalTrainerII] audio decode failed:', e)
      }
    })()
    return () => { cancelled = true }
  }, [template])

  // ─── Recitation: play span, sample pitch, score ───────────────────────────
  const stopAudio = useCallback(() => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop() } catch {}
      try { audioSourceRef.current.disconnect() } catch {}
      audioSourceRef.current = null
    }
  }, [])

  const stopSampling = useCallback(() => {
    if (samplingTimerRef.current) {
      clearInterval(samplingTimerRef.current)
      samplingTimerRef.current = null
    }
    if (phraseStartTimerRef.current) {
      clearTimeout(phraseStartTimerRef.current)
      phraseStartTimerRef.current = null
    }
  }, [])

  const playPhraseAudio = useCallback((phrase: Phrase) => {
    const ctx = audioCtxRef.current
    const buf = audioBufferRef.current
    if (!ctx || !buf) return
    stopAudio()
    const src = ctx.createBufferSource()
    src.buffer = buf
    if (!audioGainRef.current) {
      audioGainRef.current = ctx.createGain()
      audioGainRef.current.connect(ctx.destination)
    }
    audioGainRef.current.gain.value = trackVol / 100
    src.connect(audioGainRef.current)
    const dur = Math.max(0.1, phrase.endTimeSec - phrase.startTimeSec)
    src.start(0, phrase.startTimeSec, dur)
    audioSourceRef.current = src
  }, [stopAudio, trackVol])

  const beginPhraseSampling = useCallback((phrase: Phrase, durationSec: number) => {
    samplesRef.current = []
    phraseStartWallTimeRef.current = performance.now()
    samplingTimerRef.current = setInterval(() => {
      const tInPhrase = (performance.now() - phraseStartWallTimeRef.current) / 1000
      if (tInPhrase >= durationSec) {
        stopSampling()
        // Call by ref — finishPhrase reads currentSpan/persisted/phraseScores
        // which change every render. Closure-capturing the function would
        // freeze it to the initial-render snapshot (currentSpan=null).
        finishPhraseRef.current(phrase)
        return
      }
      const targetNote = activeNoteAt(phrase, tInPhrase)
      const p = pitchRef.current
      if (!targetNote) {
        samplesRef.current.push({ tInPhrase, cents: 0, proximity: 0, hadNote: false })
        setLiveCents(0); setLiveProximity(0)
        return
      }
      if (!p || !p.isActive || p.frequency <= 0) {
        // No detected pitch during a target note = miss for this sample.
        samplesRef.current.push({ tInPhrase, cents: 0, proximity: 0, hadNote: true })
        setLiveCents(0); setLiveProximity(0)
        return
      }
      const targetFreq = midiToFreq(targetNote.pitchMidi)
      // Unfolded — wrong octave should NOT score 100%. (Codex HIGH fix.)
      const cents = unfoldedCents(p.frequency, targetFreq)
      const proximity = proximityFromCents(cents)
      samplesRef.current.push({ tInPhrase, cents, proximity, hadNote: true })
      setLiveCents(cents); setLiveProximity(proximity)
    }, SAMPLE_INTERVAL_MS)
  }, [pitchRef, stopSampling])

  const finishPhrase = useCallback((phrase: Phrase) => {
    stopAudio()
    // Compute phrase score from samples that fell during a note
    const noteSamples = samplesRef.current.filter(s => s.hadNote)
    const proximity = noteSamples.length > 0
      ? noteSamples.reduce((s, x) => s + x.proximity, 0) / noteSamples.length
      : 0
    const passed = proximity >= PHRASE_PASS_THRESHOLD
    const phraseIdx = persisted.phrases.indexOf(phrase)
    const score: PhraseScore = { idx: phraseIdx, proximity, passed }

    setPhraseScores(prev => [...prev, score])

    // Advance to next phrase in span, or grade the whole span
    const nextInSpan = currentPhraseInSpan + 1
    if (currentSpan && nextInSpan <= currentSpan.endIdx - currentSpan.startIdx) {
      setCurrentPhraseInSpan(nextInSpan)
      // Call via ref — startPhraseRecitation closure-captures persisted at
      // its useCallback definition; if persisted changed since then we'd
      // re-enter with stale phrases. Ref always reads the latest.
      setTimeout(() => startPhraseRecitationRef.current(currentSpan, nextInSpan), 600)
    } else {
      // Span complete — grade
      if (currentSpan && persisted.monologue) {
        const allScores = [...phraseScores, score]
        const result = gradeSpanByPitch(persisted.monologue, currentSpan, allScores)
        setSpanResult(result)
        // Engine state was mutated in place. Break monologue reference equality
        // so memoized consumers (knownInfo, etc.) recompute. (Codex MEDIUM fix.)
        persist({ ...persisted, monologue: { ...persisted.monologue } })
      }
      setPhase('feedback')
      stopListening()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSpan, currentPhraseInSpan, phraseScores, persisted, stopAudio, stopListening])

  // Keep latest-callback refs in sync each render so the sampling interval
  // and the recursive recitation chain always see fresh state.
  useEffect(() => { finishPhraseRef.current = finishPhrase }, [finishPhrase])

  const startPhraseRecitation = useCallback((span: ReviewSpan, phraseIdxInSpan: number) => {
    const phraseIdx = span.startIdx + phraseIdxInSpan
    const phrase = persisted.phrases[phraseIdx]
    if (!phrase) return
    setPhase('recording')
    setLiveCents(0); setLiveProximity(0)
    const durationSec = Math.max(0.5, phrase.endTimeSec - phrase.startTimeSec)

    if (persisted.onsetMode === 'track') {
      // Backing-track time mode: play track + start sampling immediately.
      playPhraseAudio(phrase)
      beginPhraseSampling(phrase, durationSec)
    } else {
      // Voice-onset mode: poll RMS via pitchRef.isActive → start when active.
      // Cap wait at 4s so a silent learner doesn't deadlock the loop.
      const waitStart = performance.now()
      const checkOnset = () => {
        const p = pitchRef.current
        if (p?.isActive) {
          beginPhraseSampling(phrase, durationSec)
          return
        }
        if (performance.now() - waitStart > 4000) {
          // Timed out — start anyway so the loop progresses.
          beginPhraseSampling(phrase, durationSec)
          return
        }
        phraseStartTimerRef.current = setTimeout(checkOnset, 50)
      }
      checkOnset()
    }
  }, [persisted, playPhraseAudio, beginPhraseSampling, pitchRef])

  // Keep recitation-recall ref fresh too — finishPhrase chains back into
  // startPhraseRecitation by ref, and persisted changes between phrases.
  useEffect(() => { startPhraseRecitationRef.current = startPhraseRecitation }, [startPhraseRecitation])

  // ─── Span lifecycle ───────────────────────────────────────────────────────
  const startNextSpan = useCallback(async () => {
    if (!persisted.monologue) return
    const span = pickNextSpan(persisted.monologue)
    setCurrentSpan(span)
    setCurrentPhraseInSpan(0)
    setPhraseScores([])
    setSpanResult(null)
    setPhase('practice')
    // Start mic
    if (!isListening) await startListening()
    // Countdown then begin
    setCountdown(COUNTDOWN_SEC)
    let n = COUNTDOWN_SEC
    const tick = () => {
      n -= 1
      if (n <= 0) {
        setCountdown(null)
        startPhraseRecitation(span, 0)
      } else {
        setCountdown(n)
        setTimeout(tick, 1000)
      }
    }
    setTimeout(tick, 1000)
  }, [persisted.monologue, startPhraseRecitation, isListening, startListening])

  const tryAdvance = useCallback(() => {
    if (!persisted.monologue) return
    if (canAdvance(persisted.monologue)) {
      advance(persisted.monologue)
      // Same monologue-reference fix as in finishPhrase: break ref equality
      // so memoized consumers re-derive after the engine grew its known set.
      persist({ ...persisted, monologue: { ...persisted.monologue } })
    }
  }, [persisted, persist])

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => {
    stopSampling()
    stopAudio()
    stopListening()
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Derived UI state ─────────────────────────────────────────────────────
  const knownInfo = useMemo(() => {
    if (!persisted.monologue) return null
    const [start, end] = knownRange(persisted.monologue)
    return { knownCount: end - start + 1, total: persisted.phrases.length, start, end }
  }, [persisted.monologue, persisted.phrases.length])

  const currentPhrase: Phrase | null = useMemo(() => {
    if (!currentSpan) return null
    const idx = currentSpan.startIdx + currentPhraseInSpan
    return persisted.phrases[idx] ?? null
  }, [currentSpan, currentPhraseInSpan, persisted.phrases])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#08080f] text-gray-100 p-4 flex flex-col items-center">
      <div className="w-full max-w-3xl flex items-center justify-between mb-3">
        <a href="/pitch-defender" className="text-xs text-indigo-400 hover:text-indigo-200">
          ← Back to Pitch Defender
        </a>
        <a href="/pitch-defender/vocal-trainer" className="text-[11px] px-2 py-1 rounded text-amber-300 border border-amber-700/60 hover:bg-amber-950/30">
          ⮌ Original Vocal Trainer (V1)
        </a>
      </div>

      <h1 className="text-2xl font-black tracking-wider text-cyan-300 mb-1" style={{ textShadow: '0 0 12px rgba(120,200,255,0.5)' }}>
        VOCAL TRAINER II
      </h1>
      <p className="text-[11px] text-gray-500 mb-4 text-center max-w-lg">
        Backward-chain song mastery. Master the LAST phrase, prepend earlier phrases one at a time.
        Lyrics shown as scaffolding; only PITCH is graded.
      </p>

      {pitchError && (
        <div className="text-xs text-red-400 mb-2">Mic error: {pitchError}</div>
      )}
      {statusMsg && (
        <div className="text-xs text-gray-400 mb-2 max-w-2xl text-center">{statusMsg}</div>
      )}

      {/* ─── MENU: pick template ────────────────────────────────────────── */}
      {phase === 'menu' && (
        <div className="w-full max-w-2xl">
          <div className="text-sm font-semibold text-gray-300 mb-2">Pick a saved Vocal Trainer template:</div>
          {loadingLibrary && <div className="text-xs text-gray-500">Loading library…</div>}
          {!loadingLibrary && library.length === 0 && (
            <div className="text-xs text-gray-500">
              No templates yet. Use{' '}
              <a href="/pitch-defender/vocal-trainer" className="text-amber-400 hover:text-amber-200">Vocal Trainer V1</a>
              {' '}to upload audio first — it extracts notes via BasicPitch and saves a template.
            </div>
          )}
          <div className="space-y-1">
            {library.map(item => (
              <button
                key={item.id}
                onClick={() => pickTemplate(item)}
                className="w-full text-left px-3 py-2 rounded border border-gray-700 hover:border-cyan-500 hover:bg-cyan-950/20"
              >
                <div className="text-sm text-gray-100">{item.title}</div>
                <div className="text-[10px] text-gray-500">{item.noteCount} notes · {item.createdAt?.slice(0, 10) ?? ''}</div>
              </button>
            ))}
          </div>

          {/* Onset mode toggle */}
          <div className="mt-6 p-3 border border-gray-800 rounded">
            <div className="text-xs font-semibold text-gray-300 mb-2">Phrase-onset timing</div>
            <div className="flex gap-2">
              <button
                onClick={() => persist({ ...persisted, onsetMode: 'track' })}
                className={`text-[11px] px-3 py-1.5 rounded ${persisted.onsetMode === 'track' ? 'bg-cyan-900/60 text-cyan-200 border border-cyan-700' : 'bg-gray-900 text-gray-400 border border-gray-700'}`}
              >
                Track time (default)
              </button>
              <button
                onClick={() => persist({ ...persisted, onsetMode: 'voice' })}
                className={`text-[11px] px-3 py-1.5 rounded ${persisted.onsetMode === 'voice' ? 'bg-cyan-900/60 text-cyan-200 border border-cyan-700' : 'bg-gray-900 text-gray-400 border border-gray-700'}`}
              >
                Voice onset (experimental)
              </button>
            </div>
            <div className="text-[10px] text-gray-500 mt-2">
              Track time = play backing audio + sample pitch at backing-track time. Voice onset = wait for you to start singing, then sample. Voice onset is expected to drift; try it anyway.
            </div>
          </div>
        </div>
      )}

      {/* ─── LYRICS: paste lyrics aligned to phrases ────────────────────── */}
      {phase === 'lyrics' && template && (
        <div className="w-full max-w-2xl">
          <div className="text-sm font-semibold text-gray-300 mb-2">
            Paste lyrics — one line per phrase. {pendingPhrases.length} phrases auto-derived.
          </div>
          <textarea
            value={lyricsPaste}
            onChange={e => setLyricsPaste(e.target.value)}
            className="w-full h-64 p-3 bg-gray-950 border border-gray-700 rounded text-sm text-gray-100 font-mono"
            placeholder={Array.from({ length: Math.min(pendingPhrases.length, 6) }, (_, i) => `Phrase ${i + 1} lyric`).join('\n')}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={confirmLyrics}
              className="px-4 py-2 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold"
            >
              Confirm &amp; start practice
            </button>
            <button
              onClick={() => { setPhase('menu'); setTemplate(null) }}
              className="px-4 py-2 rounded border border-gray-700 text-gray-400 hover:bg-gray-900 text-sm"
            >
              Back
            </button>
          </div>
          <div className="text-[10px] text-gray-600 mt-2">
            Auto-derived phrase boundaries: note-gap ≥ 0.5s. Manual phrase editor lives in V2 of this V2 (post-MVP).
          </div>
        </div>
      )}

      {/* ─── PRACTICE: span overview ────────────────────────────────────── */}
      {(phase === 'practice' || phase === 'recording' || phase === 'feedback') && persisted.monologue && knownInfo && (
        <div className="w-full max-w-3xl space-y-3">
          {/* Status header */}
          <div className="text-xs text-gray-400 flex justify-between">
            <span>
              Known: phrases {knownInfo.start + 1}–{knownInfo.end + 1} of {knownInfo.total}
            </span>
            <span>
              Onset: <span className="text-cyan-300">{persisted.onsetMode}</span>
            </span>
          </div>

          {/* Span tiles */}
          {currentSpan && (
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: currentSpan.endIdx - currentSpan.startIdx + 1 }, (_, i) => {
                const phraseIdx = currentSpan.startIdx + i
                const ph = persisted.phrases[phraseIdx]
                const score = phraseScores.find(s => s.idx === phraseIdx)
                const isActive = i === currentPhraseInSpan && phase === 'recording'
                return (
                  <div
                    key={phraseIdx}
                    className={`px-2 py-1 rounded text-[11px] border ${
                      isActive ? 'bg-cyan-900/60 border-cyan-500 text-cyan-100' :
                      score ? (score.passed ? 'bg-green-950/40 border-green-700 text-green-300' : 'bg-amber-950/40 border-amber-700 text-amber-300') :
                      'bg-gray-900 border-gray-700 text-gray-400'
                    }`}
                    title={ph?.lyric}
                  >
                    {phraseIdx + 1}{score ? ` · ${Math.round(score.proximity * 100)}%` : ''}
                  </div>
                )
              })}
            </div>
          )}

          {/* Countdown */}
          {countdown !== null && (
            <div className="text-6xl font-black text-center text-cyan-300 my-8">{countdown}</div>
          )}

          {/* Active phrase + pitch meter */}
          {phase === 'recording' && currentPhrase && (
            <div className="border border-cyan-700/40 rounded-lg p-4 bg-cyan-950/10">
              <div className="text-[10px] text-gray-500 mb-1">Sing this phrase:</div>
              <div className="text-lg text-gray-100 mb-3">{currentPhrase.lyric}</div>

              {/* Mini piano-roll for current phrase */}
              <div className="relative h-16 bg-black/40 rounded mb-3 overflow-hidden">
                {(() => {
                  if (currentPhrase.notes.length === 0) return null
                  const dur = currentPhrase.endTimeSec - currentPhrase.startTimeSec
                  const midis = currentPhrase.notes.map(n => n.pitchMidi)
                  const minM = Math.min(...midis) - 2
                  const maxM = Math.max(...midis) + 2
                  const range = Math.max(1, maxM - minM)
                  const tInPhrase = phase === 'recording'
                    ? (performance.now() - phraseStartWallTimeRef.current) / 1000
                    : 0
                  return (
                    <>
                      {currentPhrase.notes.map((n, i) => {
                        const left = ((n.startTimeSeconds - currentPhrase.startTimeSec) / dur) * 100
                        const width = (n.durationSeconds / dur) * 100
                        const top = (1 - (n.pitchMidi - minM) / range) * 100
                        return (
                          <div
                            key={i}
                            className="absolute bg-cyan-700/60 rounded-sm"
                            style={{ left: `${left}%`, width: `${width}%`, top: `${top}%`, height: '12%' }}
                          />
                        )
                      })}
                      {/* Playhead */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-amber-400/80"
                        style={{ left: `${Math.min(100, (tInPhrase / dur) * 100)}%` }}
                      />
                      {/* Detected pitch dot */}
                      {livePitch?.isActive && livePitch.frequency > 0 && (() => {
                        const detMidi = 69 + 12 * Math.log2(livePitch.frequency / 440)
                        // Octave-fold to nearest in-range octave
                        let m = detMidi
                        while (m < minM) m += 12
                        while (m > maxM) m -= 12
                        const top = (1 - (m - minM) / range) * 100
                        return (
                          <div
                            className="absolute w-2 h-2 rounded-full bg-amber-300 border border-white"
                            style={{
                              left: `calc(${Math.min(100, (tInPhrase / dur) * 100)}% - 4px)`,
                              top: `calc(${top}% - 4px)`,
                            }}
                          />
                        )
                      })()}
                    </>
                  )
                })()}
              </div>

              {/* Pitchforks v1 slider bar — the canonical mic feedback meter */}
              <div className="relative h-4 bg-gradient-to-r from-rose-900 via-emerald-900 to-rose-900 rounded">
                {/* Tolerance band */}
                <div
                  className="absolute top-0 bottom-0 bg-emerald-500/20 border-l border-r border-emerald-400/40"
                  style={{
                    left: `${50 - (PITCH_ON_TOLERANCE_CENTS / 600) * 50}%`,
                    width: `${(PITCH_ON_TOLERANCE_CENTS / 600) * 100}%`,
                  }}
                />
                {/* Center line (target) */}
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/60" />
                {/* You-marker */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-amber-300 transition-[left] duration-75"
                  style={{ left: `calc(${50 + (Math.max(-600, Math.min(600, liveCents)) / 600) * 50}% - 2px)` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>flat -600¢</span>
                <span className={Math.abs(liveCents) <= PITCH_ON_TOLERANCE_CENTS ? 'text-emerald-300' : ''}>
                  {liveCents > 0 ? '+' : ''}{Math.round(liveCents)}¢ · {Math.round(liveProximity * 100)}%
                </span>
                <span>+600¢ sharp</span>
              </div>
            </div>
          )}

          {/* Practice menu (between spans) */}
          {phase === 'practice' && countdown === null && !spanResult && (
            <div className="flex flex-col items-center gap-3 py-4">
              <button
                onClick={startNextSpan}
                className="px-6 py-3 rounded-lg text-base font-bold text-white bg-cyan-700 hover:bg-cyan-600"
              >
                Begin recitation
              </button>
              <div className="text-[10px] text-gray-500 text-center max-w-md">
                Backward-chain engine picks the next span. Window grows as you advance.
              </div>
            </div>
          )}

          {/* Feedback after span */}
          {phase === 'feedback' && spanResult && (
            <div className="border border-gray-700 rounded p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-semibold text-gray-200">
                  Span result: <span className={spanResult.spanPassed ? 'text-emerald-300' : 'text-amber-300'}>
                    {spanResult.spanPassed ? 'PASSED' : 'KEEP PRACTICING'}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500">{spanResult.spanType}</div>
              </div>
              <div className="space-y-1">
                {spanResult.phraseScores.map(ps => {
                  const ph = persisted.phrases[ps.idx]
                  return (
                    <div key={ps.idx} className="flex items-center gap-2 text-xs">
                      <div className="w-8 text-right text-gray-500">{ps.idx + 1}</div>
                      <div className="flex-1 h-3 bg-gray-900 rounded relative overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 ${ps.passed ? 'bg-emerald-600' : 'bg-amber-600'}`}
                          style={{ width: `${Math.round(ps.proximity * 100)}%` }}
                        />
                      </div>
                      <div className="w-12 text-gray-400">{Math.round(ps.proximity * 100)}%</div>
                      <div className="flex-[2] truncate text-gray-500" title={ph?.lyric}>{ph?.lyric}</div>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={startNextSpan}
                  className="px-4 py-2 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold"
                >
                  Next span
                </button>
                {persisted.monologue && canAdvance(persisted.monologue) && (
                  <button
                    onClick={tryAdvance}
                    className="px-4 py-2 rounded bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-semibold"
                    title="Prepend one earlier phrase to the working window"
                  >
                    + Prepend earlier phrase
                  </button>
                )}
                <button
                  onClick={() => { setPhase('menu'); stopAudio(); stopSampling(); stopListening() }}
                  className="px-4 py-2 rounded border border-gray-700 text-gray-400 hover:bg-gray-900 text-sm"
                >
                  Back to menu
                </button>
              </div>
            </div>
          )}

          {/* Backing-track volume slider (visible during practice/recording) */}
          {(phase === 'practice' || phase === 'recording') && template?.audioUrl && (
            <div className="text-[11px] text-gray-500 flex items-center gap-2">
              <span>Backing volume</span>
              <input
                type="range" min={0} max={200} value={trackVol}
                onChange={e => {
                  const v = Number(e.target.value); setTrackVol(v)
                  if (audioGainRef.current) audioGainRef.current.gain.value = v / 100
                }}
                className="flex-1"
              />
              <span className="w-10 text-right">{trackVol}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
