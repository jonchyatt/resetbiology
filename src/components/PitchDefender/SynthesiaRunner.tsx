'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// SynthesiaRunner — Vertical falling-blocks Synthesia clone for voice
// ═══════════════════════════════════════════════════════════════════════════════
//
// Real Synthesia: piano keyboard at the bottom, colored rectangular blocks fall
// top-to-bottom toward the keys. Block height = note duration. When a block
// lands on its key, the player must SING that pitch. Pause-on-correct mode
// holds the game until the player matches the target pitch.
//
// Architecture:
//   Canvas 2D rendering · requestAnimationFrame loop
//   PitchFusion (enableML: false — CREPE hangs in production)
//   Tolerance: 2.5 semitones (Jon's standard for forgiving practice)
//   Pitch matching uses isActive ONLY (NEVER isSettled — #1 historical bug)
//
// Architecture rule: ADDITIVE only. Does NOT touch NoteRunner.tsx.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import { PitchFusion, type FusedPitch } from './pitchFusion'
import { NOTE_COLORS } from '@/lib/fsrs'
import { initAudio, playPianoNote } from './audioEngine'
import { extractNotesFromXML, notesToSemitoneArray, type ExtractionResult } from './extractNotes'

// ─── Constants ──────────────────────────────────────────────────────────────

const CANVAS_W = 520
const CANVAS_H = 680
const KEYBOARD_H = 140
const FALL_AREA_H = CANVAS_H - KEYBOARD_H
const HIT_LINE_Y = FALL_AREA_H - 20  // hit zone just above keyboard

// Treble range C4 → C6 (2 octaves) = 25 semitones, 15 white keys
const KEYBOARD_LOW = 0   // C4 (semitones from C4)
const KEYBOARD_HIGH = 24 // C6 (24 semitones above C4)

const NOTE_NAMES_ALL = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const WHITE_KEY_OFFSETS = [0, 2, 4, 5, 7, 9, 11] // semitones from C in an octave

function semiToName(semi: number): string {
  const idx = ((Math.round(semi) % 12) + 12) % 12
  const oct = 4 + Math.floor(semi / 12)
  return `${NOTE_NAMES_ALL[idx]}${oct}`
}

function isBlackKey(semi: number): boolean {
  const idx = ((Math.round(semi) % 12) + 12) % 12
  return [1, 3, 6, 8, 10].includes(idx)
}

// ─── Songs (built-in) ────────────────────────────────────────────────────────

const SONGS: { name: string; notes: number[]; description: string }[] = [
  { name: 'C Major Scale', notes: [0, 2, 4, 5, 7, 9, 11, 12], description: 'Start here — 8 notes ascending' },
  { name: 'Twinkle Twinkle', notes: [0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0], description: 'The classic — 14 notes' },
  { name: 'Ode to Joy', notes: [4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 4, 2, 2], description: 'Beethoven — 15 notes' },
  { name: 'Mary Had a Little Lamb', notes: [4, 2, 0, 2, 4, 4, 4, 2, 2, 2, 4, 7, 7], description: 'Simple — 13 notes' },
]

// Tutorial: 3 slow notes
const TUTORIAL_NOTES = [0, 4, 7] // C4, E4, G4

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = 'menu' | 'tutorial' | 'playing' | 'complete'

interface FallingBlock {
  id: number
  semitones: number     // from C4
  name: string          // e.g. "C4"
  duration: number      // in beats (visual block height proxy)
  y: number             // current top edge in canvas pixels
  height: number        // block height in px
  state: 'falling' | 'waiting' | 'matched' | 'cleared'
  matchProgress: number // 0..1 (small hold to confirm)
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SynthesiaRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fusionRef = useRef<PitchFusion | null>(null)
  const pitchRef = useRef<FusedPitch | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef(0)

  // Game state (mutable refs for game loop, not React state)
  const blocksRef = useRef<FallingBlock[]>([])
  const currentIdxRef = useRef(0)
  const scoreRef = useRef(0)
  const totalNotesRef = useRef(0)
  const notesHitRef = useRef(0)
  const phaseRef = useRef<Phase>('menu')
  const speedRef = useRef(0.75)
  const practiceRef = useRef(true)

