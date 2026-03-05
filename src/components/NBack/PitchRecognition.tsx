'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Music, RotateCcw, Play, Eye, EyeOff, Trophy, RefreshCw,
  Brain, Headphones, ChevronLeft, EarIcon, Mic, MicOff,
} from 'lucide-react'
import { PortalHeader } from '@/components/Navigation/PortalHeader'
import { WhisperService } from '@/lib/speech'

// ─── Constants ───────────────────────────────────────────────────────────────

const KEYBOARD_ORDER = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
const INTRO_ORDER    = ['C4', 'A4', 'G4', 'E4', 'D4', 'F4', 'B4', 'C5']
const STORAGE_KEY    = 'pitch_recognition_progress'
const MASTERY_ATTEMPTS = 10
const MASTERY_ACCURACY = 0.8
const NB_WARMUP_MS     = 2000   // delay between warmup notes
const NB_ADVANCE_OK    = 900    // delay after correct n-back answer
const NB_ADVANCE_ERR   = 1600   // delay after wrong n-back answer

// ─── Types ───────────────────────────────────────────────────────────────────

// Difficulty applies to both games — controls what the user sees while playing
// easy      → keyboard highlights + all visual cues on
// hard      → no keyboard highlight, all other visuals on
// extrahard → keyboard hidden entirely, no visual cues
type Difficulty  = 'easy' | 'hard' | 'extrahard'
type Screen      = 'menu' | 'identify' | 'nback'
type IdentPhase  = 'playing' | 'feedback' | 'summary'
type NBackPhase  = 'warmup' | 'answer' | 'feedback' | 'summary'
type BtnState    = 'default' | 'correct' | 'wrong' | 'highlight'

interface NoteProgress { correct: number; total: number }

// ─── Audio Cache ──────────────────────────────────────────────────────────────

const _pianoCache = new Map<string, HTMLAudioElement>()

function preloadPiano() {
  if (typeof window === 'undefined') return
  for (const note of KEYBOARD_ORDER) {
    if (!_pianoCache.has(note)) {
      const el = new Audio(`/sounds/nback/piano/${note}.wav`)
      el.preload = 'auto'
      _pianoCache.set(note, el)
    }
  }
}

function playPiano(note: string): HTMLAudioElement {
  const cached = _pianoCache.get(note)
  if (cached) { cached.currentTime = 0; cached.play().catch(() => {}); return cached }
  const el = new Audio(`/sounds/nback/piano/${note}.wav`)
  el.preload = 'auto'; _pianoCache.set(note, el); el.play().catch(() => {})
  return el
}

// ─── Spaced Repetition (Identify game only) ──────────────────────────────────

function noteWeight(note: string, progress: Record<string, NoteProgress>): number {
  const p = progress[note]
  if (!p || p.total < 2) return 1.5
  return Math.max(0.3, Math.min(4.0, 1.0 / (p.correct / p.total + 0.15)))
}

function isMastered(note: string, progress: Record<string, NoteProgress>): boolean {
  const p = progress[note]
  return !!p && p.total >= MASTERY_ATTEMPTS && (p.correct / p.total) >= MASTERY_ACCURACY
}

function weightedPick(
  pool: string[], progress: Record<string, NoteProgress>, exclude: string | null,
): string {
  const cands   = pool.length > 1 ? pool.filter(n => n !== exclude) : pool
  const weights = cands.map(n => noteWeight(n, progress))
  const total   = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) return cands[i] }
  return cands[cands.length - 1]
}

