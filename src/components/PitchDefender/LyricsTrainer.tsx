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
  gradeSpan, canAdvance, advance, advanceHalf, completeLine,
  lineId, transId, knownRange, lineText, isPartial,
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

// ─── Built-in presets ───────────────────────────────────────────────────────
// "O, what a rogue and peasant slave" — Hamlet, Act 2 Scene 2. The one Jon's
// son is learning. Blank lines between stanzas are filtered on load.
const HAMLET_ROGUE: { title: string; text: string } = {
  title: 'Hamlet — Rogue and peasant slave',
  text: `O, what a rogue and peasant slave am I!
Is it not monstrous that this player here,
But in a fiction, in a dream of passion,
Could force his soul so to his own conceit
That from her working all his visage wann'd,
Tears in his eyes, distraction in's aspect,
A broken voice, and his whole function suiting
With forms to his conceit? And all for nothing!
For Hecuba!
What's Hecuba to him, or he to Hecuba,
That he should weep for her? What would he do,
Had he the motive and the cue for passion
That I have? He would drown the stage with tears
And cleave the general ear with horrid speech,
Make mad the guilty and appall the free,
Confound the ignorant, and amaze indeed
The very faculties of eyes and ears.
Yet I,
A dull and muddy-mettled rascal, peak
Like John-a-dreams, unpregnant of my cause,
And can say nothing; no, not for a king,
Upon whose property and most dear life
A damn'd defeat was made. Am I a coward?
Who calls me villain? breaks my pate across?
Plucks off my beard and blows it in my face?
Tweaks me by the nose? gives me the lie i' the throat,
As deep as to the lungs? Who does me this?
Ha!
Why, I should take it: for it cannot be
But I am pigeon-liver'd and lack gall
To make oppression bitter, or ere this
I should ha' fatted all the region kites
With this slave's offal. Bloody, bawdy villain!
Remorseless, treacherous, lecherous, kindless villain!
O, vengeance!
Why, what an ass am I! This is most brave,
That I, the son of a dear father murder'd,
Prompted to my revenge by heaven and hell,
Must, like a whore, unpack my heart with words
And fall a-cursing, like a very drab,
A scullion!
Fie upon't! foh! About, my brain! I have heard
That guilty creatures sitting at a play
Have by the very cunning of the scene
Been struck so to the soul that presently
They have proclaim'd their malefactions;
For murder, though it have no tongue, will speak
With most miraculous organ. I'll have these players
Play something like the murder of my father
Before mine uncle. I'll observe his looks;
I'll tent him to the quick. If he but blench,
I know my course. The play's the thing
Wherein I'll catch the conscience of the king.`,
}

// ─── Scaffolding helpers ────────────────────────────────────────────────────
// Per-PDF: "successful-but-effortful recall." Hide full text by default;
// reveal the first N words when a line is missed enough times.

/** Number of leading words to reveal given this session's consecutive-miss count. */
function scaffoldWords(miss: number): number {
  if (miss <= 0) return 1   // always show the first word as an anchor
  if (miss === 1) return 1
  if (miss === 2) return 3
  return 5                   // 3+ misses → more scaffolding
}