  // Tunables (persisted via React state for UI control)
  const [phase, setPhase] = useState<Phase>('menu')
  const [selectedSong, setSelectedSong] = useState(0)
  const [speedMul, setSpeedMul] = useState(0.75) // 25/50/75/100/125/150 %
  const [practiceMode, setPracticeMode] = useState(true) // pause-on-correct
  const [tutorialMode, setTutorialMode] = useState(false)

  // HUD display state (synced from refs)
  const [displayState, setDisplayState] = useState({ score: 0, hit: 0, total: 0 })
  const [currentTarget, setCurrentTarget] = useState<string>('')
  const [pitchHint, setPitchHint] = useState<'low' | 'on' | 'high' | null>(null)

  // Custom MusicXML songs
  const [customSongs, setCustomSongs] = useState<{ name: string; notes: number[]; description: string }[]>([])
  const [loadingXML, setLoadingXML] = useState(false)
  const [xmlParts, setXmlParts] = useState<string[]>([])
  const [xmlResult, setXmlResult] = useState<ExtractionResult | null>(null)
  const [showPartPicker, setShowPartPicker] = useState(false)

  const allSongs = [...SONGS, ...customSongs]

  // Tolerance for casual singing
  const TOLERANCE = 2.5 // semitones
  const BASE_FALL_SPEED = 90 // px/sec at 100% speed
  const HOLD_DURATION_MS = 280 // brief confirm hold

  // ─── MusicXML import ──────────────────────────────────────────────────────
  const addCustomSong = useCallback((result: ExtractionResult, partIdx: number) => {
    const semis = notesToSemitoneArray(result.notes, partIdx)
    if (semis.length === 0) return
    // Clamp to keyboard range (C4..C6)
    const clamped = semis.map(s => {
      let v = s
      while (v < KEYBOARD_LOW) v += 12
      while (v > KEYBOARD_HIGH) v -= 12
      return v
    })
    const partLabel = result.parts.length > 1 ? ` (${result.parts[partIdx]})` : ''
    const song = {
      name: `${result.title}${partLabel}`,
      notes: clamped,
      description: `Imported · ${clamped.length} notes`,
    }
    setCustomSongs(prev => [...prev, song])
    setSelectedSong(SONGS.length + customSongs.length)
    setShowPartPicker(false)
    setXmlResult(null)
  }, [customSongs.length])

  const handleMusicXML = useCallback(async (file: File) => {
    setLoadingXML(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let data: string | Uint8Array
      if (ext === 'mxl') data = new Uint8Array(await file.arrayBuffer())
      else data = await file.text()
      const result = await extractNotesFromXML(data)
      setXmlResult(result)
      setXmlParts(result.parts)
      if (result.parts.length > 1) setShowPartPicker(true)
      else addCustomSong(result, 0)
    } catch (err) {
      console.error('MusicXML parse error:', err)
    }
    setLoadingXML(false)
  }, [addCustomSong])

  const loadSampleScore = useCallback(async (url: string) => {
    setLoadingXML(true)
    try {
      const resp = await fetch(url)
      const text = await resp.text()
      const result = await extractNotesFromXML(text)
      setXmlResult(result)
      setXmlParts(result.parts)
      if (result.parts.length > 1) setShowPartPicker(true)
      else addCustomSong(result, 0)
    } catch (err) {
      console.error('Sample load error:', err)
    }
    setLoadingXML(false)
  }, [addCustomSong])

  // ─── Build blocks from a note list ────────────────────────────────────────
  const buildBlocks = useCallback((notes: number[]): FallingBlock[] => {
    const out: FallingBlock[] = []
    // Stagger blocks vertically above the canvas; first block enters first
    let cursorY = -60
    for (let i = 0; i < notes.length; i++) {
      const semi = notes[i]
      const blockH = 70 // uniform height (could vary by duration in MusicXML version)
      const gap = 30
      out.push({
        id: i,
        semitones: semi,
        name: semiToName(semi),
        duration: 1,
        y: cursorY,
        height: blockH,
        state: 'falling',
        matchProgress: 0,
      })
      cursorY -= (blockH + gap)
    }
    return out
  }, [])