// Uniform random — used by N-Back (memory challenge, not identification)
function randomFrom(pool: string[], exclude: string | null): string {
  const cands = pool.length > 1 ? pool.filter(n => n !== exclude) : pool
  return cands[Math.floor(Math.random() * cands.length)]
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PitchRecognition() {

  // ── Shared ────────────────────────────────────────────────────────────────
  const [screen, setScreen]         = useState<Screen>('menu')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [progress, setProgress]     = useState<Record<string, NoteProgress>>({})
  const diffRef                     = useRef<Difficulty>('easy')
  useEffect(() => { diffRef.current = difficulty }, [difficulty])

  useEffect(() => {
    preloadPiano()
    try { const r = localStorage.getItem(STORAGE_KEY); if (r) setProgress(JSON.parse(r)) } catch {}
  }, [])

  const saveProgress = useCallback((u: Record<string, NoteProgress>) => {
    setProgress(u)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(u)) } catch {}
  }, [])
  const resetAll  = useCallback(() => saveProgress({}), [saveProgress])
  const resetNote = useCallback((note: string) => {
    const u = { ...progress }; delete u[note]; saveProgress(u)
  }, [progress, saveProgress])

  const progressRef = useRef(progress)
  useEffect(() => { progressRef.current = progress }, [progress])

  // ── Voice mode (identify game only) ──────────────────────────────────────
  const [voiceMode, setVoiceMode]     = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'error'>('idle')
  const voiceModeRef = useRef(false)
  useEffect(() => { voiceModeRef.current = voiceMode }, [voiceMode])

  // ── Identify game state ───────────────────────────────────────────────────
  const [iPhase, setIPhase]         = useState<IdentPhase>('playing')
  const [iNotes, setINotes]         = useState<string[]>(['C4', 'A4'])
  const [iCurrent, setICurrent]     = useState<string | null>(null)
  const [iConsecOk, setIConsecOk]   = useState(0)
  const [iConsecBad, setIConsecBad] = useState(0)
  const [iStats, setIStats]         = useState<Record<string, NoteProgress>>({})
  const [iTotal, setITotal]         = useState(0)
  const [iCorrect, setICorrect]     = useState(0)
  const [iBtns, setIBtns]           = useState<Record<string, BtnState>>({})
  const [iKeyHL, setIKeyHL]         = useState<string | null>(null)

  const iHighlight = useCallback((note: string) => {
    if (diffRef.current === 'easy') {
      setIKeyHL(note); setTimeout(() => setIKeyHL(null), 700)
    }
  }, [])

  // Forward ref — initialized with stub; updated by useEffect after handleIdentifyAnswer is defined
  const handleIdentifyAnswerRef = useRef<(chosen: string) => void>(() => {})

  // Plays a note and — if voice mode is on — opens mic AFTER audio ends (gated single-shot)
  const playIdentifyNote = useCallback((note: string) => {
    const audio = playPiano(note)
    iHighlight(note)
    if (!voiceModeRef.current) return
    const onEnded = () => {
      setTimeout(async () => {
        if (!voiceModeRef.current) return
        const matched = await WhisperService.listenOnce(4000, (s) => {
          setVoiceStatus(s === 'listening' ? 'listening' : s === 'error' ? 'error' : 'idle')
        })
        setVoiceStatus('idle')
        if (matched && voiceModeRef.current) handleIdentifyAnswerRef.current(matched)
      }, 200)
    }
    // Guard: if audio already ended (cached file replayed instantly), trigger immediately
    if (audio.ended) { onEnded(); return }
    audio.addEventListener('ended', onEnded, { once: true })
  }, [iHighlight])

  const startIdentify = useCallback(() => {
    const pool  = ['C4', 'A4']
    const first = weightedPick(pool, progressRef.current, null)
    setINotes(pool); setICurrent(first); setIPhase('playing')
    setIConsecOk(0); setIConsecBad(0); setIStats({})
    setITotal(0); setICorrect(0); setIBtns({}); setIKeyHL(null)
    setScreen('identify')
    playIdentifyNote(first)
  }, [iHighlight, playIdentifyNote])

  const replayIdentify = useCallback(() => { if (iCurrent) playPiano(iCurrent) }, [iCurrent])

  const handleIdentifyAnswer = useCallback((chosen: string) => {
    if (iPhase !== 'playing' || !iCurrent) return
    setIPhase('feedback')
    const ok         = chosen === iCurrent
    const newTotal   = iTotal + 1
    const newCorrect = iCorrect + (ok ? 1 : 0)
    setITotal(newTotal); setICorrect(newCorrect)
    setIStats(prev => ({
      ...prev,
      [iCurrent]: { correct: (prev[iCurrent]?.correct ?? 0) + (ok ? 1 : 0),
                    total:   (prev[iCurrent]?.total   ?? 0) + 1 },
    }))
    const updProg = {
      ...progressRef.current,
      [iCurrent]: { correct: (progressRef.current[iCurrent]?.correct ?? 0) + (ok ? 1 : 0),
                    total:   (progressRef.current[iCurrent]?.total   ?? 0) + 1 },
    }
    saveProgress(updProg)
    setIBtns(ok ? { [chosen]: 'correct' } : { [chosen]: 'wrong', [iCurrent]: 'highlight' })

    const newOk  = ok ? iConsecOk  + 1 : 0
    const newBad = ok ? 0           : iConsecBad + 1
    setIConsecOk(newOk); setIConsecBad(newBad)

    let nextPool = [...iNotes]; let resetOk = false; let resetBad = false
    if (ok && newOk >= 5 && nextPool.length < 8) {
      const n = INTRO_ORDER.find(n => !nextPool.includes(n))
      if (n) { nextPool = [...nextPool, n]; resetOk = true }
    } else if (!ok && newBad >= 3 && nextPool.length > 2) {
      const d = [...INTRO_ORDER].reverse().find(n => nextPool.includes(n) && n !== iCurrent)
      if (d) { nextPool = nextPool.filter(n => n !== d); resetBad = true }
    }
    if (resetOk)  setIConsecOk(0)
    if (resetBad) setIConsecBad(0)
    if (nextPool.length !== iNotes.length) setINotes(nextPool)

    setTimeout(() => {
      setIBtns({})
      const next = weightedPick(nextPool, updProg, iCurrent)
      setICurrent(next); setIPhase('playing')
      playIdentifyNote(next)
    }, ok ? 800 : 1400)
  }, [iPhase, iCurrent, iConsecOk, iConsecBad, iNotes, iTotal, iCorrect, saveProgress, iHighlight, playIdentifyNote])

  // Keep ref in sync so async voice callback always calls latest handleIdentifyAnswer
  useEffect(() => { handleIdentifyAnswerRef.current = handleIdentifyAnswer }, [handleIdentifyAnswer])

  // ── N-Back game state ─────────────────────────────────────────────────────
  const [nbLevel, setNbLevel]         = useState<1 | 2 | 3>(1)
  const [nbPhase, setNbPhase]         = useState<NBackPhase>('warmup')
  const [nbHistory, setNbHistory]     = useState<string[]>([])
  const [nbCurrent, setNbCurrent]     = useState<string | null>(null)
  const [nbPool, setNbPool]           = useState<string[]>([])
  const [nbCorrect, setNbCorrect]     = useState(0)
  const [nbTotal, setNbTotal]         = useState(0)
  const [nbConsecOk, setNbConsecOk]   = useState(0)
  const [nbConsecBad, setNbConsecBad] = useState(0)
  const [nbResult, setNbResult]       = useState<'correct' | 'wrong' | null>(null)
  const [nbKeyHL, setNbKeyHL]         = useState<string | null>(null)
  // Refs for use inside setTimeout closures
  const nbHistRef  = useRef<string[]>([])
  const nbPoolRef  = useRef<string[]>([])
  const nbLevelRef = useRef(1)
  const nbOkRef    = useRef(0)
  const nbBadRef   = useRef(0)

  const nbHighlight = useCallback((note: string) => {
    if (diffRef.current === 'easy') {
      setNbKeyHL(note); setTimeout(() => setNbKeyHL(null), 700)
    }
  }, [])

  const startNBack = useCallback(() => {
    const level = nbLevel
    const pool  = INTRO_ORDER.slice(0, Math.max(3, level + 1))
    nbHistRef.current  = []; nbPoolRef.current = pool
    nbLevelRef.current = level; nbOkRef.current = 0; nbBadRef.current = 0
    setNbPool(pool); setNbHistory([]); setNbCorrect(0); setNbTotal(0)
    setNbConsecOk(0); setNbConsecBad(0); setNbResult(null); setNbKeyHL(null)
    setScreen('nback')

    // Play first warmup note, then schedule the rest
    function playWarmup(hist: string[], heard: number) {
      if (heard >= level) {
        // Warmup done — play first answer note
        setTimeout(() => {
          const next = randomFrom(nbPoolRef.current, hist[hist.length - 1])
          const h2 = [...hist, next]
          nbHistRef.current = h2
          setNbHistory(h2); setNbCurrent(next); setNbPhase('answer')
          playPiano(next); nbHighlight(next)
        }, NB_WARMUP_MS)
      } else {
        setTimeout(() => {
          const next = randomFrom(nbPoolRef.current, hist[hist.length - 1])
          const h2 = [...hist, next]
          nbHistRef.current = h2
          setNbHistory(h2); setNbCurrent(next)
          playPiano(next); nbHighlight(next)
          playWarmup(h2, heard + 1)
        }, NB_WARMUP_MS)
      }
    }

    const first = randomFrom(pool, null)
    const initHist = [first]
    nbHistRef.current = initHist
    setNbHistory(initHist); setNbCurrent(first); setNbPhase('warmup')
    playPiano(first); nbHighlight(first)
    playWarmup(initHist, 1)
  }, [nbLevel, nbHighlight])

  const handleNBackAnswer = useCallback((isMatch: boolean) => {
    if (nbPhase !== 'answer' || !nbCurrent) return
    setNbPhase('feedback')

    // history ends with current note; target is N steps before current
    const hist   = nbHistRef.current
    const level  = nbLevelRef.current
    const target = hist[hist.length - 1 - level]   // N steps ago (not counting current)
    const expectedMatch = target === nbCurrent
    const ok     = isMatch === expectedMatch

    setNbTotal(t => t + 1); setNbCorrect(c => c + (ok ? 1 : 0))
    setNbResult(ok ? 'correct' : 'wrong')

    const newOk  = ok ? nbOkRef.current  + 1 : 0
    const newBad = ok ? 0                 : nbBadRef.current + 1
    nbOkRef.current = newOk; nbBadRef.current = newBad
    setNbConsecOk(newOk); setNbConsecBad(newBad)

    let nextPool = [...nbPoolRef.current]
    if (ok && newOk >= 5 && nextPool.length < 8) {
      const n = INTRO_ORDER.find(n => !nextPool.includes(n))
      if (n) { nextPool = [...nextPool, n]; nbOkRef.current = 0; setNbConsecOk(0) }
    } else if (!ok && newBad >= 3 && nextPool.length > 3) {
      const d = [...INTRO_ORDER].reverse().find(n => nextPool.includes(n) && n !== nbCurrent)
      if (d) { nextPool = nextPool.filter(n => n !== d); nbBadRef.current = 0; setNbConsecBad(0) }
    }
    nbPoolRef.current = nextPool; setNbPool(nextPool)

    setTimeout(() => {
      setNbResult(null)
      const prev = nbHistRef.current[nbHistRef.current.length - 1]
      const next = randomFrom(nextPool, prev)
      const h2 = [...nbHistRef.current, next]
      nbHistRef.current = h2
      setNbHistory(h2); setNbCurrent(next); setNbPhase('answer')
      playPiano(next); nbHighlight(next)
    }, ok ? NB_ADVANCE_OK : NB_ADVANCE_ERR)
  }, [nbPhase, nbCurrent, nbHighlight])

  const endNBack = useCallback(() => { setNbPhase('summary'); setNbCurrent(null) }, [])

  // ── Styling helpers ───────────────────────────────────────────────────────

  const getIBtnClass = (note: string) => {
    const s    = iBtns[note] ?? 'default'
    const base = 'rounded-lg px-4 py-3 font-mono text-lg font-bold border-2 transition-all duration-150 disabled:cursor-not-allowed'
    if (s === 'correct')   return `${base} bg-green-500/30 border-green-400 text-green-300`
    if (s === 'wrong')     return `${base} bg-red-500/30 border-red-400 text-red-300`
    if (s === 'highlight') return `${base} bg-teal-500/30 border-teal-400 text-teal-300`
    return `${base} bg-gray-700/60 border-gray-600 text-gray-200 hover:border-teal-400`
  }

  const getKeyClass = (note: string, hl: string | null, pool: string[]) => {
    const lit    = hl === note
    const active = pool.includes(note)
    const base   = 'w-10 h-24 rounded-b-md border-2 transition-all duration-100'
    if (lit)    return `${base} bg-teal-400/80 border-teal-300 shadow-lg shadow-teal-500/50 scale-95`
    if (active) return `${base} bg-gray-100 border-gray-400 shadow-sm`
    return        `${base} bg-gray-600 border-gray-700 opacity-25`
  }

  const iAccuracyPct  = iTotal  > 0 ? Math.round((iCorrect  / iTotal)  * 100) : 0
  const nbAccuracyPct = nbTotal > 0 ? Math.round((nbCorrect / nbTotal) * 100) : 0
  const hasData       = Object.values(progress).some(p => p.total > 0)

  // N-Back display: window of last N+1 notes (oldest = target, newest = current)
  const nbWindow     = nbHistory.slice(-(nbLevel + 1))
  const nbTarget     = nbHistory.length > nbLevel
    ? nbHistory[nbHistory.length - 1 - nbLevel] : null

  const DIFF_OPTIONS: { value: Difficulty; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'easy',      label: 'Easy',        icon: <Eye className="w-4 h-4" />,       color: 'teal'   },
    { value: 'hard',      label: 'Hard',        icon: <EyeOff className="w-4 h-4" />,    color: 'purple' },
    { value: 'extrahard', label: 'Extra Hard',  icon: <Headphones className="w-4 h-4" />, color: 'red'   },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800" style={{
      backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      <PortalHeader section="Mental Training" />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Music className="w-7 h-7 text-teal-400" />
            <h1 className="text-3xl font-bold text-white">Pitch Recognition</h1>
          </div>
          <p className="text-gray-400 text-sm">Train your ear to identify and remember musical notes</p>
        </div>

        {/* ════════════════ MENU ════════════════ */}
        {screen === 'menu' && (
          <div className="space-y-4">

            {/* Difficulty selector (shared) */}
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Visual Difficulty</p>
              <div className="flex gap-2">
                {DIFF_OPTIONS.map(({ value, label, icon, color }) => (
                  <button key={value} onClick={() => setDifficulty(value)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition ${
                      difficulty === value
                        ? color === 'teal'   ? 'bg-teal-600/30 border-teal-500/60 text-teal-300'
                        : color === 'purple' ? 'bg-purple-600/30 border-purple-500/60 text-purple-300'
                        :                      'bg-red-600/30 border-red-500/60 text-red-300'
                        : 'bg-gray-700/40 border-gray-600 text-gray-500 hover:border-gray-500'
                    }`}>
                    {icon}{label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2 text-center">
                {difficulty === 'easy'      && 'Key lights up when a note plays — visual anchors sound to position.'}
                {difficulty === 'hard'      && 'No key highlight — identify or remember purely by ear.'}
                {difficulty === 'extrahard' && 'Keyboard hidden — no visual reference at all.'}
              </p>
            </div>

            {/* Game cards */}
            <div className="grid grid-cols-1 gap-4">

              {/* ── Pitch Identification ── */}
              <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-teal-400/20 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-teal-600/20 p-2 rounded-lg">
                    <Music className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg">Pitch Identification</h2>
                    <p className="text-gray-500 text-xs">Hear a note → name it</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-1">
                  A note plays. Pick which note it was from the answer buttons.
                </p>
                <p className="text-gray-600 text-xs mb-4">
                  Start with 2 notes · 5 correct → new note added · Spaced repetition tracks your weak notes
                </p>
                <button onClick={startIdentify}
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" /> Start Identification
                </button>
              </div>

              {/* ── N-Back Pitch Memory ── */}
              <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-purple-400/20 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-purple-600/20 p-2 rounded-lg">
                    <Brain className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg">N-Back Pitch Memory</h2>
                    <p className="text-gray-500 text-xs">Remember what you heard N steps ago</p>
                  </div>
                </div>

                {/* N level selector */}
                <div className="flex gap-2 mb-4">
                  {([1, 2, 3] as const).map(n => (
                    <button key={n} onClick={() => setNbLevel(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${
                        nbLevel === n
                          ? 'bg-purple-600/30 border-purple-500/60 text-purple-300'
                          : 'bg-gray-700/40 border-gray-600 text-gray-500 hover:border-gray-500'
                      }`}>
                      {n}-Back
                    </button>
                  ))}
                </div>

                <p className="text-gray-400 text-sm mb-1">
                  {nbLevel === 1 && 'Is this note the same as the one just before it?'}
                  {nbLevel === 2 && 'Is this note the same as the one 2 notes ago?'}
                  {nbLevel === 3 && 'Is this note the same as the one 3 notes ago?'}
                </p>
                <p className="text-gray-600 text-xs mb-4">
                  Develops auditory working memory · Start with {Math.max(3, nbLevel + 1)} notes · pool expands with skill
                </p>
                <button onClick={startNBack}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                  <Brain className="w-4 h-4" /> Start {nbLevel}-Back Training
                </button>
              </div>
            </div>

            {/* Lifetime progress */}
            {hasData && (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Identification Progress</span>
                  <button onClick={resetAll} className="text-xs text-gray-600 hover:text-red-400 transition flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Reset all
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {KEYBOARD_ORDER.map(note => {
                    const p = progress[note]; const m = isMastered(note, progress)
                    if (!p || p.total === 0) return (
                      <div key={note} className="text-center">
                        <span className="font-mono text-xs text-gray-600">{note}</span>
                        <div className="text-xs text-gray-700">—</div>
                      </div>
                    )
                    const pct = Math.round((p.correct / p.total) * 100)
                    return (
                      <div key={note} className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`font-mono text-xs ${m ? 'text-green-400' : 'text-gray-300'}`}>{note}</span>
                          {m && <Trophy className="w-3 h-3 text-yellow-400" />}
                        </div>
                        <div className={`text-xs font-bold ${pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{pct}%</div>
                        <div className="text-xs text-gray-600">{p.total}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════ IDENTIFY GAME ════════════════ */}
        {screen === 'identify' && (iPhase === 'playing' || iPhase === 'feedback') && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setScreen('menu')}
                  className="text-gray-500 hover:text-gray-300 transition flex items-center gap-1 text-xs border border-gray-700 hover:border-gray-500 rounded px-2 py-1">
                  <ChevronLeft className="w-3 h-3" /> Menu
                </button>
                <span className="text-gray-400 text-sm">{iNotes.length} notes</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  difficulty === 'easy'      ? 'border-teal-600/40 text-teal-400 bg-teal-600/10'
                  : difficulty === 'hard'    ? 'border-purple-600/40 text-purple-400 bg-purple-600/10'
                  :                            'border-red-600/40 text-red-400 bg-red-600/10'
                }`}>
                  {difficulty === 'easy' ? 'Easy' : difficulty === 'hard' ? 'Hard' : 'Extra Hard'}
                </span>
              </div>
              <span className="text-gray-400 text-sm">{iCorrect}/{iTotal} · {iAccuracyPct}%</span>
              <button onClick={() => { setIPhase('summary') }}
                className="text-gray-500 hover:text-gray-300 text-xs border border-gray-700 hover:border-gray-500 rounded px-2 py-1 transition">
                End
              </button>
            </div>

            <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-primary-400/20 shadow-lg mb-3">

              {/* Piano keyboard — hidden in extrahard */}
              {difficulty !== 'extrahard' && (
                <div className="flex justify-center gap-1.5 mb-8">
                  {KEYBOARD_ORDER.map(note => (
                    <div key={note} className="flex flex-col items-center gap-1">
                      <div className={getKeyClass(note, iKeyHL, iNotes)} />
                      <span className={`text-xs font-mono ${iNotes.includes(note) ? 'text-gray-400' : 'text-gray-700'}`}>
                        {note}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {difficulty === 'extrahard' && (
                <div className="text-center mb-8 py-4">
                  <Headphones className="w-10 h-10 text-red-400/60 mx-auto mb-2" />
                  <p className="text-gray-600 text-sm">No keyboard — ear only</p>
                </div>
              )}

              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-3">
                <button onClick={replayIdentify} disabled={iPhase === 'feedback'}
                  className="bg-teal-600/20 hover:bg-teal-600/40 disabled:opacity-40 border border-teal-500/50 text-teal-300 font-medium px-6 py-2 rounded-lg transition flex items-center gap-2 text-sm">
                  <RotateCcw className="w-4 h-4" /> Replay
                </button>
                {/* Voice mode toggle */}
                <button
                  onClick={() => { setVoiceMode(v => !v); setVoiceStatus('idle') }}
                  title={voiceMode ? 'Voice ON — click to turn off' : 'Turn on voice answers'}
                  className={`border font-medium px-4 py-2 rounded-lg transition flex items-center gap-2 text-sm ${
                    voiceMode
                      ? 'bg-green-600/20 border-green-500/50 text-green-300 hover:bg-green-600/30'
                      : 'bg-gray-700/40 border-gray-600 text-gray-500 hover:border-gray-500'
                  }`}>
                  {voiceMode ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  {voiceMode ? 'Voice On' : 'Voice'}
                </button>
              </div>
              {/* Mic status indicator */}
              {voiceMode && (
                <div className={`mt-3 flex items-center justify-center gap-2 text-sm transition-all ${
                  voiceStatus === 'listening' ? 'opacity-100' : 'opacity-30'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    voiceStatus === 'listening' ? 'bg-green-400 animate-pulse' :
                    voiceStatus === 'error'     ? 'bg-red-400' : 'bg-gray-600'
                  }`} />
                  <span className={voiceStatus === 'error' ? 'text-red-400' : 'text-gray-400'}>
                    {voiceStatus === 'listening' ? 'Listening — say the note name…' :
                     voiceStatus === 'error'     ? 'Mic blocked — check browser permissions' :
                     'Say note name after it plays'}
                  </span>
                </div>
              )}
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[...iNotes].sort((a, b) => KEYBOARD_ORDER.indexOf(a) - KEYBOARD_ORDER.indexOf(b)).map(note => (
                  <button key={note} onClick={() => handleIdentifyAnswer(note)}
                    disabled={iPhase === 'feedback'} className={getIBtnClass(note)}>
                    {note}
                  </button>
                ))}
              </div>
            </div>

            {(iConsecOk > 0 || iConsecBad > 0) && (
              <div className="text-center text-sm">
                {iConsecOk  > 0 && <span className="text-green-400">🔥 {iConsecOk} correct{iConsecOk >= 4 ? ' — almost leveling up!' : ''}</span>}
                {iConsecBad > 0 && <span className="text-red-400">⚠ {iConsecBad} wrong{iConsecBad >= 2 ? ' — simplifying soon' : ''}</span>}
              </div>
            )}
          </>
        )}

        {screen === 'identify' && iPhase === 'summary' && (
          <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-8 border border-primary-400/20 shadow-lg">
            <h2 className="text-2xl font-bold text-white text-center mb-3">Session Complete</h2>
            <p className="text-center text-5xl font-mono font-bold text-teal-400 mb-1">{iAccuracyPct}%</p>
            <p className="text-center text-gray-400 mb-6">{iCorrect} correct of {iTotal}</p>
            {Object.keys(iStats).length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">This session — lifetime in [ ]</p>
                <div className="space-y-2">
                  {KEYBOARD_ORDER.filter(n => iStats[n]).map(note => {
                    const s = iStats[note]; const sp = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
                    const lp = progress[note]; const lPct = lp?.total > 0 ? Math.round((lp.correct / lp.total) * 100) : null
                    const m = isMastered(note, progress)
                    return (
                      <div key={note} className="flex items-center gap-2">
                        <div className="flex items-center gap-1 w-14">
                          <span className="font-mono text-sm text-gray-300">{note}</span>
                          {m && <Trophy className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                        </div>
                        <div className="flex-1 bg-gray-700/50 rounded-full h-2">
                          <div className={`h-2 rounded-full ${sp >= 80 ? 'bg-green-500' : sp >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${sp}%` }} />
                        </div>
                        <span className="text-xs text-gray-300 w-8 text-right">{sp}%</span>
                        {lPct !== null && <span className="text-xs text-gray-600 w-16 text-right">[{lPct}%]</span>}
                        <button onClick={() => resetNote(note)} title="Reset progress"
                          className="text-gray-700 hover:text-red-400 transition">
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={startIdentify}
                className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                <Play className="w-4 h-4" /> Play Again
              </button>
              <button onClick={() => setScreen('menu')}
                className="px-4 bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-600 transition text-sm flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Menu
              </button>
            </div>
          </div>
        )}

        {/* ════════════════ N-BACK GAME ════════════════ */}
        {screen === 'nback' && (nbPhase === 'warmup' || nbPhase === 'answer' || nbPhase === 'feedback') && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setScreen('menu')}
                  className="text-gray-500 hover:text-gray-300 transition flex items-center gap-1 text-xs border border-gray-700 hover:border-gray-500 rounded px-2 py-1">
                  <ChevronLeft className="w-3 h-3" /> Menu
                </button>
                <span className="text-purple-300 text-sm font-medium">{nbLevel}-Back</span>
                <span className="text-gray-500 text-sm">· {nbPool.length} notes</span>
              </div>
              <span className="text-gray-400 text-sm">{nbCorrect}/{nbTotal} · {nbAccuracyPct}%</span>
              <button onClick={endNBack}
                className="text-gray-500 hover:text-gray-300 text-xs border border-gray-700 hover:border-gray-500 rounded px-2 py-1 transition">
                End
              </button>
            </div>

            <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-purple-400/20 shadow-lg mb-3">

              {/* Memory window */}
              <div className="mb-6">
                <p className="text-xs text-gray-500 text-center mb-3 uppercase tracking-wide">
                  {nbPhase === 'warmup' ? `Building memory…` : `Is current = same note as ${nbLevel} step${nbLevel > 1 ? 's' : ''} ago?`}
                </p>
                <div className="flex justify-center gap-2">
                  {nbWindow.map((note, idx) => {
                    const isCurrentSlot = idx === nbWindow.length - 1
                    const isTargetSlot  = idx === 0 && nbPhase !== 'warmup'
                    const showNote      = difficulty === 'easy' || (difficulty === 'hard' && isCurrentSlot && nbPhase !== 'warmup')

                    return (
                      <div key={idx} className="flex flex-col items-center gap-1">
                        <div className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center font-mono font-bold text-sm transition-all ${
                          isCurrentSlot && nbPhase !== 'warmup'
                            ? nbResult === 'correct' ? 'bg-green-500/30 border-green-400 text-green-300'
                            : nbResult === 'wrong'   ? 'bg-red-500/30 border-red-400 text-red-300'
                            :                          'bg-purple-500/30 border-purple-400 text-purple-200 animate-pulse'
                          : isTargetSlot
                            ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                            : 'bg-gray-700/50 border-gray-600 text-gray-400'
                        }`}>
                          {showNote ? note : '?'}
                        </div>
                        <span className="text-xs text-gray-600">
                          {isCurrentSlot ? 'now' : isTargetSlot ? `↑ target` : `${nbWindow.length - 1 - idx}ago`}
                        </span>
                      </div>
                    )
                  })}
                  {nbWindow.length === 0 && (
                    <div className="text-gray-600 text-sm">Listening…</div>
                  )}
                </div>
              </div>

              {/* Piano keyboard — hidden in extrahard */}
              {difficulty !== 'extrahard' && (
                <div className="flex justify-center gap-1.5 mb-6">
                  {KEYBOARD_ORDER.map(note => (
                    <div key={note} className="flex flex-col items-center gap-1">
                      <div className={getKeyClass(note, nbKeyHL, nbPool)} />
                      <span className={`text-xs font-mono ${nbPool.includes(note) ? 'text-gray-500' : 'text-gray-700'}`}>
                        {note}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Warmup state */}
              {nbPhase === 'warmup' && (
                <div className="text-center py-2">
                  <div className="inline-flex items-center gap-2 bg-gray-700/50 rounded-lg px-4 py-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                    <span className="text-gray-300 text-sm">
                      Loading memory… {nbHistory.length} of {nbLevel}
                    </span>
                  </div>
                </div>
              )}

              {/* Answer buttons */}
              {(nbPhase === 'answer' || nbPhase === 'feedback') && (
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => handleNBackAnswer(true)}
                    disabled={nbPhase === 'feedback'}
                    className={`flex-1 py-4 rounded-xl border-2 font-bold text-lg transition-all disabled:opacity-50 ${
                      nbResult === 'correct' ? 'bg-green-500/40 border-green-400 text-green-200'
                      : nbResult === 'wrong' ? 'bg-gray-700/40 border-gray-600 text-gray-500'
                      : 'bg-green-600/20 border-green-500/50 text-green-300 hover:bg-green-600/30'
                    }`}>
                    ✓ SAME
                  </button>
                  <button
                    onClick={() => handleNBackAnswer(false)}
                    disabled={nbPhase === 'feedback'}
                    className={`flex-1 py-4 rounded-xl border-2 font-bold text-lg transition-all disabled:opacity-50 ${
                      nbResult === 'wrong'   ? 'bg-red-500/40 border-red-400 text-red-200'
                      : nbResult === 'correct' ? 'bg-gray-700/40 border-gray-600 text-gray-500'
                      : 'bg-red-600/20 border-red-500/50 text-red-300 hover:bg-red-600/30'
                    }`}>
                    ✗ DIFFERENT
                  </button>
                </div>
              )}
            </div>

            {/* Feedback result */}
            {nbResult && (
              <div className={`text-center text-lg font-bold mb-2 ${nbResult === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                {nbResult === 'correct' ? '✓ Correct!' : `✗ Wrong — it was ${nbTarget === nbCurrent ? 'SAME' : 'DIFFERENT'}`}
              </div>
            )}

            {/* Streaks */}
            {!nbResult && (nbConsecOk > 0 || nbConsecBad > 0) && (
              <div className="text-center text-sm">
                {nbConsecOk  > 0 && <span className="text-green-400">🔥 {nbConsecOk} in a row{nbConsecOk >= 4 ? ' — leveling up soon!' : ''}</span>}
                {nbConsecBad > 0 && <span className="text-red-400">⚠ {nbConsecBad} wrong{nbConsecBad >= 2 ? ' — simplifying soon' : ''}</span>}
              </div>
            )}
          </>
        )}

        {screen === 'nback' && nbPhase === 'summary' && (
          <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-8 border border-purple-400/20 shadow-lg">
            <h2 className="text-2xl font-bold text-white text-center mb-3">Session Complete</h2>
            <p className="text-center text-5xl font-mono font-bold text-purple-400 mb-1">{nbAccuracyPct}%</p>
            <p className="text-center text-gray-400 mb-2">{nbCorrect} correct of {nbTotal}</p>
            <p className="text-center text-gray-500 text-sm mb-8">{nbLevel}-Back · {nbPool.length} notes in pool</p>
            <div className="flex gap-3">
              <button onClick={startNBack}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                <Play className="w-4 h-4" /> Play Again
              </button>
              <button onClick={() => setScreen('menu')}
                className="px-4 bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-600 transition text-sm flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Menu
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