function splitWords(line: string): string[] {
  return line.split(/\s+/).filter(w => w.length > 0)
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
  // Session-local: consecutive-miss counts per line idx for adaptive scaffolding.
  const [recentMisses, setRecentMisses] = useState<Record<number, number>>({})
  // Which lines the learner is currently peeking at (temporary full reveal).
  const [peekSet, setPeekSet] = useState<Set<number>>(new Set())
  // Override the next round's span start (GO FROM picker).
  const [manualStart, setManualStart] = useState<number | null>(null)

  const recRef = useRef<Rec | null>(null)
  const peekTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  // Pending Retry restart — tracked so Cancel / rapid Retry can clear it.
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechOk = useMemo(() => !!getSpeechRecognition(), [])

  // ─── Persistence ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted
        // Forward-compat: legacy saves lack partialStart. Default to {} so
        // advanceHalf/completeLine can write safely without crashing.
        if (parsed.monologue && !parsed.monologue.partialStart) {
          parsed.monologue.partialStart = {}
        }
        setState(parsed)
      }
    } catch { /* fresh */ }
  }, [])

  const persist = useCallback((s: Persisted) => {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }
    catch { /* quota */ }
  }, [])

  // ─── Load monologue from paste OR preset ────────────────────────────────
  const loadFromText = useCallback((title: string, text: string) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
    if (lines.length === 0) return
    const mono = createMonologueState(lines)
    const next: Persisted = { title: title || 'Untitled', monologue: mono, sessions: 0, lastSpanPassed: false }
    setState(next); persist(next)
    setRecentMisses({})
    setPeekSet(new Set())
    setManualStart(null)
    setPhase('intro')
  }, [persist])

  const loadMonologue = useCallback(() => {
    loadFromText(titleDraft, pasteText)
  }, [pasteText, titleDraft, loadFromText])

  const loadHamlet = useCallback(() => {
    // If the user is already partway through Hamlet, never wipe — just open
    // the intro on the existing state. If a DIFFERENT monologue is in
    // progress, confirm before replacing. If nothing is saved, fresh load.
    if (state.monologue && state.title === HAMLET_ROGUE.title) {
      setPhase('intro')
      return
    }
    if (state.monologue && state.title !== HAMLET_ROGUE.title) {
      const ok = confirm(`Replace "${state.title}" progress with a fresh Hamlet session?`)
      if (!ok) return
    }
    loadFromText(HAMLET_ROGUE.title, HAMLET_ROGUE.text)
  }, [loadFromText, state.monologue, state.title])

  // ─── Start round ────────────────────────────────────────────────────────
  // Respects `manualStart` (GO FROM picker) — one-shot override that scopes
  // the round to a specific starting line, then reverts to the scheduler.
  const startRound = useCallback(() => {
    if (!state.monologue) return
    const mono = state.monologue
    let span: ReviewSpan
    if (manualStart !== null && manualStart >= 0 && manualStart < mono.lines.length) {
      const endIdx = Math.min(mono.lines.length - 1, manualStart + mono.windowMax - 1)
      span = { type: 'working', startIdx: manualStart, endIdx }
      setManualStart(null)  // one-shot
    } else {
      span = pickNextSpan(mono)
    }
    setCurrentSpan(span)
    setTranscript('')
    setGrading(null)
    setSpeechError(null)
    setPeekSet(new Set())
    setPhase('reciting')
    startListening()
  }, [state.monologue, manualStart])

  // ─── Speech recognition ─────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const Rec = getSpeechRecognition()
    if (!Rec) { setSpeechError('Speech recognition not supported on this browser. Use Chrome on Android or desktop.'); return }
    // Defensive: if a prior rec is still alive (rapid Cancel→Recite), stop it
    // so we don't stack two live recognizers feeding the same state.
    try { recRef.current?.stop() } catch { /* already stopped */ }
    recRef.current = null
    try {
      const rec = new Rec()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'
      // Rebuild the transcript from scratch on every onresult fire. The
      // previous implementation kept a closure-scoped `finalText` and
      // iterated `e.results` from 0 each time, which re-appended every
      // already-final result on every event — classic Web Speech bug that
      // manifests as an exponential echo loop once the speaker goes past
      // one short utterance. Stateless derivation avoids the whole class.
      rec.onresult = (e: any) => {
        let finalPart = ''
        let interimPart = ''
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) finalPart += r[0].transcript + ' '
          else interimPart += r[0].transcript + ' '
        }
        setTranscript((finalPart + interimPart).trim())
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

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  // Retry = "I know I flubbed that, let me say it again" without losing the
  // round scope. Must stop+restart the recognizer because Web Speech's
  // `e.results` is cumulative and the stateless transcript derivation would
  // just re-emit what was there. ~250ms mic blip is acceptable. The timer
  // is tracked on a ref so rapid Retry clicks don't pile up restarts and
  // Cancel-after-Retry can't accidentally re-open the mic.
  const retryRecitation = useCallback(() => {
    clearRetryTimer()
    stopListening()
    setTranscript('')
    setSpeechError(null)
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null
      startListening()
    }, 250)
  }, [clearRetryTimer, stopListening, startListening])

  useEffect(() => () => {
    clearRetryTimer()
    stopListening()
  }, [clearRetryTimer, stopListening])

  // ─── Grade recitation ───────────────────────────────────────────────────
  const gradeRecitation = useCallback(() => {
    if (!state.monologue || !currentSpan) return
    clearRetryTimer()
    stopListening()
    const result = gradeSpan(state.monologue, currentSpan, transcript)
    const next: Persisted = { ...state, monologue: state.monologue, lastSpanPassed: result.spanPassed }
    setState(next); persist(next)
    // Adaptive scaffolding: bump miss counter for each failed line, reset on pass.
    setRecentMisses(prev => {
      const m = { ...prev }
      for (const r of result.lineResults) {
        if (r.passed) m[r.idx] = 0
        else m[r.idx] = (m[r.idx] ?? 0) + 1
      }
      return m
    })
    setGrading(result)
    setPhase('feedback')
  }, [state, currentSpan, transcript, persist, stopListening, clearRetryTimer])

  // ─── Peek helper (temporary full-line reveal during recitation) ─────────
  const peekLine = useCallback((idx: number) => {
    setPeekSet(prev => {
      const next = new Set(prev)
      next.add(idx)
      return next
    })
    const prior = peekTimersRef.current.get(idx)
    if (prior) clearTimeout(prior)
    const t = setTimeout(() => {
      setPeekSet(prev => {
        const next = new Set(prev)
        next.delete(idx)
        return next
      })
      peekTimersRef.current.delete(idx)
    }, 3000)
    peekTimersRef.current.set(idx, t)
  }, [])

  useEffect(() => () => {
    peekTimersRef.current.forEach(clearTimeout)
    peekTimersRef.current.clear()
  }, [])

  // ─── Advance if possible ────────────────────────────────────────────────
  const tryAdvance = useCallback(() => {
    if (!state.monologue) return
    const newIdx = advance(state.monologue)
    const next = { ...state, monologue: state.monologue }
    setState(next); persist(next)
    return newIdx
  }, [state, persist])

  const tryAdvanceHalf = useCallback(() => {
    if (!state.monologue) return
    const newIdx = advanceHalf(state.monologue)
    const next = { ...state, monologue: state.monologue }
    setState(next); persist(next)
    return newIdx
  }, [state, persist])

  const completeAndPersist = useCallback((idx: number) => {
    if (!state.monologue) return
    const ok = completeLine(state.monologue, idx)
    if (!ok) return
    // Reset the session-local miss counter for that line — the material
    // just changed, old miss counts don't apply to the longer version.
    setRecentMisses(prev => {
      const { [idx]: _dropped, ...rest } = prev
      return rest
    })
    const next = { ...state, monologue: state.monologue }
    setState(next); persist(next)
  }, [state, persist])

  // Used by the intro view to decide whether the "Complete line N" row shows.
  const hasAnyPartial = (mono: MonologueState): boolean => {
    if (!mono.partialStart) return false
    return Object.values(mono.partialStart).some(v => v > 0)
  }

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

        <button onClick={loadHamlet}
          className="mt-3 px-6 py-2 rounded-xl text-sm font-medium text-gray-200 active:scale-95"
          style={{
            background: 'rgba(30,25,45,0.8)',
            border: '1px solid rgba(139,92,246,0.35)',
          }}>
          {state.monologue && state.title === HAMLET_ROGUE.title
            ? '🎭 Resume Hamlet — "Rogue and peasant slave"'
            : '🎭 Load preset — Hamlet, "Rogue and peasant slave"'}
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
      <div className="fixed inset-0 bg-[#06060c] flex flex-col items-center justify-start px-6 py-6 overflow-y-auto">
        <div className="text-xs text-gray-500 mb-1">{state.title}</div>
        <div className="text-2xl font-black text-white mb-1">Ready to practice</div>
        <div className="text-sm text-gray-400 mb-2">
          You know lines {knownStart + 1} through {knownEnd + 1}
          {' '}({knownEnd - knownStart + 1} of {mono.lines.length})
        </div>
        {manualStart !== null && (
          <div className="mb-2 text-xs text-amber-300 font-mono">
            Next round starts at line {manualStart + 1}
          </div>
        )}

        {/* Line/transition heatmap — dots per line, bars between = transitions.
            Partial lines render with a ½ badge and display only the sliced
            tail (the text the learner is actually practicing). */}
        <div className="max-w-xl w-full p-4 rounded-xl mb-4"
          style={{ background: 'rgba(20,20,32,0.6)', border: '1px solid rgba(60,60,80,0.3)' }}>
          {mono.lines.slice(knownStart, knownEnd + 1).map((_l, i) => {
            const idx = knownStart + i
            const lineItem = mono.engine.items[lineId(idx)]
            const transItem = idx < knownEnd ? mono.engine.items[transId(idx)] : null
            const lm = lineItem?.mastery ?? 0
            const tm = transItem?.mastery ?? 0
            const miss = recentMisses[idx] ?? 0
            const lineColor = lm > 0.8 ? '#4ade80' : lm > 0.5 ? '#fbbf24' : '#666'
            const transColor = tm > 0.8 ? '#4ade80' : tm > 0.5 ? '#fbbf24' : '#555'
            const partial = isPartial(mono, idx)
            return (
              <div key={idx}>
                <button onClick={() => setManualStart(idx)}
                  className="w-full text-left flex items-center gap-2 py-1 rounded hover:bg-white/5 active:scale-[0.99]"
                  style={{
                    background: manualStart === idx ? 'rgba(251,191,36,0.1)' : 'transparent',
                  }}>
                  <div className="text-[10px] font-mono text-gray-500 w-6 text-right">{idx + 1}</div>
                  <div className="w-2 h-4 rounded-sm" style={{ background: lineColor }} />
                  {partial && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.35)' }}>
                      ½
                    </span>
                  )}
                  <div className="text-sm text-gray-200 truncate flex-1">{lineText(mono, idx)}</div>
                  {miss > 1 && (
                    <span className="text-[10px] text-orange-400 font-mono">·{miss} miss</span>
                  )}
                </button>
                {idx < knownEnd && (
                  <div className="ml-[34px] h-2 flex items-center">
                    <div className="w-[2px] h-full rounded-full" style={{ background: transColor }} />
                  </div>
                )}
              </div>
            )
          })}
          <div className="mt-2 text-[10px] text-gray-500 text-center">
            Tap any line to start from there
          </div>
        </div>

        <div className="flex gap-3 flex-wrap justify-center mb-3">
          <button onClick={startRound}
            className="px-8 py-3 rounded-xl font-bold text-white active:scale-95"
            style={{ background: 'linear-gradient(135deg,#fbbf24,#d97706)' }}>
            Recite
          </button>
          {manualStart !== null && (
            <button onClick={() => setManualStart(null)}
              className="px-4 py-3 rounded-xl text-sm text-gray-300 border border-gray-700 active:scale-95">
              Clear start
            </button>
          )}
        </div>

        {/* Prepend options — full line (green) or half-step (amber). */}
        {canAdvance(mono) && knownStart > 0 && (
          <div className="flex gap-2 flex-wrap justify-center mb-3">
            <button onClick={() => { tryAdvance(); setPhase('intro') }}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white active:scale-95"
              style={{ background: 'linear-gradient(135deg,#4ade80,#16a34a)' }}>
              + Prepend line {knownStart}
            </button>
            <button onClick={() => { tryAdvanceHalf(); setPhase('intro') }}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white active:scale-95"
              title="Add only the tail half of the next line — useful when the full line is too much to chain yet."
              style={{ background: 'linear-gradient(135deg,#fbbf24,#d97706)' }}>
              + Half line {knownStart}
            </button>
          </div>
        )}

        {/* Promote any partial line in the known range to full. */}
        {hasAnyPartial(mono) && (
          <div className="flex flex-wrap gap-2 justify-center mb-3 max-w-xl">
            {mono.lines.slice(knownStart, knownEnd + 1).map((_l, i) => {
              const idx = knownStart + i
              if (!isPartial(mono, idx)) return null
              return (
                <button key={idx} onClick={() => completeAndPersist(idx)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white active:scale-95"
                  style={{ background: 'rgba(251,191,36,0.25)', border: '1px solid rgba(251,191,36,0.45)' }}>
                  Complete line {idx + 1} (currently ½)
                </button>
              )
            })}
          </div>
        )}

        <button onClick={() => setPhase('menu')}
          className="mt-2 text-xs text-gray-500 border border-gray-700 px-4 py-2 rounded-lg">Menu</button>
      </div>
    )
  }

  if (phase === 'reciting' && currentSpan) {
    return (
      <div className="fixed inset-0 bg-[#06060c] flex flex-col items-center justify-start px-6 py-5 overflow-y-auto">
        <div className="text-xs text-gray-500 mb-1">{state.title}</div>
        <div className="text-xl font-bold text-white mb-1">
          {currentSpan.type === 'working' ? 'Working window'
            : currentSpan.type === 'medium' ? 'Medium continuity'
            : 'Full tail review'}
        </div>
        <div className="text-sm text-gray-400 mb-3">
          Recite lines {currentSpan.startIdx + 1}–{currentSpan.endIdx + 1}
          {' '}({currentSpan.endIdx - currentSpan.startIdx + 1} lines)
        </div>

        {/* Scaffolded line display — first word(s) + blanks. More scaffolding
            on lines you've missed recently. Tap PEEK to reveal briefly. */}
        <div className="max-w-xl w-full p-4 rounded-xl mb-4"
          style={{ background: 'rgba(20,20,32,0.6)', border: '1px solid rgba(60,60,80,0.3)' }}>
          {mono.lines.slice(currentSpan.startIdx, currentSpan.endIdx + 1).map((_l, i) => {
            const idx = currentSpan.startIdx + i
            const miss = recentMisses[idx] ?? 0
            const effective = lineText(mono, idx)  // honor partialStart
            const partial = isPartial(mono, idx)
            const words = splitWords(effective)
            const peeked = peekSet.has(idx)
            const show = peeked ? words.length : Math.min(words.length, scaffoldWords(miss))
            const shown = words.slice(0, show).join(' ')
            const hiddenCount = words.length - show
            return (
              <div key={idx} className="flex items-start gap-2 py-1">
                <div className="text-[10px] font-mono text-gray-500 w-6 text-right pt-0.5">{idx + 1}</div>
                {partial && (
                  <span className="text-[10px] font-mono px-1 rounded mt-0.5"
                    style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>½</span>
                )}
                <div className="flex-1 text-sm">
                  <span className={peeked ? 'text-gray-200' : 'text-gray-300'}>{shown}</span>
                  {hiddenCount > 0 && (
                    <span className="text-gray-600"> {Array(Math.min(hiddenCount, 12)).fill('___').join(' ')}
                      {hiddenCount > 12 && <span> …</span>}
                    </span>
                  )}
                  {miss >= 2 && !peeked && (
                    <span className="ml-2 text-[10px] text-orange-400">({miss} miss)</span>
                  )}
                </div>
                <button onClick={() => peekLine(idx)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded border text-gray-400 border-gray-700 hover:text-amber-300 hover:border-amber-500/40 active:scale-95"
                  title="Reveal line for 3 seconds">
                  peek
                </button>
              </div>
            )
          })}
        </div>

        <div className="max-w-xl w-full mb-4 p-3 rounded-xl min-h-[60px]"
          style={{ background: 'rgba(30,15,40,0.4)', border: '1px solid rgba(139,92,246,0.25)' }}>
          <div className="text-[10px] text-purple-300 uppercase tracking-wider mb-1">
            Transcript {listening && <span className="ml-2 text-green-400">● listening</span>}
          </div>
          <div className="text-sm text-gray-200 font-mono">{transcript || <span className="text-gray-600">(listening…)</span>}</div>
        </div>

        {speechError && <div className="text-xs text-red-400 mb-3">Mic: {speechError}</div>}

        <div className="flex gap-3 flex-wrap justify-center">
          <button onClick={gradeRecitation} disabled={!transcript}
            className="px-6 py-2 rounded-lg font-bold text-white active:scale-95 disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' }}>
            Grade
          </button>
          <button onClick={retryRecitation}
            className="px-4 py-2 rounded-lg text-sm font-medium text-amber-200 active:scale-95"
            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)' }}
            title="Clear what you just said and try again without leaving this round">
            ↺ Retry
          </button>
          <button onClick={() => { clearRetryTimer(); stopListening(); setPhase('intro') }}
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
                  <div className="text-sm text-gray-200 flex-1 truncate">{lineText(mono, r.idx)}</div>
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
