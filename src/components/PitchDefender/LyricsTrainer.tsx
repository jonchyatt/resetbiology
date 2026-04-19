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

// Vecna / Henry Creel monologue — Stranger Things 4 finale. The speech Jon's
// son is currently rehearsing. Pre-split at sentence boundaries so the
// backward-chain window represents coherent practice chunks instead of one
// paragraph-sized wall-of-text per "line."
const VECNA_MONOLOGUE: { title: string; text: string } = {
  title: 'Vecna — "You think you need them"',
  text: `You think you need them, but you don't.
You don't.
Oh, but I know you're just scared.
I was scared once too.
I know what it's like to be different.
To be alone in this world.
Like you, I didn't fit in with the other children.
Something was wrong with me.
All the teachers and the doctors said I was…
"Broken," they said.
My parents thought a change of scenery, a fresh start in Hawkins, might just cure me.
It was absurd.
As if the world would be any different here.
But then… to my surprise, our new home provided a discovery.
And a newfound sense of purpose.
I found a nest of black widows living inside a vent.
Most people fear spiders.
They detest them.
And yet, I found them endlessly fascinating.
More than that, I found a great comfort in them.
A kinship.
Like me, they are solitary creatures.
And deeply misunderstood.
They are gods of our world.
The most important of all predators.
They immobilize and feed on the weak, bringing balance and order to an unstable ecosystem.
But the human world was disrupting this harmony.
You see, humans are a unique type of pest, multiplying and poisoning our world, all while enforcing a structure of their own.
A deeply unnatural structure.
Where others saw order, I saw a straitjacket.
A cruel, oppressive world dictated by made-up rules.
Seconds, minutes, hours, days, weeks, months, years, decades.
Each life a faded, lesser copy of the one before.
Wake up, eat, work, sleep, reproduce, and die.
Everyone is just waiting.
Waiting for it all to be over.
All while performing in a silly, terrible play, day after day.
I could not do that.
I could not close off my mind and join in the madness.
I could not pretend.
And I realized I didn't have to.`,
}

// Nate — "Love Letter." Spoken-word/rap love letter Jon's son is rehearsing.
// Already broken at natural delivery beats; auto-split will further chunk any
// long sentences (>14 words) at sentence terminators.
const NATE_LOVE_LETTER: { title: string; text: string } = {
  title: 'Nate — Love Letter',
  text: `Hello, hello
So, I wanted to try and do something special
For someone very special to me
And so, this is my attempt at doing that
Uh, yeah, here we go
Even when we're miles apart, I have your voice but feel no touch
You are so close to my heart, but we're far from flesh and blood
See, in a world so full of dissonance, our harmony's a flood
Inside my heart, I don't need cards or flying doves to feel our magic
See, your smile makes me smile, no, that's cringe
Your laugh makes me laugh, that's even worse
If my journey on this path could ever lead to losing you
I know which path is not my path
You're a blessing from the skies, you're the thief that stole my mind
You are the reason why I think of you all the time
You're the little tiny bug that's found its way inside my ear
And now I can't think a thought without wishing you were here
And I know you don't care, I know that no one even asked
But you're who motivates me when I'm sad
You're the high school crush that I knew that I always wanted
But thought that I'd never have
Always missing my other half, that's you
And if I had a shiny nickel for every time I missed you
I'd use them to buy the moon
Then sell the moon to North Korea
Then use all their fancy missiles to blow craters in that moon
Until it spelled out our initials
Okay wait, that's absurd
Sorry, I'm bad with words
Let me start over
I guess what I'm trying to say
Ah, I'm messing this up, I've thought about this for days
I just haven't found the guts to tell you truly I'm in
Look, I'm not used to spending my time
Floating up on cloud nine with you up in my mind
I used to spend my summers there, it turned to every weekend
Now I find myself among the clouds when I should be home sleeping
That's your fault
That's right, I blame you
I blame you for all my birthday wishes that came true
Ever since we started dating, I am not the same dude
I've changed for the better, I blame you for that too
I really think we got this
I won't talk to you how they talked
I'd hike a million miles, 'cause a thousand is a cakewalk
Give it to me straight, doc, I think it's meant to be
And you would think so too if you knew what you meant to me (awnn)
You know I could ramble on for hours
But the words would never match up perfectly to show the power that you hold
I thought that Midas was a king
So, how come ever since you've touched my heart
Everything has to turn to gold?
You could still warm my heart if I lived up in the Arctic
And everything I felt was freezing cold
My dream is growing old with you
But this letter ain't on paper because mailing stuff is hard
So you'll just have to imagine hugs and kisses on the card
But it's no longer yours truly that I'm writing at the end
It's love, Nate XO, until we meet again
PS
You're perfect 'cause you always skip the BS
I really hope you smile when you see this
Write me back soon
I love you`,
}