  // ─── Start game ───────────────────────────────────────────────────────────
  const startGame = useCallback(async (useTutorial = false) => {
    initAudio()
    const noteList = useTutorial ? TUTORIAL_NOTES : allSongs[selectedSong].notes
    const blocks = buildBlocks(noteList)
    blocksRef.current = blocks
    currentIdxRef.current = 0
    scoreRef.current = 0
    notesHitRef.current = 0
    totalNotesRef.current = blocks.length
    setDisplayState({ score: 0, hit: 0, total: blocks.length })
    setCurrentTarget('')
    setPitchHint(null)
    setTutorialMode(useTutorial)
    phaseRef.current = 'playing'  // set ref FIRST so loop survives initial schedule
    setPhase('playing')

    // Start pitch detection — enableML: false (CREPE hangs in production)
    try {
      const fusion = new PitchFusion({ enableML: false, noiseGateDb: -45 })
      fusionRef.current = fusion
      await fusion.start((p) => { pitchRef.current = p })
    } catch (err) {
      console.error('PitchFusion start failed:', err)
    }

    lastTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [selectedSong, allSongs, buildBlocks])

  // ─── Game loop ────────────────────────────────────────────────────────────
  const gameLoop = useCallback(() => {
    // Exit if game ended
    if (phaseRef.current !== 'playing') return

    const canvas = canvasRef.current
    if (!canvas) {
      // Canvas not mounted yet — reschedule until React renders the playing phase
      rafRef.current = requestAnimationFrame(gameLoop)
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      rafRef.current = requestAnimationFrame(gameLoop)
      return
    }

    const now = performance.now()
    const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000)
    lastTimeRef.current = now

    const blocks = blocksRef.current
    const pitch = pitchRef.current

    // ── Update positions ──
    let paused = false
    const fallSpeed = BASE_FALL_SPEED * speedRef.current

    const currentIdx = currentIdxRef.current
    const currentBlock = blocks[currentIdx]

    // Detect waiting state
    if (currentBlock && practiceRef.current) {
      // Has the current block reached the hit line?
      const blockBottom = currentBlock.y + currentBlock.height
      if (blockBottom >= HIT_LINE_Y && currentBlock.state === 'falling') {
        currentBlock.state = 'waiting'
        currentBlock.y = HIT_LINE_Y - currentBlock.height
        // Play reference tone
        const refName = currentBlock.name
        if (!refName.includes('#')) playPianoNote(refName)
        setCurrentTarget(refName)
      }
    }

    if (currentBlock?.state === 'waiting') paused = true

    // Move falling blocks (only if not paused on the leader)
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      if (b.state === 'cleared' || b.state === 'matched') continue
      if (b.state === 'waiting') continue

      // Followers stop above the waiting block
      if (paused && i > currentIdx) {
        // Don't pile on top — keep relative spacing
        const ahead = blocks[i - 1]
        const desiredTop = ahead.y - 30 - b.height
        if (b.y < desiredTop) {
          b.y += fallSpeed * dt
          if (b.y > desiredTop) b.y = desiredTop
        }
        continue
      }

      b.y += fallSpeed * dt
    }

    // ── Pitch matching for waiting block ──
    // CRITICAL: use isActive ONLY (never isSettled — #1 historical bug)
    if (currentBlock?.state === 'waiting' && pitch?.isActive) {
      const deviation = pitch.staffPosition - currentBlock.semitones
      const absDev = Math.abs(deviation)

      // Pitch hint indicator
      if (absDev <= TOLERANCE) setPitchHint('on')
      else if (deviation < 0) setPitchHint('low')
      else setPitchHint('high')

      if (absDev <= TOLERANCE) {
        currentBlock.matchProgress += dt * 1000
        if (currentBlock.matchProgress >= HOLD_DURATION_MS) {
          // MATCH!
          currentBlock.state = 'matched'
          notesHitRef.current++
          scoreRef.current += 100
          currentIdxRef.current++
          setDisplayState({
            score: scoreRef.current,
            hit: notesHitRef.current,
            total: totalNotesRef.current,
          })
          setCurrentTarget('')
          setPitchHint(null)
          setTimeout(() => { currentBlock.state = 'cleared' }, 250)

          // Song complete?
          if (currentIdxRef.current >= blocks.length) {
            setPhase('complete')
            fusionRef.current?.stop()
            return
          }
        }
      } else {
        currentBlock.matchProgress = Math.max(0, currentBlock.matchProgress - dt * 500)
      }
    } else if (currentBlock?.state === 'waiting') {
      setPitchHint(null)
      currentBlock.matchProgress = Math.max(0, currentBlock.matchProgress - dt * 200)
    }

    // ── Flow mode: blocks past hit line are missed ──
    if (!practiceRef.current) {
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]
        if (b.state !== 'falling') continue
        if (b.y > FALL_AREA_H) {
          b.state = 'cleared'
          if (i === currentIdxRef.current) {
            currentIdxRef.current++
            if (currentIdxRef.current >= blocks.length) {
              setPhase('complete')
              fusionRef.current?.stop()
              return
            }
          }
        }
      }
    }

    // ── Render ──
    render(ctx, blocks, currentIdx, pitch)

    if (phaseRef.current === 'playing') {
      rafRef.current = requestAnimationFrame(gameLoop)
    }
  }, [])

  // Sync refs from state so the loop sees live values
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { speedRef.current = speedMul }, [speedMul])
  useEffect(() => { practiceRef.current = practiceMode }, [practiceMode])

  // ─── Render ───────────────────────────────────────────────────────────────
  const render = useCallback((
    ctx: CanvasRenderingContext2D,
    blocks: FallingBlock[],
    currentIdx: number,
    pitch: FusedPitch | null,
  ) => {
    // Background
    ctx.fillStyle = '#08080f'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // Subtle vertical lane lines (one per white key)
    const whiteKeys = getWhiteKeys()
    const keyW = CANVAS_W / whiteKeys.length
    for (let i = 0; i < whiteKeys.length; i++) {
      const x = i * keyW
      ctx.fillStyle = i % 2 === 0 ? 'rgba(20,20,40,0.4)' : 'rgba(15,15,30,0.6)'
      ctx.fillRect(x, 0, keyW, FALL_AREA_H)
    }

    // Hit line
    ctx.strokeStyle = 'rgba(100,200,255,0.4)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(0, HIT_LINE_Y)
    ctx.lineTo(CANVAS_W, HIT_LINE_Y)
    ctx.stroke()
    ctx.setLineDash([])

    // Falling blocks
    for (const b of blocks) {
      if (b.state === 'cleared') continue
      const keyIdx = whiteKeyIndexFor(b.semitones)
      if (keyIdx < 0) continue
      const x = keyIdx * keyW
      const w = keyW - 6 // small gap
      const blockX = x + 3
      const colorInfo = NOTE_COLORS[b.name]
      const hue = colorInfo?.hue ?? (b.semitones * 30) % 360

      // Outer glow when waiting
      if (b.state === 'waiting') {
        ctx.fillStyle = `hsla(${hue}, 90%, 60%, 0.25)`
        ctx.fillRect(blockX - 6, b.y - 6, w + 12, b.height + 12)
      }

      // Block fill (rounded rectangle)
      const isMatched = b.state === 'matched'
      const fillAlpha = isMatched ? 0.4 : (b.state === 'waiting' ? 1.0 : 0.85)
      ctx.fillStyle = isMatched
        ? `hsla(120, 80%, 60%, ${fillAlpha})`
        : `hsla(${hue}, 80%, 55%, ${fillAlpha})`
      roundedRect(ctx, blockX, b.y, w, b.height, 8)
      ctx.fill()

      // Top highlight
      ctx.fillStyle = `hsla(${hue}, 90%, 75%, 0.5)`
      roundedRect(ctx, blockX, b.y, w, 10, 8)
      ctx.fill()

      // Border
      ctx.strokeStyle = `hsla(${hue}, 70%, 80%, 0.9)`
      ctx.lineWidth = 2
      roundedRect(ctx, blockX, b.y, w, b.height, 8)
      ctx.stroke()

      // Note name label (BIG and visible)
      ctx.font = 'bold 18px monospace'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(b.name, blockX + w / 2, b.y + b.height / 2)

      // Hold progress ring
      if (b.state === 'waiting' && b.matchProgress > 0) {
        const pct = Math.min(1, b.matchProgress / HOLD_DURATION_MS)
        ctx.strokeStyle = 'rgba(100,255,160,0.95)'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(blockX, b.y + b.height + 6)
        ctx.lineTo(blockX + w * pct, b.y + b.height + 6)
        ctx.stroke()
      }
    }

    // Keyboard at bottom
    drawKeyboard(ctx, whiteKeys, keyW, blocks[currentIdx])
  }, [])

  // ─── Helper: rounded rect ─────────────────────────────────────────────────
  const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  const getWhiteKeys = (): number[] => {
    // Returns semitone offsets from C4 for every white key in range
    const keys: number[] = []
    for (let semi = KEYBOARD_LOW; semi <= KEYBOARD_HIGH; semi++) {
      if (!isBlackKey(semi)) keys.push(semi)
    }
    return keys
  }

  const whiteKeyIndexFor = (semi: number): number => {
    // For black keys, snap to nearest white below
    let s = semi
    if (isBlackKey(s)) s -= 1
    const keys = getWhiteKeys()
    return keys.indexOf(s)
  }

  // Convert canvas (x, y) → semitone index (with black-key priority).
  // Returns null if click was not on the keyboard.
  const semiFromCanvasXY = (x: number, y: number): number | null => {
    const keyboardY = FALL_AREA_H
    if (y < keyboardY) return null
    const whiteKeys = getWhiteKeys()
    const keyW = CANVAS_W / whiteKeys.length
    const blackKeyW = keyW * 0.6
    const blackKeyH = (KEYBOARD_H - 8) * 0.62

    // Black keys first (they sit on top of white keys, so they take priority)
    if (y < keyboardY + 4 + blackKeyH) {
      for (let i = 0; i < whiteKeys.length - 1; i++) {
        const semi = whiteKeys[i]
        const nextSemi = whiteKeys[i + 1]
        if (nextSemi - semi !== 2) continue
        const blackSemi = semi + 1
        const bx = (i + 1) * keyW - blackKeyW / 2
        if (x >= bx && x <= bx + blackKeyW) {
          return blackSemi
        }
      }
    }

    // White keys
    const whiteIdx = Math.floor(x / keyW)
    if (whiteIdx >= 0 && whiteIdx < whiteKeys.length) {
      return whiteKeys[whiteIdx]
    }
    return null
  }

  const handleKeyboardClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H
    const semi = semiFromCanvasXY(x, y)
    if (semi == null) return
    // Play the hint
    initAudio()
    playPianoNote(semiToName(semi))
  }, [])

  const drawKeyboard = (
    ctx: CanvasRenderingContext2D,
    whiteKeys: number[],
    keyW: number,
    currentBlock?: FallingBlock,
  ) => {
    const keyboardY = FALL_AREA_H
    // Background bar
    ctx.fillStyle = '#0a0a14'
    ctx.fillRect(0, keyboardY, CANVAS_W, KEYBOARD_H)
    ctx.strokeStyle = 'rgba(80,80,120,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, keyboardY)
    ctx.lineTo(CANVAS_W, keyboardY)
    ctx.stroke()

    // White keys
    for (let i = 0; i < whiteKeys.length; i++) {
      const semi = whiteKeys[i]
      const x = i * keyW
      const isTarget = currentBlock?.state === 'waiting' && whiteKeyIndexFor(currentBlock.semitones) === i

      // Key body
      if (isTarget) {
        ctx.fillStyle = 'rgba(100,200,255,0.85)'
      } else {
        ctx.fillStyle = '#f4f4f8'
      }
      ctx.fillRect(x + 1, keyboardY + 4, keyW - 2, KEYBOARD_H - 8)

      // Key border
      ctx.strokeStyle = '#1a1a2a'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 1, keyboardY + 4, keyW - 2, KEYBOARD_H - 8)

      // Label C notes
      const noteName = semiToName(semi)
      if (noteName.startsWith('C')) {
        ctx.fillStyle = isTarget ? '#ffffff' : '#444'
        ctx.font = 'bold 11px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(noteName, x + keyW / 2, keyboardY + KEYBOARD_H - 6)
      }
    }

    // Black keys (overlaid)
    const blackKeyW = keyW * 0.6
    const blackKeyH = (KEYBOARD_H - 8) * 0.62
    for (let i = 0; i < whiteKeys.length - 1; i++) {
      const semi = whiteKeys[i]
      // Black key sits between this white and the next
      const nextSemi = whiteKeys[i + 1]
      if (nextSemi - semi !== 2) continue // no black between E-F or B-C
      const blackSemi = semi + 1
      const x = (i + 1) * keyW - blackKeyW / 2
      const isTarget = currentBlock?.state === 'waiting' && currentBlock.semitones === blackSemi

      ctx.fillStyle = isTarget ? 'rgba(100,200,255,0.95)' : '#0a0a14'
      ctx.fillRect(x, keyboardY + 4, blackKeyW, blackKeyH)
      ctx.strokeStyle = '#2a2a3a'
      ctx.strokeRect(x, keyboardY + 4, blackKeyW, blackKeyH)
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => () => {
    fusionRef.current?.stop()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  // ─── Canvas DPR setup ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_W * dpr
    canvas.height = CANVAS_H * dpr
    canvas.style.width = `${CANVAS_W}px`
    canvas.style.height = `${CANVAS_H}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
  }, [phase])

  // ─── Menu ─────────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    return (
      <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center justify-center px-6 overflow-y-auto py-8">
        <h1 className="text-4xl font-black text-white mb-2"
          style={{ textShadow: '0 0 40px rgba(139,92,246,0.4)' }}>
          SYNTHESIA RUNNER
        </h1>
        <p className="text-gray-400 mb-6 text-center">
          Watch colored blocks fall onto the piano. Sing the note when it lands.
        </p>

        {/* Tutorial CTA */}
        <button
          onClick={() => startGame(true)}
          className="mb-6 px-8 py-3 rounded-2xl text-base font-bold text-white transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #4ade80, #16a34a)',
            boxShadow: '0 0 20px rgba(74,222,128,0.3)',
          }}
        >
          PLAY TUTORIAL (3 notes)
        </button>

        {/* Song selector */}
        <div className="w-full max-w-md mb-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Choose a Song</div>
          <div className="space-y-1.5" style={{ maxHeight: 220, overflowY: 'auto' }}>
            {allSongs.map((song, i) => (
              <button
                key={i}
                onClick={() => setSelectedSong(i)}
                className="w-full text-left px-4 py-2.5 rounded-xl transition-all"
                style={{
                  background: selectedSong === i ? 'rgba(139,92,246,0.15)' : 'rgba(20,20,35,0.6)',
                  border: `1px solid ${selectedSong === i ? 'rgba(139,92,246,0.4)' : i >= SONGS.length ? 'rgba(99,102,241,0.3)' : 'rgba(40,40,60,0.3)'}`,
                }}
              >
                <div className="font-medium" style={{ color: selectedSong === i ? '#c4b5fd' : i >= SONGS.length ? '#a5b4fc' : '#aaa' }}>
                  {i >= SONGS.length ? 'Imported: ' : ''}{song.name}
                </div>
                <div className="text-xs" style={{ color: selectedSong === i ? '#8b8b9e' : '#555' }}>
                  {song.description}
                </div>
              </button>
            ))}
          </div>

          {/* Import from MusicXML */}
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(60,60,80,0.2)' }}>
            <div className="text-xs text-gray-600 mb-2">Load Your Music</div>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer px-3 py-2 rounded-xl text-center text-xs font-medium transition-all hover:bg-indigo-500/10"
                style={{ background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.3)', color: '#818cf8' }}>
                Upload MusicXML
                <input type="file" accept=".xml,.musicxml,.mxl" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleMusicXML(f); e.target.value = '' }} />
              </label>
              <select
                onChange={e => { if (!e.target.value) return; loadSampleScore(e.target.value); e.target.value = '' }}
                className="px-3 py-2 rounded-xl text-xs cursor-pointer"
                style={{ background: 'rgba(20,20,35,0.6)', border: '1px solid rgba(60,60,80,0.3)', color: '#888' }}
                value="">
                <option value="">Sample Scores</option>
                <option value="/musicxml/farewell-dear-love-leavitt.musicxml">Farewell — Leavitt (Tenor)</option>
                <option value="/musicxml/false-phyllis-wilson.musicxml">False Phyllis — Wilson</option>
                <option value="/musicxml/barnby-crossing-the-bar-satb.musicxml">Crossing the Bar (SATB)</option>
                <option value="/musicxml/amazing-grace-hymn.xml">Amazing Grace</option>
              </select>
            </div>
            {loadingXML && <div className="text-xs text-indigo-400 mt-1 animate-pulse">Parsing score...</div>}
          </div>

          {/* Part picker */}
          {showPartPicker && xmlResult && (
            <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
              <div className="text-xs text-indigo-300 mb-2">Pick a voice part:</div>
              <div className="flex gap-2 flex-wrap">
                {xmlParts.map((name, i) => (
                  <button key={i} onClick={() => addCustomSong(xmlResult, i)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-indigo-500/20"
                    style={{ border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc' }}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Speed control */}
        <div className="w-full max-w-md mb-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Speed</div>
          <div className="flex gap-1.5">
            {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5].map(s => (
              <button
                key={s}
                onClick={() => setSpeedMul(s)}
                className="flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: speedMul === s ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.4)',
                  border: `2px solid ${speedMul === s ? '#818cf8' : 'rgba(60,60,80,0.3)'}`,
                  color: speedMul === s ? '#c7d2fe' : '#888',
                }}
              >
                {Math.round(s * 100)}%
              </button>
            ))}
          </div>
        </div>

        {/* Practice mode toggle */}
        <div className="w-full max-w-md mb-6">
          <button
            onClick={() => setPracticeMode(p => !p)}
            className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all"
            style={{
              background: practiceMode ? 'rgba(74,222,128,0.12)' : 'rgba(40,40,60,0.4)',
              border: `2px solid ${practiceMode ? 'rgba(74,222,128,0.4)' : 'rgba(60,60,80,0.3)'}`,
              color: practiceMode ? '#86efac' : '#888',
            }}
          >
            {practiceMode ? 'PRACTICE MODE — pause until you sing it' : 'FLOW MODE — continuous scroll'}
          </button>
        </div>

        <button
          onClick={() => startGame(false)}
          className="px-10 py-4 rounded-2xl text-xl font-bold text-white transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
            boxShadow: '0 0 30px rgba(139,92,246,0.3), 0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          START
        </button>

        <a href="/pitch-defender" className="mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Back to Pitch Defender
        </a>
      </div>
    )
  }

  // ─── Complete ─────────────────────────────────────────────────────────────
  if (phase === 'complete') {
    const acc = displayState.total > 0 ? Math.round((displayState.hit / displayState.total) * 100) : 0
    return (
      <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center justify-center px-6">
        <div className="text-5xl font-black text-white mb-4"
          style={{ textShadow: '0 0 30px rgba(100,255,160,0.4)' }}>
          {acc === 100 ? 'PERFECT!' : acc >= 80 ? 'GREAT!' : 'COMPLETE'}
        </div>
        <div className="grid grid-cols-3 gap-x-8 gap-y-3 mb-8">
          <div className="text-center">
            <div className="text-xs text-gray-500">SCORE</div>
            <div className="text-2xl font-bold text-white">{displayState.score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">ACCURACY</div>
            <div className="text-2xl font-bold" style={{ color: acc >= 80 ? '#64ffa0' : '#ffc83c' }}>{acc}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">NOTES</div>
            <div className="text-2xl font-bold text-purple-400">{displayState.hit}/{displayState.total}</div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => startGame(tutorialMode)}
            className="px-8 py-3 rounded-xl font-bold text-white bg-purple-600 active:scale-95 transition-all">
            PLAY AGAIN
          </button>
          <button onClick={() => setPhase('menu')}
            className="px-6 py-3 rounded-xl font-medium text-gray-400 border border-gray-700 active:scale-95 transition-all">
            MENU
          </button>
        </div>
      </div>
    )
  }

  // ─── Playing ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center overflow-y-auto"
      style={{ paddingTop: 16, paddingBottom: 16 }}>

      {/* Instructions ABOVE the canvas */}
      <div className="text-center mb-3 max-w-md">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">How to Play</div>
        <div className="text-sm text-gray-300 leading-snug space-y-0.5">
          <div>Watch the blocks fall toward the keyboard</div>
          <div>Sing the note when the block reaches its key</div>
          <div className="text-cyan-400">{practiceMode ? 'Pause-on-correct mode is active' : 'Flow mode — keep up!'}</div>
        </div>
      </div>

      {/* HUD */}
      <div className="flex justify-between w-full max-w-[520px] mb-2 px-1">
        <div className="text-white">
          <div className="text-xl font-bold tabular-nums">{displayState.score}</div>
          <div className="text-xs text-gray-500">{displayState.hit}/{displayState.total}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Speed</span>
          <select
            value={speedMul}
            onChange={e => setSpeedMul(parseFloat(e.target.value))}
            className="text-xs px-2 py-1 rounded bg-[#15152a] border border-[#3a3a55] text-gray-200 cursor-pointer"
          >
            {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5].map(s => (
              <option key={s} value={s}>{Math.round(s * 100)}%</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          onClick={handleKeyboardClick}
          style={{
            display: 'block',
            border: '1px solid rgba(60,60,90,0.4)',
            borderRadius: 12,
            boxShadow: '0 0 40px rgba(139,92,246,0.15)',
            cursor: 'pointer',
          }}
        />

        {/* Tap hint banner */}
        <div className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider"
          style={{
            top: FALL_AREA_H - 30,
            background: 'rgba(8,8,15,0.85)',
            border: '1px solid rgba(100,200,255,0.4)',
            color: '#7dd3fc',
            pointerEvents: 'none',
          }}>
          TAP ANY KEY TO HEAR IT
        </div>

        {/* Pitch hint side bar (right side) */}
        {currentTarget && (
          <div className="absolute top-2 right-2 flex flex-col items-center"
            style={{ height: FALL_AREA_H - 16 }}>
            <div className="text-xs text-gray-400 mb-1">YOU</div>
            <div
              className="w-3 rounded-full transition-all"
              style={{
                flex: 1,
                background: pitchHint === 'on'
                  ? 'linear-gradient(to bottom, rgba(60,60,90,0.4), rgba(74,222,128,0.9), rgba(60,60,90,0.4))'
                  : pitchHint === 'high'
                    ? 'linear-gradient(to bottom, rgba(255,160,80,0.9), rgba(60,60,90,0.4))'
                    : pitchHint === 'low'
                      ? 'linear-gradient(to top, rgba(255,160,80,0.9), rgba(60,60,90,0.4))'
                      : 'rgba(60,60,90,0.4)',
                boxShadow: pitchHint === 'on' ? '0 0 12px rgba(74,222,128,0.6)' : 'none',
              }}
            />
            <div className="text-xs mt-1" style={{ color: pitchHint === 'on' ? '#86efac' : '#888' }}>
              {pitchHint === 'on' ? 'ON' : pitchHint === 'high' ? '↓' : pitchHint === 'low' ? '↑' : '·'}
            </div>
          </div>
        )}

        {/* Sing-this-note prompt overlay */}
        {currentTarget && (
          <div className="absolute left-2 top-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(8,8,15,0.85)', border: '1px solid rgba(100,200,255,0.4)' }}>
            <div className="text-[10px] text-cyan-300 uppercase tracking-wider">Sing this note</div>
            <div className="text-2xl font-black text-white">{currentTarget}</div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="mt-3 flex gap-3">
        <button
          onClick={() => { fusionRef.current?.stop(); setPhase('menu') }}
          className="px-4 py-2 rounded-lg text-xs font-medium text-gray-400 border border-gray-700 hover:bg-gray-800 transition-all"
        >
          ← Menu
        </button>
        <button
          onClick={() => startGame(tutorialMode)}
          className="px-4 py-2 rounded-lg text-xs font-medium text-purple-300 border border-purple-700 hover:bg-purple-900/30 transition-all"
        >
          Restart
        </button>
      </div>
    </div>
  )
}
