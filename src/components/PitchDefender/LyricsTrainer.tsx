'use client'

// ═══════════════════════════════════════════════════════════════════════════
// LyricsTrainer — Monologue / Lyrics Memorization with Backward Chaining
// ═══════════════════════════════════════════════════════════════════════════
//
// Start at the last line. Master, prepend one earlier line, repeat.
// Working window caps at 5-7 lines. Periodic 8-13 line medium reviews +
// occasional full-tail runs verify chaining before advancing. Per-line AND
// per-transition scoring. Mic-only recall via Web Speech API — no typing.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MonologueState, ReviewSpan, createMonologueState, pickNextSpan,
  gradeSpan, canAdvance, advance, lineId, transId, knownRange,
} from './engine/backwardChain'

const STORAGE_KEY = 'lt_v1_state'

type Phase = 'menu' | 'paste' | 'intro' | 'reciting' | 'grading' | 'feedback'

interface Persisted {
  title: string
  monologue: MonologueState | null
  sessions: number
  lastSpanPassed: boolean
}

function defaultPersisted(): Persisted {
  return { title: '', monologue: null, sessions: 0, lastSpanPassed: false }
}

// ─── SpeechRecognition types (Web Speech is non-standard) ──────────────────

type Rec = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: (e: any) => void
  onerror: (e: any) => void
  onend: () => void
  start: () => void
  stop: () => void
}