const PRESETS = [HAMLET_ROGUE, VECNA_MONOLOGUE, NATE_LOVE_LETTER] as const

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

// Auto-split paragraph-length "lines" into sentences. Backward-chain works
// best when each "line" is a coherent sentence-sized practice unit — a raw
// paragraph as one line creates a huge first recitation target, which Jon
// reported feeling like "starting from the beginning" because he was looking
// at a paragraph-sized wall of text at the end of the speech.
//
// Splits on sentence-terminators (. ? ! —) while preserving the terminator
// on the left fragment. Leaves short lines alone. Tunable threshold.
function autoSplitLongLines(lines: string[], maxWords = 14): string[] {
  const out: string[] = []
  for (const line of lines) {
    if (splitWords(line).length <= maxWords) {
      out.push(line)
      continue
    }
    // Sentence-terminator split. Keep the terminator on the fragment that
    // owns it. Em-dash treated as terminator too. Ellipses are kept intact.
    const parts = line
      .replace(/\.{3,}/g, '\u2026')  // ellipsis → single char so it doesn't split
      .split(/(?<=[.!?—])\s+/)
      .map(p => p.replace(/\u2026/g, '...').trim())
      .filter(p => p.length > 0)
    if (parts.length <= 1) {
      out.push(line)  // no sentence boundary found — leave it
    } else {
      for (const p of parts) out.push(p)
    }
  }
  return out
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
  // Staged peek: first click = 'hint' (≥3 words), second click = 'full'.
  // Auto-resets after 3s so the learner doesn't accidentally keep the
  // reveal on for the next line.
  const [peekStage, setPeekStage] = useState<Record<number, 'hint' | 'full'>>({})
  // Override the next round's span start (GO FROM picker).
  const [manualStart, setManualStart] = useState<number | null>(null)

  const recRef = useRef<Rec | null>(null)
  // Synchronously-tracked liveness flag — flips false in rec.onend so
  // startRound can distinguish a live recognizer from a zombie ref that
  // Chrome auto-ended. React state's `listening` is too lagged for this.
  const recAliveRef = useRef(false)
  const peekTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  // Pending Retry restart — tracked so Cancel / rapid Retry can clear it.
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Phone mic-popup reduction: we keep ONE SpeechRecognition instance alive
  // across Recite → Grade → feedback → Recite (instead of stop+restart per
  // round). Chrome's Web Speech e.results is cumulative across the life of
  // the recognizer; resultOffsetRef tracks "transcript is from this index
  // onward" so each round sees a clean transcript without tearing down the
  // mic. resultCountRef stores the last-observed e.results.length so
  // startRound/retry can shift the offset without needing an event.
  const resultOffsetRef = useRef(0)
  const resultCountRef = useRef(0)
  // Trailing-speech lockout: after a shift (Grade → next round, or Retry),
  // Chrome may still finalize speech that started before the shift. For a
  // short lockout window we absorb any new results into the offset so
  // trailing speech doesn't leak into the next round's transcript.
  const transcriptLockoutUntilRef = useRef(0)
  const SHIFT_LOCKOUT_MS = 500
  const speechOk = useMemo(() => !!getSpeechRecognition(), [])

  // ─── Persistence ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted
        // Forward-compat: legacy saves may lack newer MonologueState fields.
        if (parsed.monologue) {
          if (!parsed.monologue.partialStart) parsed.monologue.partialStart = {}
          if (typeof parsed.monologue.rampRemaining !== 'number') parsed.monologue.rampRemaining = 0
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
  // Applies auto-split at sentence boundaries so paragraph-as-one-line pastes
  // don't produce huge practice chunks that defeat the backward-chain model.
  const loadFromText = useCallback((title: string, text: string) => {
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
    if (rawLines.length === 0) return
    const lines = autoSplitLongLines(rawLines)
    const mono = createMonologueState(lines)
    const next: Persisted = { title: title || 'Untitled', monologue: mono, sessions: 0, lastSpanPassed: false }
    setState(next); persist(next)
    setRecentMisses({})
    setPeekStage({})
    setManualStart(null)
    setPhase('intro')
  }, [persist])

  const loadMonologue = useCallback(() => {
    loadFromText(titleDraft, pasteText)
  }, [pasteText, titleDraft, loadFromText])

  // Generic preset loader. If the user is already mid-preset (title match),
  // resume without wiping. If a DIFFERENT monologue is in progress, confirm
  // replace. Else fresh load.
  const loadPreset = useCallback((preset: { title: string; text: string }) => {
    if (state.monologue && state.title === preset.title) {
      setPhase('intro')
      return
    }
    if (state.monologue && state.title !== preset.title) {
      const ok = confirm(`Replace "${state.title}" progress with a fresh "${preset.title}" session?`)
      if (!ok) return
    }
    loadFromText(preset.title, preset.text)
  }, [loadFromText, state.monologue, state.title])

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
        resultCountRef.current = e.results.length
        // Lockout window absorbs any trailing-speech events that arrive
        // after a round boundary: bump the offset forward so the next
        // round's transcript starts clean regardless of what Chrome finalizes
        // in the first ~500ms after Grade/Retry/Practice Again.
        if (performance.now() < transcriptLockoutUntilRef.current) {
          resultOffsetRef.current = e.results.length
          setTranscript('')
          return
        }
        let finalPart = ''
        let interimPart = ''
        // Start at resultOffsetRef so previous-round results don't re-emit.
        const from = Math.min(resultOffsetRef.current, e.results.length)
        for (let i = from; i < e.results.length; i++) {
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
        // Chrome auto-ends continuous recognition after ~60s of silence or
        // on certain errors. If we didn't call stopListening ourselves, our
        // ref still points at the now-dead instance — clear it so the next
        // round's startRound creates a fresh recognizer instead of thinking
        // this one is still live.
        if (recRef.current === rec) {
          recRef.current = null
          recAliveRef.current = false
        }
      }
      rec.start()
      recRef.current = rec
      recAliveRef.current = true
      resultOffsetRef.current = 0
      resultCountRef.current = 0
      setListening(true)
    } catch (err) {
      setSpeechError(err instanceof Error ? err.message : 'mic error')
    }
  }, [])

  const stopListening = useCallback(() => {
    try { recRef.current?.stop() } catch { /* already stopped */ }
    recRef.current = null
    recAliveRef.current = false
    resultOffsetRef.current = 0
    resultCountRef.current = 0
    transcriptLockoutUntilRef.current = 0
  }, [])

  // Non-destructive reset — drops visible transcript without tearing down
  // the SpeechRecognition. Used when moving to the next round so Chrome's
  // mic indicator doesn't flash every round. The lockout window absorbs
  // trailing-speech results that Chrome might finalize just after the shift.
  const shiftTranscriptWindow = useCallback(() => {
    resultOffsetRef.current = resultCountRef.current
    transcriptLockoutUntilRef.current = performance.now() + SHIFT_LOCKOUT_MS
    setTranscript('')
    setSpeechError(null)
  }, [])

  // ─── Start round ────────────────────────────────────────────────────────
  // Respects `manualStart` (GO FROM picker) — one-shot override that scopes
  // the round to a specific starting line, then reverts to the scheduler.
  // Starts the SpeechRecognition only if it isn't already running. On
  // subsequent rounds the recognizer stays alive; we just shift the
  // transcript offset forward so Chrome's in-use popup doesn't re-animate.
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
    setGrading(null)
    setPeekStage({})
    setPhase('reciting')
    // Check recAliveRef (synchronous) not just recRef.current — Chrome's
    // auto-end may have killed the recognizer without the React ref being
    // cleared in time to beat this branch.
    if (recRef.current && recAliveRef.current) {
      // Live recognizer — drop the previous round's transcript without
      // tearing down the mic.
      shiftTranscriptWindow()
    } else {
      // Zombie ref or first round — null any stale ref, restart cleanly.
      recRef.current = null
      setTranscript('')
      startListening()
    }
  }, [state.monologue, manualStart, shiftTranscriptWindow, startListening])

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  // Retry = "I know I flubbed that, let me say it again" without losing the
  // round scope. Shift the transcript window forward rather than stopping
  // and restarting the recognizer — keeps the mic alive so Chrome doesn't
  // flash its in-use indicator every retry on mobile.
  const retryRecitation = useCallback(() => {
    clearRetryTimer()
    shiftTranscriptWindow()
  }, [clearRetryTimer, shiftTranscriptWindow])

  useEffect(() => () => {
    clearRetryTimer()
    stopListening()
  }, [clearRetryTimer, stopListening])

  // Teardown the mic when leaving the reciting/feedback loop. Keeping it
  // alive through Recite → Grade → feedback → Practice-again saves a
  // Chrome mic-popup per round, but once the user is back on intro/menu
  // we release it so no orange recording indicator hangs around.
  useEffect(() => {
    if (phase === 'intro' || phase === 'menu' || phase === 'paste') {
      if (recRef.current) stopListening()
    }
  }, [phase, stopListening])

  // ─── Grade recitation ───────────────────────────────────────────────────
  const gradeRecitation = useCallback(() => {
    if (!state.monologue || !currentSpan) return
    clearRetryTimer()
    // NOTE: we deliberately do NOT stop the recognizer here. Keeping it alive
    // through feedback → next round prevents Chrome's mic-in-use indicator
    // from re-animating every round on phone. stopListening is called only
    // on Cancel, full exit to intro/menu, or component unmount.
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
  }, [state, currentSpan, transcript, persist, clearRetryTimer])

  // ─── Peek helper (staged hint → full reveal) ────────────────────────────
  // Click cadence per line:
  //   undefined → 'hint' (shows ≥3 words, overrides baseline scaffold)
  //   'hint'    → 'full' (shows the complete line)
  //   'full'    → undefined (fresh cycle)
  // Auto-reset after 3s of inactivity so the reveal can't bleed into the
  // next round.
  const peekLine = useCallback((idx: number) => {
    setPeekStage(prev => {
      const current = prev[idx]
      const nextStage: 'hint' | 'full' | undefined =
        current === undefined ? 'hint'
        : current === 'hint' ? 'full'
        : undefined
      const next = { ...prev }
      if (nextStage === undefined) delete next[idx]
      else next[idx] = nextStage
      return next
    })
    const prior = peekTimersRef.current.get(idx)
    if (prior) clearTimeout(prior)
    const t = setTimeout(() => {
      setPeekStage(prev => {
        if (!(idx in prev)) return prev
        const next = { ...prev }
        delete next[idx]
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

        <div className="mt-3 flex flex-col gap-2 w-full max-w-md">
          {PRESETS.map(preset => {
            const isCurrent = state.monologue && state.title === preset.title
            return (
              <button key={preset.title} onClick={() => loadPreset(preset)}
                className="px-6 py-2 rounded-xl text-sm font-medium text-gray-200 active:scale-95"
                style={{
                  background: isCurrent ? 'rgba(60,40,70,0.8)' : 'rgba(30,25,45,0.8)',
                  border: `1px solid ${isCurrent ? 'rgba(167,139,250,0.5)' : 'rgba(139,92,246,0.35)'}`,
                }}>
                {isCurrent ? '🎭 Resume' : '🎭 Load preset'} — {preset.title}
              </button>
            )
          })}
        </div>

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
        <div className="text-sm text-gray-400 mb-1">
          You know lines {knownStart + 1} through {knownEnd + 1}
          {' '}({knownEnd - knownStart + 1} of {mono.lines.length})
        </div>
        <div className="text-[11px] text-gray-500 mb-2 font-mono tracking-wide">
          backward chain · last line first → prepending toward line 1
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
          {currentSpan.type === 'ramp-solo' ? 'Fresh line — solo'
            : currentSpan.type === 'ramp-cluster' ? 'Fresh line + next 2'
            : currentSpan.type === 'working' ? 'Working window'
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
            const stage = peekStage[idx]
            // Stage resolution: full beats everything, hint forces ≥3 words
            // over baseline scaffold, no stage = baseline miss-driven scaffold.
            const HINT_WORDS = 3
            const show = stage === 'full' ? words.length
              : stage === 'hint' ? Math.min(words.length, Math.max(HINT_WORDS, scaffoldWords(miss)))
              : Math.min(words.length, scaffoldWords(miss))
            const shown = words.slice(0, show).join(' ')
            const hiddenCount = words.length - show
            const peekLabel = stage === undefined ? 'hint'
              : stage === 'hint' ? 'more'
              : 'hide'
            return (
              <div key={idx} className="flex items-start gap-2 py-1">
                <div className="text-[10px] font-mono text-gray-500 w-6 text-right pt-0.5">{idx + 1}</div>
                {partial && (
                  <span className="text-[10px] font-mono px-1 rounded mt-0.5"
                    style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>½</span>
                )}
                <div className="flex-1 text-sm">
                  <span className={stage === 'full' ? 'text-gray-200' : stage === 'hint' ? 'text-amber-200' : 'text-gray-300'}>{shown}</span>
                  {hiddenCount > 0 && (
                    <span className="text-gray-600"> {Array(Math.min(hiddenCount, 12)).fill('___').join(' ')}
                      {hiddenCount > 12 && <span> …</span>}
                    </span>
                  )}
                  {miss >= 2 && stage !== 'full' && (
                    <span className="ml-2 text-[10px] text-orange-400">({miss} miss)</span>
                  )}
                </div>
                <button onClick={() => peekLine(idx)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded border active:scale-95"
                  style={{
                    color: stage === 'full' ? '#fbbf24' : stage === 'hint' ? '#fde68a' : '#9ca3af',
                    borderColor: stage === undefined ? 'rgba(75,85,99,0.6)' : 'rgba(251,191,36,0.4)',
                  }}
                  title={stage === undefined ? 'Reveal first 3 words' : stage === 'hint' ? 'Reveal full line' : 'Hide again'}>
                  {peekLabel}
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
