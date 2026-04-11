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
import { initAudio, playPianoNote, loadPianoSamples, setPianoVolume } from './audioEngine'
import { extractNotesFromXML, notesToSemitoneArray, type ExtractionResult } from './extractNotes'
import { extractMelodyFromComposition } from './composerExtract'

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
// Each note is [semitones, beats] — duration drives block height like real
// Synthesia. 1 = quarter, 2 = half, 4 = whole, 0.5 = eighth.

type SongNote = [number, number] // [semitones from C4, beats]

const SONGS: { name: string; notes: SongNote[]; description: string }[] = [
  {
    name: 'C Major Scale',
    notes: [[0,1],[2,1],[4,1],[5,1],[7,1],[9,1],[11,1],[12,2]],
    description: 'Start here — 8 notes, last is held',
  },
  {
    name: 'Twinkle Twinkle',
    notes: [[0,1],[0,1],[7,1],[7,1],[9,1],[9,1],[7,2],[5,1],[5,1],[4,1],[4,1],[2,1],[2,1],[0,2]],
    description: 'The classic — quarters + halves',
  },
  {
    name: 'Ode to Joy',
    notes: [[4,1],[4,1],[5,1],[7,1],[7,1],[5,1],[4,1],[2,1],[0,1],[0,1],[2,1],[4,1],[4,1.5],[2,0.5],[2,2]],
    description: 'Beethoven — mixed durations',
  },
  {
    name: 'Mary Had a Little Lamb',
    notes: [[4,1],[2,1],[0,1],[2,1],[4,1],[4,1],[4,2],[2,1],[2,1],[2,2],[4,1],[7,1],[7,2]],
    description: 'Quarters + halves',
  },
]

// Tutorial: 3 slow notes — generous half-note holds so beginners can settle in
const TUTORIAL_NOTES: SongNote[] = [[0,2],[4,2],[7,2]] // C4, E4, G4 — each held 2 beats

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
  matchFlash: number    // seconds remaining of post-hit glow
}

// Sparkle particle for correct-hit feedback (Synthesia-style)
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  hue: number
  size: number
}

// Per-key flash state — keyboard key lights up briefly when struck
interface KeyFlash {
  semitones: number
  remaining: number
  hue: number
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
  // Visual feedback for correct hits — Synthesia-style sparkle + key flash
  const particlesRef = useRef<Particle[]>([])
  const keyFlashesRef = useRef<KeyFlash[]>([])

  // Tunables (persisted via React state for UI control)
  const [phase, setPhase] = useState<Phase>('menu')
  const [selectedSong, setSelectedSong] = useState(0)
  const [speedMul, setSpeedMul] = useState(0.75) // 25/50/75/100/125/150 %
  const [practiceMode, setPracticeMode] = useState(true) // pause-on-correct
  const [tutorialMode, setTutorialMode] = useState(false)
  const [pianoVol, setPianoVol] = useState(100)  // 0-200 percent — plunk track volume

  // HUD display state (synced from refs)
  const [displayState, setDisplayState] = useState({ score: 0, hit: 0, total: 0 })
  const [currentTarget, setCurrentTarget] = useState<string>('')
  const [pitchHint, setPitchHint] = useState<'low' | 'on' | 'high' | null>(null)

  // Custom MusicXML songs
  const [customSongs, setCustomSongs] = useState<{ name: string; notes: SongNote[]; description: string }[]>([])
  const [loadingXML, setLoadingXML] = useState(false)
  const [xmlParts, setXmlParts] = useState<string[]>([])
  const [xmlResult, setXmlResult] = useState<ExtractionResult | null>(null)
  const [showPartPicker, setShowPartPicker] = useState(false)