function getSpeechRecognition(): (new () => Rec) | null {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function LyricsTrainer() {
  const [state, setState] = useState<Persisted>(defaultPersisted)
  const [phase, setPhase] = useState<Phase>('menu')
  const [pasteText, setPasteText] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [currentSpan, setCurrentSpan] = useState<ReviewSpan | null>(null)
  const [transcript, setTranscript] = useState('')
  const [grading, setGrading] = useState<ReturnType<typeof gradeSpan> | null>(null)
  const [listening, setListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)

  const recRef = useRef<Rec | null>(null)
  const speechOk = useMemo(() => !!getSpeechRecognition(), [])

  // ─── Persistence ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted
        setState(parsed)
      }
    } catch { /* fresh */ }
  }, [])

  const persist = useCallback((s: Persisted) => {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }
    catch { /* quota */ }
  }, [])

  // ─── Load monologue from paste ──────────────────────────────────────────
  const loadMonologue = useCallback(() => {
    const lines = pasteText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
    if (lines.length === 0) return
    const mono = createMonologueState(lines)
    const next: Persisted = { title: titleDraft || 'Untitled', monologue: mono, sessions: 0, lastSpanPassed: false }
    setState(next); persist(next)
    setPhase('intro')
  }, [pasteText, titleDraft, persist])

  // ─── Start round ────────────────────────────────────────────────────────
  const startRound = useCallback(() => {
    if (!state.monologue) return
    const span = pickNextSpan(state.monologue)
    setCurrentSpan(span)
    setTranscript('')
    setGrading(null)
    setSpeechError(null)
    setPhase('reciting')
    startListening()
  }, [state.monologue])

  // ─── Speech recognition ─────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const Rec = getSpeechRecognition()
    if (!Rec) { setSpeechError('Speech recognition not supported on this browser. Use Chrome on Android or desktop.'); return }
    try {
      const rec = new Rec()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'
      let finalText = ''
      rec.onresult = (e: any) => {
        let interim = ''
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) finalText += r[0].transcript + ' '
          else interim += r[0].transcript + ' '
        }
        setTranscript((finalText + interim).trim())
      }
      rec.onerror = (e: any) => {
        setSpeechError(String(e?.error ?? 'mic error'))
        setListening(false)
      }
      rec.onend = () => {
        setListening(false)
      }
      rec.start()
      recRef.current = rec
      setListening(true)
    } catch (err) {
      setSpeechError(err instanceof Error ? err.message : 'mic error')
    }
  }, [])

  const stopListening = useCallback(() => {
    try { recRef.current?.stop() } catch { /* already stopped */ }
    recRef.current = null
  }, [])

  useEffect(() => () => { stopListening() }, [stopListening])

  // ─── Grade recitation ───────────────────────────────────────────────────
  const gradeRecitation = useCallback(() => {
    stopListening()
    if (!state.monologue || !currentSpan) return
    const result = gradeSpan(state.monologue, currentSpan, transcript)
    const next: Persisted = { ...state, monologue: state.monologue, lastSpanPassed: result.spanPassed }
    setState(next); persist(next)
    setGrading(result)
    setPhase('feedback')
  }, [state, currentSpan, transcript, persist, stopListening])

  // ─── Advance if possible ────────────────────────────────────────────────
  const tryAdvance = useCallback(() => {
    if (!state.monologue) return
    const newIdx = advance(state.monologue)
    const next = { ...state, monologue: state.monologue }
    setState(next); persist(next)
    return newIdx
  }, [state, persist])

  // ─── Reset monologue ────────────────────────────────────────────────────
  const resetMonologue = useCallback(() => {
    if (!confirm('Wipe all progress on this monologue and restart from the last line?')) return
    if (!state.monologue) return
    const fresh = createMonologueState(state.monologue.lines)
    const next = { ...state, monologue: fresh, lastSpanPassed: false }
    setState(next); persist(next)
    setPhase('intro')
  }, [state, persist])

  // ─── Render ─────────────────────────────────────────────────────────────

  if (phase === 'menu') {
    const hasSaved = !!state.monologue
    return (
      <div className="fixed inset-0 bg-[#06060c] flex flex-col items-center justify-center px-6 overflow-y-auto">
        <h1 className="text-3xl font-black text-white mb-1"
          style={{ textShadow: '0 0 25px rgba(251,191,36,0.3)' }}>LYRICS TRAINER</h1>
        <p className="text-gray-500 text-sm mb-6 text-center max-w-md">
          Memorize speeches &amp; monologues by backward chaining — master the ending first,
          then prepend one line at a time.
        </p>

        {!speechOk && (
          <div className="mb-4 px-4 py-2 rounded-lg text-xs text-orange-300 border border-orange-700/40 max-w-md text-center">
            Speech recognition not available in this browser. Use Chrome on desktop or Android.
          </div>
        )}

        {hasSaved && state.monologue && (
          <div className="mb-4 p-4 rounded-xl max-w-md w-full"
            style={{ background: 'rgba(20,20,32,0.6)', border: '1px solid rgba(60,60,80,0.3)' }}>
            <div className="text-xs text-gray-500 mb-1">In progress</div>
            <div className="text-white font-medium mb-2">{state.title}</div>
            <div className="text-xs text-gray-400 mb-3">
              Knows lines {state.monologue.currentStart + 1}–{state.monologue.lines.length} of {state.monologue.lines.length}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPhase('intro')}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#fbbf24,#d97706)' }}>
                Continue
              </button>
              <button onClick={resetMonologue}
                className="px-3 py-2 rounded-lg text-xs text-gray-400 border border-gray-700">
                Reset
              </button>
            </div>
          </div>
        )}

        <button onClick={() => { setTitleDraft(''); setPasteText(''); setPhase('paste') }}
          className="px-8 py-3 rounded-xl text-base font-bold text-white active:scale-95"
          style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' }}>
          {hasSaved ? 'New monologue' : 'Paste monologue'}
        </button>

        <a href="/pitch-defender" className="mt-8 text-xs text-gray-700 hover:text-gray-500">← Back to Pitch Defender</a>
      </div>
    )
  }

  if (phase === 'paste') {
    return (
      <div className="fixed inset-0 bg-[#06060c] flex flex-col items-center justify-start px-6 pt-8 overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-3">New monologue</h2>
        <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
          placeholder="Title (optional)"
          className="w-full max-w-md mb-3 px-3 py-2 rounded-lg bg-[#14141c] border border-gray-800 text-white text-sm" />
        <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
          placeholder="Paste your monologue here — one line per line break."
          className="w-full max-w-md h-64 mb-3 px-3 py-2 rounded-lg bg-[#14141c] border border-gray-800 text-white text-sm font-mono"
        />
        <div className="flex gap-3">
          <button onClick={loadMonologue} disabled={pasteText.trim().length === 0}
            className="px-6 py-2 rounded-lg font-bold text-white active:scale-95 disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' }}>Load</button>
          <button onClick={() => setPhase('menu')}
            className="px-6 py-2 rounded-lg text-sm text-gray-400 border border-gray-700">Cancel</button>
        </div>
      </div>
    )
  }

  if (!state.monologue) {
    // Safety: if we land here without a monologue, bounce back to menu on next tick.
    // Using an effect keeps us out of a render-phase setState.
    return <PhaseSnapBack setPhase={setPhase} />
  }
  const mono = state.monologue
  const [knownStart, knownEnd] = knownRange(mono)

  if (phase === 'intro') {
    return (
      <div className="fixed inset-0 bg-[#06060c] flex flex-col items-center justify-center px-6 overflow-y-auto">
        <div className="text-xs text-gray-500 mb-1">{state.title}</div>
        <div className="text-2xl font-black text-white mb-1">Ready to practice</div>
        <div className="text-sm text-gray-400 mb-4">
          You know lines {knownStart + 1} through {knownEnd + 1}.
        </div>

        <div className="max-w-md w-full p-4 rounded-xl mb-5"
          style={{ background: 'rgba(20,20,32,0.6)', border: '1px solid rgba(60,60,80,0.3)' }}>
          {mono.lines.slice(knownStart, knownEnd + 1).map((l, i) => {
            const idx = knownStart + i
            const item = mono.engine.items[lineId(idx)]
            const m = item?.mastery ?? 0
            return (
              <div key={idx} className="flex items-center gap-2 py-1">
                <div className="w-1 h-4 rounded-full" style={{
                  background: m > 0.8 ? '#4ade80' : m > 0.5 ? '#fbbf24' : '#666',
                }} />
                <div className="text-sm text-gray-200 truncate">{l}</div>
              </div>
            )
          })}
        </div>

        <button onClick={startRound}
          className="px-8 py-3 rounded-xl font-bold text-white active:scale-95 mb-3"
          style={{ background: 'linear-gradient(135deg,#fbbf24,#d97706)' }}>
          Recite
        </button>

        {canAdvance(mono) && knownStart > 0 && (
          <button onClick={() => { tryAdvance(); setPhase('intro') }}
            className="px-6 py-2 rounded-lg text-sm font-bold text-white mb-3"
            style={{ background: 'linear-gradient(135deg,#4ade80,#16a34a)' }}>
            + Prepend line {knownStart}
          </button>
        )}

        <button onClick={() => setPhase('menu')}
          className="mt-2 text-xs text-gray-500 border border-gray-700 px-4 py-2 rounded-lg">Menu</button>
      </div>
    )
  }

  if (phase === 'reciting' && currentSpan) {
    return (
      <div className="fixed inset-0 bg-[#06060c] flex flex-col items-center justify-center px-6 overflow-y-auto">
        <div className="text-xs text-gray-500 mb-1">{state.title}</div>
        <div className="text-xl font-bold text-white mb-1">
          {currentSpan.type === 'working' ? 'Working window'
            : currentSpan.type === 'medium' ? 'Medium continuity'
            : 'Full tail review'}
        </div>
        <div className="text-sm text-gray-400 mb-4">
          Recite lines {currentSpan.startIdx + 1}–{currentSpan.endIdx + 1}
          {' '}(&nbsp;{currentSpan.endIdx - currentSpan.startIdx + 1} lines&nbsp;)
        </div>

        <div className="max-w-md w-full p-4 rounded-xl mb-4"
          style={{ background: 'rgba(20,20,32,0.6)', border: '1px solid rgba(60,60,80,0.3)' }}>
          {mono.lines.slice(currentSpan.startIdx, currentSpan.endIdx + 1).map((l, i) => (
            <div key={i} className="text-sm text-gray-300 py-0.5">{l}</div>
          ))}
        </div>

        <div className="max-w-md w-full mb-4 p-3 rounded-xl min-h-[60px]"
          style={{ background: 'rgba(30,15,40,0.4)', border: '1px solid rgba(139,92,246,0.25)' }}>
          <div className="text-[10px] text-purple-300 uppercase tracking-wider mb-1">Transcript</div>
          <div className="text-sm text-gray-200 font-mono">{transcript || <span className="text-gray-600">(listening…)</span>}</div>
        </div>

        {speechError && <div className="text-xs text-red-400 mb-3">Mic: {speechError}</div>}

        <div className="flex gap-3">
          <button onClick={gradeRecitation} disabled={!transcript}
            className="px-6 py-2 rounded-lg font-bold text-white active:scale-95 disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' }}>
            Grade
          </button>
          <button onClick={() => { stopListening(); setPhase('intro') }}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 border border-gray-700">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'feedback' && grading && currentSpan) {
    const passed = grading.spanPassed
    return (
      <div className="fixed inset-0 bg-[#06060c] flex flex-col items-center justify-center px-6 overflow-y-auto">
        <div className="text-xs text-gray-500 mb-1">{currentSpan.type} span</div>
        <div className="text-3xl font-black mb-1" style={{ color: passed ? '#4ade80' : '#fbbf24' }}>
          {passed ? 'PASSED' : 'WEAK SPOTS FOUND'}
        </div>

        <div className="max-w-lg w-full p-4 rounded-xl mb-4"
          style={{ background: 'rgba(20,20,32,0.6)', border: '1px solid rgba(60,60,80,0.3)' }}>
          {grading.lineResults.map((r, i) => {
            const transAfter = grading.transitionResults[i]
            return (
              <div key={r.idx}>
                <div className="flex items-center gap-2 py-0.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: r.passed ? 'rgba(74,222,128,0.25)' : 'rgba(251,146,60,0.25)',
                      color: r.passed ? '#4ade80' : '#fb923c',
                    }}>{r.passed ? '✓' : '✗'}</div>
                  <div className="text-sm text-gray-200 flex-1 truncate">{mono.lines[r.idx]}</div>
                  <div className="text-[10px] text-gray-500 font-mono">{Math.round(r.score * 100)}%</div>
                </div>
                {transAfter && !transAfter.passed && (
                  <div className="ml-7 text-[10px] text-orange-400">↓ weak transition</div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex gap-3 flex-wrap justify-center">
          <button onClick={startRound}
            className="px-6 py-2 rounded-lg font-bold text-white active:scale-95"
            style={{ background: 'linear-gradient(135deg,#fbbf24,#d97706)' }}>
            Practice again
          </button>
          {canAdvance(mono) && knownStart > 0 && (
            <button onClick={() => { tryAdvance(); setPhase('intro') }}
              className="px-6 py-2 rounded-lg font-bold text-white active:scale-95"
              style={{ background: 'linear-gradient(135deg,#4ade80,#16a34a)' }}>
              + Prepend line {knownStart}
            </button>
          )}
          <button onClick={() => setPhase('intro')}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 border border-gray-700">Intro</button>
        </div>
      </div>
    )
  }

  return null
}

function PhaseSnapBack({ setPhase }: { setPhase: (p: Phase) => void }) {
  useEffect(() => { setPhase('menu') }, [setPhase])
  return (
    <div className="fixed inset-0 bg-[#06060c] flex items-center justify-center">
      <div className="text-gray-500 text-sm">Returning to menu…</div>
    </div>
  )
}