  // Compositions saved from the Composer tool (read from localStorage).
  // Uses the shared composerExtract module so every consumer reads the same
  // way (handles both new measures format AND legacy flat-notes fallback).
  const [composedSongs, setComposedSongs] = useState<{ name: string; notes: SongNote[]; description: string }[]>([])
  useEffect(() => {
    const clampToKeyboard = (semi: number): number => {
      let v = semi
      while (v < KEYBOARD_LOW) v += 12
      while (v > KEYBOARD_HIGH) v -= 12
      return v
    }
    try {
      const out: { name: string; notes: SongNote[]; description: string }[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith('pd_composed_')) continue
        try {
          const comp = JSON.parse(localStorage.getItem(key) || '{}')
          const extracted = extractMelodyFromComposition(comp, { skipRests: true })
          if (extracted.length === 0) continue
          // Convert to Synthesia's [semi, beats] tuple shape with keyboard clamping
          const notes: SongNote[] = extracted.map(n => [clampToKeyboard(n.semi), n.beats])
          out.push({
            name: `★ ${comp.title || 'Untitled'}`,
            notes,
            description: `Composed · ${notes.length} notes`,
          })
        } catch {}
      }
      setComposedSongs(out)
    } catch {}
  }, [])

  const allSongs = [...SONGS, ...composedSongs, ...customSongs]

  // Tolerance for casual singing
  const TOLERANCE = 2.5 // semitones
  const BASE_FALL_SPEED = 90 // px/sec at 100% speed
  const HOLD_DURATION_MS = 280 // brief confirm hold (practice mode)
  // Flow mode: scoring window around the hit line + required in-tolerance time
  const FLOW_WINDOW_PX = 60     // bottom edge ±60 px around HIT_LINE_Y counts as "in window"
  const FLOW_HIT_MS = 180       // must be on pitch ≥180 ms while in window for credit

  // ─── MusicXML import ──────────────────────────────────────────────────────
  const addCustomSong = useCallback((result: ExtractionResult, partIdx: number) => {
    // Pull notes WITH durations (not stripping via notesToSemitoneArray)
    const partNotes = result.notes.filter(n => n.partIndex === partIdx && !n.isRest)
    if (partNotes.length === 0) return
    // Clamp pitch to keyboard range (C4..C6) and keep duration
    const clamped: SongNote[] = partNotes.map(n => {
      let v = n.semitones
      while (v < KEYBOARD_LOW) v += 12
      while (v > KEYBOARD_HIGH) v -= 12
      return [v, n.duration || 1] as SongNote
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
  // Block HEIGHT scales with note duration (1 beat ≈ 56 px). That's the
  // whole point of Synthesia — half notes are tall, eighths are short.
  // The gap between blocks is constant so the rhythm reads cleanly.
  const PIXELS_PER_BEAT = 56
  const MIN_BLOCK_H = 28
  const BLOCK_GAP = 18
  const buildBlocks = useCallback((notes: SongNote[]): FallingBlock[] => {
    const out: FallingBlock[] = []
    // Stagger blocks vertically above the canvas; first block enters first
    let cursorY = -40
    for (let i = 0; i < notes.length; i++) {
      const [semi, beats] = notes[i]
      const blockH = Math.max(MIN_BLOCK_H, beats * PIXELS_PER_BEAT)
      out.push({
        id: i,
        semitones: semi,
        name: semiToName(semi),
        duration: beats,
        y: cursorY - blockH, // top edge above canvas
        height: blockH,
        state: 'falling',
        matchProgress: 0,
        matchFlash: 0,
      })
      cursorY -= (blockH + BLOCK_GAP)
    }
    return out
  }, [])

  // ─── Sparkle / hit feedback helpers ───────────────────────────────────────
  // Synthesia-style: when a note is matched, burst particles + flash the key
  // + glow the block briefly. Hue inherits the block's color so each note has
  // its own visual signature.
  const spawnSparkles = useCallback((x: number, y: number, hue: number, count = 28) => {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2
      const sp = 60 + Math.random() * 240
      particlesRef.current.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 80, // upward bias
        life: 0,
        maxLife: 0.5 + Math.random() * 0.5,
        hue: hue + (Math.random() - 0.5) * 50,
        size: 2 + Math.random() * 3,
      })
    }
  }, [])

  const flashKey = useCallback((semitones: number, hue: number) => {
    keyFlashesRef.current.push({ semitones, remaining: 0.45, hue })
  }, [])

  const onBlockMatched = useCallback((b: FallingBlock) => {
    const colorInfo = NOTE_COLORS[b.name]
    const hue = colorInfo?.hue ?? (b.semitones * 30) % 360
    const whiteKeys = getWhiteKeys()
    const keyW = CANVAS_W / whiteKeys.length
    const keyIdx = whiteKeyIndexFor(b.semitones)
    const cx = (keyIdx >= 0 ? keyIdx * keyW + keyW / 2 : CANVAS_W / 2)
    const cy = b.y + b.height / 2
    spawnSparkles(cx, cy, hue, 32)
    spawnSparkles(cx, HIT_LINE_Y, hue, 18) // second burst at the hit line
    flashKey(b.semitones, hue)
    b.matchFlash = 0.45
  }, [spawnSparkles, flashKey])

  // ─── Start game ───────────────────────────────────────────────────────────
  const startGame = useCallback(async (useTutorial = false) => {
    initAudio()
    const noteList: SongNote[] = useTutorial ? TUTORIAL_NOTES : allSongs[selectedSong].notes
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

    // STARTER NOTE: play the first note(s) as a pitch reference before anything falls.
    // Without this the player has no anchor and is guessing the opening pitch cold.
    const firstBlock = blocks[0]
    if (firstBlock && !firstBlock.name.includes('#')) {
      setCurrentTarget(firstBlock.name)
      // Play the first note immediately so the player hears the starting pitch
      setTimeout(() => playPianoNote(firstBlock.name), 250)
      // Then play it again ~700ms later for reinforcement
      setTimeout(() => playPianoNote(firstBlock.name), 950)
    }

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

    // Detect waiting state (PRACTICE MODE only — pause the leader on the hit line)
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

    // FLOW MODE: as soon as the current block's bottom enters the scoring
    // window, expose it as the live target so the player has something to
    // sing toward. The block keeps falling — no pause.
    if (currentBlock && !practiceRef.current && currentBlock.state === 'falling') {
      const blockBottom = currentBlock.y + currentBlock.height
      if (blockBottom >= HIT_LINE_Y - FLOW_WINDOW_PX) {
        setCurrentTarget(currentBlock.name)
      }
    }

    if (currentBlock?.state === 'waiting') paused = true

    // Move falling blocks (only if not paused on the leader)
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      if (b.state === 'cleared' || b.state === 'matched') continue
      if (b.state === 'waiting') continue

      // Followers stop above the waiting block (preserve constant gap)
      if (paused && i > currentIdx) {
        const ahead = blocks[i - 1]
        const desiredTop = ahead.y - BLOCK_GAP - b.height
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
          onBlockMatched(currentBlock)
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

    // ── FLOW MODE: continuous scoring as blocks cross the hit window ──
    // The block's BOTTOM edge enters the window (HIT_LINE_Y ± FLOW_WINDOW_PX).
    // While inside, accumulate in-tolerance time on matchProgress. Once the
    // block leaves the window (bottom past HIT_LINE_Y + FLOW_WINDOW_PX), score
    // it: hit if matchProgress meets FLOW_HIT_MS, else miss.
    if (!practiceRef.current && currentBlock && currentBlock.state === 'falling') {
      const blockBottom = currentBlock.y + currentBlock.height
      const inWindow = blockBottom >= HIT_LINE_Y - FLOW_WINDOW_PX &&
                       blockBottom <= HIT_LINE_Y + FLOW_WINDOW_PX
      const pastWindow = blockBottom > HIT_LINE_Y + FLOW_WINDOW_PX

      if (inWindow) {
        // Live pitch evaluation while crossing the line
        if (pitch?.isActive) {
          const deviation = pitch.staffPosition - currentBlock.semitones
          const absDev = Math.abs(deviation)
          if (absDev <= TOLERANCE) {
            currentBlock.matchProgress += dt * 1000
            setPitchHint('on')
          } else {
            setPitchHint(deviation < 0 ? 'low' : 'high')
          }
        } else {
          setPitchHint(null)
        }
      } else if (pastWindow) {
        // Score the block now — too late to get more credit
        const hitThreshold = FLOW_HIT_MS
        const wasHit = currentBlock.matchProgress >= hitThreshold
        if (wasHit) {
          currentBlock.state = 'matched'
          onBlockMatched(currentBlock)
          notesHitRef.current++
          // Score scales with how cleanly the note was held
          const cleanness = Math.min(1, currentBlock.matchProgress / (hitThreshold * 2))
          scoreRef.current += Math.round(60 + 40 * cleanness)
          setTimeout(() => { currentBlock.state = 'cleared' }, 250)
        } else {
          currentBlock.state = 'cleared'
        }
        setDisplayState({
          score: scoreRef.current,
          hit: notesHitRef.current,
          total: totalNotesRef.current,
        })
        currentIdxRef.current++
        setCurrentTarget('')
        setPitchHint(null)
        if (currentIdxRef.current >= blocks.length) {
          setPhase('complete')
          fusionRef.current?.stop()
          return
        }
      }
    }

    // Safety net: any falling block that drops off the bottom is cleared
    // (covers non-current blocks if anything ever gets out of order)
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

    // ── Update sparkles + per-key flashes (Synthesia-style hit feedback) ──
    const ps = particlesRef.current
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.life += dt
      if (p.life >= p.maxLife) { ps.splice(i, 1); continue }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 520 * dt // gravity
    }
    const kf = keyFlashesRef.current
    for (let i = kf.length - 1; i >= 0; i--) {
      kf[i].remaining -= dt
      if (kf[i].remaining <= 0) kf.splice(i, 1)
    }
    // Decay each block's matched-glow timer
    for (const b of blocks) {
      if (b.matchFlash > 0) b.matchFlash = Math.max(0, b.matchFlash - dt)
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

  // Push plunk track volume into the shared audio engine piano bus.
  useEffect(() => { setPianoVolume(pianoVol) }, [pianoVol])

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

    // Hit line (dim, full width — still useful as a visual reference for the
    // overall "this is where blocks land" plane)
    ctx.strokeStyle = 'rgba(100,200,255,0.18)'
    ctx.lineWidth = 1
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(0, HIT_LINE_Y)
    ctx.lineTo(CANVAS_W, HIT_LINE_Y)
    ctx.stroke()
    ctx.setLineDash([])

    // ── Key-aligned target column ─────────────────────────────────────────
    // Jon 2026-04-09: "the green target zone should match the key in
    // location that we are aiming for... hard to think you are doing it
    // correctly when the target is a different direction than the note
    // you are going for." Replaced the full-width green band with a
    // narrow column aligned to the active block's key. The column slides
    // horizontally as the active note changes, so the singer aims their
    // voice at the literal key below. See
    // memory/feedback/feedback_feedback_must_be_spatially_co_located_with_target.md
    const activeBlock = blocks[currentIdx]
    if (activeBlock && activeBlock.state !== 'cleared') {
      const targetKeyIdx = whiteKeyIndexFor(activeBlock.semitones)
      if (targetKeyIdx >= 0) {
        const targetX = targetKeyIdx * keyW
        const colorInfo = NOTE_COLORS[activeBlock.name]
        const hue = colorInfo?.hue ?? 140
        // Vertical column from hit-line zone down to the keyboard top
        ctx.fillStyle = `hsla(${hue}, 80%, 55%, 0.12)`
        ctx.fillRect(targetX, HIT_LINE_Y - FLOW_WINDOW_PX, keyW, FALL_AREA_H - (HIT_LINE_Y - FLOW_WINDOW_PX))
        // Scoring window (more opaque, narrower vertical range — the hit zone itself)
        ctx.fillStyle = `hsla(${hue}, 85%, 60%, 0.22)`
        ctx.fillRect(targetX, HIT_LINE_Y - FLOW_WINDOW_PX, keyW, FLOW_WINDOW_PX * 2)
        // Left and right column borders — cleaner vertical lines
        ctx.strokeStyle = `hsla(${hue}, 90%, 65%, 0.6)`
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(targetX, HIT_LINE_Y - FLOW_WINDOW_PX)
        ctx.lineTo(targetX, HIT_LINE_Y + FLOW_WINDOW_PX)
        ctx.moveTo(targetX + keyW, HIT_LINE_Y - FLOW_WINDOW_PX)
        ctx.lineTo(targetX + keyW, HIT_LINE_Y + FLOW_WINDOW_PX)
        ctx.stroke()
        ctx.setLineDash([])
        // Crosshair line at exact hit line, within the column only
        ctx.strokeStyle = `hsla(${hue}, 95%, 75%, 0.9)`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(targetX + 2, HIT_LINE_Y)
        ctx.lineTo(targetX + keyW - 2, HIT_LINE_Y)
        ctx.stroke()
        // Glowing arrow pointing down at the key (removes "which key?" ambiguity)
        ctx.fillStyle = `hsla(${hue}, 95%, 75%, 0.85)`
        ctx.beginPath()
        ctx.moveTo(targetX + keyW / 2, FALL_AREA_H - 4)
        ctx.lineTo(targetX + keyW / 2 - 8, FALL_AREA_H - 14)
        ctx.lineTo(targetX + keyW / 2 + 8, FALL_AREA_H - 14)
        ctx.closePath()
        ctx.fill()
      }
    }

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

      // BIG correct-hit glow burst (Synthesia-style success feedback)
      if (b.matchFlash > 0) {
        const t = b.matchFlash / 0.45
        const ringR = (1 - t) * 60 + 10
        ctx.save()
        ctx.globalAlpha = t * 0.9
        ctx.strokeStyle = `hsla(${hue}, 100%, 75%, 1)`
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(blockX + w / 2, b.y + b.height / 2, ringR, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = `hsla(60, 100%, 90%, ${t * 0.8})`
        ctx.fillRect(blockX - 4, b.y - 4, w + 8, b.height + 8)
        ctx.restore()
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

    // Sparkle particles (drawn on top of blocks, below the UI bar)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const p of particlesRef.current) {
      const a = 1 - (p.life / p.maxLife)
      ctx.fillStyle = `hsla(${p.hue}, 100%, 72%, ${a})`
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      // small white core for the brightest sparkles
      if (p.size > 3) {
        ctx.fillStyle = `rgba(255,255,255,${a * 0.9})`
        ctx.fillRect(p.x - 0.5, p.y - 0.5, 1, 1)
      }
    }
    ctx.restore()

    // Pitch measurement bar (horizontal, sits just above the keyboard)
    drawPitchBar(ctx, pitch, blocks[currentIdx])

    // Keyboard at bottom (passes flashes so struck keys glow)
    drawKeyboard(ctx, whiteKeys, keyW, blocks[currentIdx])
  }, [])

  // ─── Pitch bar (Pitchforks-style horizontal indicator) ───────────────────
  const drawPitchBar = (
    ctx: CanvasRenderingContext2D,
    pitch: FusedPitch | null,
    currentBlock?: FallingBlock,
  ) => {
    const barH = 22
    const margin = 16
    const barY = FALL_AREA_H - barH - 6
    const barX = margin
    const barW = CANVAS_W - margin * 2

    // Background panel
    ctx.fillStyle = 'rgba(8,8,15,0.85)'
    ctx.fillRect(barX - 2, barY - 14, barW + 4, barH + 18)
    ctx.strokeStyle = 'rgba(100,200,255,0.35)'
    ctx.lineWidth = 1
    ctx.strokeRect(barX - 2, barY - 14, barW + 4, barH + 18)

    // Bar track
    ctx.fillStyle = 'rgba(20,20,40,0.9)'
    ctx.fillRect(barX, barY, barW, barH)
    ctx.strokeStyle = 'rgba(80,80,120,0.6)'
    ctx.strokeRect(barX, barY, barW, barH)

    // Center "target" zone
    const centerX = barX + barW / 2
    ctx.fillStyle = 'rgba(74,222,128,0.20)'
    ctx.fillRect(centerX - 28, barY, 56, barH)
    ctx.strokeStyle = 'rgba(74,222,128,0.6)'
    ctx.beginPath()
    ctx.moveTo(centerX, barY)
    ctx.lineTo(centerX, barY + barH)
    ctx.stroke()

    // Title text above bar
    ctx.fillStyle = '#9ca3af'
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('YOUR PITCH', barX, barY - 3)

    if (currentBlock) {
      const targetName = currentBlock.name
      ctx.fillStyle = '#86efac'
      ctx.textAlign = 'right'
      ctx.fillText(`target: ${targetName}`, barX + barW, barY - 3)
    }

    // Pitch indicator dot
    if (pitch?.isActive && currentBlock) {
      // Octave-flexible deviation in semitones
      const sungSemi = pitch.staffPosition
      const targetSemi = currentBlock.semitones
      const tMod = ((targetSemi % 12) + 12) % 12
      const sMod = ((Math.round(sungSemi) % 12) + 12) % 12
      const rawDiff = Math.abs(tMod - sMod)
      const pcDiff = Math.min(rawDiff, 12 - rawDiff)
      const rawDev = sungSemi - targetSemi
      // Use signed direction from raw, magnitude from pcDiff for the dot position
      const sign = rawDev === 0 ? 0 : Math.sign(rawDev)
      const magnitude = Math.min(pcDiff, Math.abs(rawDev))
      const clampedDev = Math.max(-6, Math.min(6, sign * magnitude))
      const dotX = centerX + (clampedDev / 6) * (barW / 2 - 8)
      const onTarget = magnitude <= TOLERANCE

      // Glow when on target
      if (onTarget) {
        ctx.fillStyle = 'rgba(74,222,128,0.35)'
        ctx.beginPath()
        ctx.arc(dotX, barY + barH / 2, 14, 0, Math.PI * 2)
        ctx.fill()
      }

      // Dot
      ctx.fillStyle = onTarget ? '#4ade80' : '#f87171'
      ctx.beginPath()
      ctx.arc(dotX, barY + barH / 2, 7, 0, Math.PI * 2)
      ctx.fill()

      // Sung-note label below dot
      ctx.fillStyle = onTarget ? '#86efac' : '#fca5a5'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(pitch.note || '', dotX, barY + barH + 11)
    } else {
      ctx.fillStyle = '#6b7280'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('sing...', centerX, barY + barH / 2 + 3)
    }
  }

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

      // Per-key correct-hit flash (Synthesia-style: struck key glows briefly)
      const flash = keyFlashesRef.current.find(f => f.semitones === semi)
      const flashAmt = flash ? flash.remaining / 0.45 : 0

      // Key body
      if (flashAmt > 0) {
        ctx.fillStyle = `hsla(${flash!.hue}, 100%, ${65 + flashAmt * 25}%, 1)`
      } else if (isTarget) {
        ctx.fillStyle = 'rgba(100,200,255,0.85)'
      } else {
        ctx.fillStyle = '#f4f4f8'
      }
      ctx.fillRect(x + 1, keyboardY + 4, keyW - 2, KEYBOARD_H - 8)
      // Glow halo above the flashed key
      if (flashAmt > 0) {
        ctx.save()
        ctx.globalAlpha = flashAmt * 0.6
        ctx.fillStyle = `hsla(${flash!.hue}, 100%, 80%, 1)`
        ctx.fillRect(x - 4, keyboardY - 12, keyW + 8, 16)
        ctx.restore()
      }

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
      const flash = keyFlashesRef.current.find(f => f.semitones === blackSemi)
      const flashAmt = flash ? flash.remaining / 0.45 : 0

      if (flashAmt > 0) {
        ctx.fillStyle = `hsla(${flash!.hue}, 100%, ${50 + flashAmt * 30}%, 1)`
      } else if (isTarget) {
        ctx.fillStyle = 'rgba(100,200,255,0.95)'
      } else {
        ctx.fillStyle = '#0a0a14'
      }
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

  // ─── Preload piano samples on mount ───────────────────────────────────────
  // Required for playPianoNote to make sound — without this, tapping a key
  // is silent because the sample cache is empty.
  useEffect(() => {
    initAudio()
    loadPianoSamples().catch(err => console.error('Piano sample load failed:', err))
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
                <option value="/musicxml/barnby-crossing-the-bar-satb.musicxml">Crossing the Bar (SATB)</option>
                <option value="/musicxml/amazing-grace-hymn.xml">Amazing Grace</option>
              </select>
            </div>
            {loadingXML && <div className="text-xs text-indigo-400 mt-1 animate-pulse">Parsing score...</div>}
            <div className="text-[10px] text-gray-600 mt-2 text-center">
              ★ Songs you save in <a href="/pitch-defender/composer" className="text-indigo-400 hover:text-indigo-300">Composer</a> appear above automatically
            </div>
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
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Plunk</span>
            <input
              type="range"
              min="0"
              max="200"
              step="1"
              value={pianoVol}
              onChange={e => setPianoVol(parseInt(e.target.value))}
              className="w-20 accent-purple-500"
            />
            <span className="text-xs text-cyan-300 font-mono w-9">{pianoVol}%</span>
          </label>
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

        {/* Tap hint banner — moved to top-right of canvas so it never overlaps
            the pitch bar / vocal target feedback that lives above the keyboard. */}
        <div className="absolute right-2 top-2 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider"
          style={{
            background: 'rgba(8,8,15,0.85)',
            border: '1px solid rgba(100,200,255,0.4)',
            color: '#7dd3fc',
            pointerEvents: 'none',
          }}>
          TAP A KEY TO HEAR IT
        </div>

        {/* Old vertical right-side hint bar removed — replaced by canvas-drawn
            horizontal pitch bar (Pitchforks-style). See drawPitchBar above. */}

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
