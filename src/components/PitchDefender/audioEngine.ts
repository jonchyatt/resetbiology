// Pitch Defender — Audio Engine
// Rich layered SFX synthesis, background music, piano samples, ducking
// Replaces the simple oscillator beeps with multi-layer Web Audio synthesis

import { KEYBOARD_ORDER } from './types'

// ─── Singleton AudioContext + Routing ────────────────────────────────────────

let _ctx: AudioContext | null = null
let _master: GainNode | null = null
let _sfxBus: GainNode | null = null
let _musicBus: GainNode | null = null
let _pianoBus: GainNode | null = null
let _pianoCache: Map<string, AudioBuffer> = new Map()

// Music state
let _musicOscs: OscillatorNode[] = []
let _musicFilter: BiquadFilterNode | null = null
let _musicLfo: OscillatorNode | null = null
let _musicLfoGain: GainNode | null = null
let _musicPlaying = false
let _micActive = false
let _changeMusicTimer: ReturnType<typeof setTimeout> | null = null

function ctx(): AudioContext {
  if (!_ctx) {
    _ctx = new AudioContext()
    _master = _ctx.createGain()
    _master.gain.value = 1.0
    _master.connect(_ctx.destination)

    _sfxBus = _ctx.createGain()
    _sfxBus.gain.value = 0.8
    _sfxBus.connect(_master)

    // Piano bus sits between individual piano notes and the SFX bus so games
    // (SimplySing's backing track, Synthesia guide tones, etc.) can scale
    // piano loudness independently of the other SFX. Default 1.0 preserves
    // existing behavior for every caller that doesn't call setPianoVolume.
    _pianoBus = _ctx.createGain()
    _pianoBus.gain.value = 1.0
    _pianoBus.connect(_sfxBus)

    _musicBus = _ctx.createGain()
    _musicBus.gain.value = 0.12
    _musicBus.connect(_master)
  }
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function initAudio() {
  ctx()
}

export type SfxType =
  | 'correct' | 'wrong' | 'levelup' | 'damage' | 'explosion'
  | 'comboTick' | 'waveStart' | 'waveClear' | 'bossAppear'

export function playSfx(type: SfxType, options?: { combo?: number }) {
  try {
    const c = ctx()
    const now = c.currentTime
    const combo = options?.combo ?? 0

    switch (type) {
      case 'correct': sfxCorrect(c, now, combo); break
      case 'wrong': sfxWrong(c, now); break
      case 'levelup': sfxLevelUp(c, now); break
      case 'damage': sfxDamage(c, now); break
      case 'explosion': sfxExplosion(c, now); break
      case 'comboTick': sfxComboTick(c, now, combo); break
      case 'waveStart': sfxWaveStart(c, now); break
      case 'waveClear': sfxWaveClear(c, now); break
      case 'bossAppear': sfxBossAppear(c, now); break
    }
  } catch { /* Audio unavailable */ }
}

export async function loadPianoSamples(): Promise<void> {
  const c = ctx()
  await Promise.all((KEYBOARD_ORDER as readonly string[]).map(async (note) => {
    try {
      const resp = await fetch(`/sounds/nback/piano/${note}.wav`)
      const buf = await resp.arrayBuffer()
      const audio = await c.decodeAudioData(buf)
      _pianoCache.set(note, audio)
    } catch { /* Skip missing */ }
  }))
}

// Piano sample set covers C3-C5 only (15 notes, see KEYBOARD_ORDER in types.ts).
// When a caller requests a note outside this range (e.g. Simply Sing playing a
// composition with notes up in C6), fall back to the same note-class one octave
// down, then two octaves, until something plays or we give up. Users hear the
// right note class in a nearby octave instead of silence — way better UX for
// backing playback. Games that stay within the sample range never trigger this.
function findPianoBuffer(note: string): AudioBuffer | undefined {
  const direct = _pianoCache.get(note)
  if (direct) return direct
  const m = note.match(/^([A-G]#?)(\d+)$/)
  if (!m) return undefined
  const className = m[1]
  const octave = parseInt(m[2], 10)
  // Try same note class at lower and higher octaves, nearest first
  for (let delta = 1; delta <= 4; delta++) {
    for (const sign of [-1, 1]) {
      const tryNote = `${className}${octave + sign * delta}`
      const hit = _pianoCache.get(tryNote)
      if (hit) return hit
    }
  }
  return undefined
}

const SEMI_OF: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
function noteToMidi(note: string): number | null {
  const m = note.match(/^([A-G])(#?)(\d+)$/)
  if (!m) return null
  return 12 * (parseInt(m[3], 10) + 1) + SEMI_OF[m[1]] + (m[2] ? 1 : 0)
}

// Find nearest-by-semitones cached sample. Returns { buf, semitones } where
// semitones is the target-minus-source offset (positive = target is higher).
function findNearestBySemitones(note: string): { buf: AudioBuffer; semitones: number } | null {
  const targetMidi = noteToMidi(note)
  if (targetMidi === null) return null
  let best: { buf: AudioBuffer; semitones: number; abs: number } | null = null
  for (const [cacheName, cacheBuf] of _pianoCache.entries()) {
    const srcMidi = noteToMidi(cacheName)
    if (srcMidi === null) continue
    const diff = targetMidi - srcMidi
    const abs = Math.abs(diff)
    if (!best || abs < best.abs) best = { buf: cacheBuf, semitones: diff, abs }
  }
  return best ? { buf: best.buf, semitones: best.semitones } : null
}

interface PlayPianoOptions {
  // When true, play at the requested PITCH even if the exact sample is missing
  // (pitch-shift the nearest cached sample). When false (default), fall back to
  // the same note class in a nearby octave — wrong pitch but preserves piano
  // timbre. Tutor/training uses exact=true; SimplySing / backing playback uses
  // the default so octave overflow degrades gracefully.
  exact?: boolean
}

export function playPianoNote(note: string, options?: PlayPianoOptions) {
  try {
    if (!_pianoBus) return
    const c = ctx()
    let buf: AudioBuffer | undefined
    let playbackRate = 1
    const direct = _pianoCache.get(note)
    if (direct) {
      buf = direct
    } else if (options?.exact) {
      const near = findNearestBySemitones(note)
      if (!near) return
      buf = near.buf
      playbackRate = Math.pow(2, near.semitones / 12)
    } else {
      buf = findPianoBuffer(note)
    }
    if (!buf) return
    const src = c.createBufferSource()
    const gain = c.createGain()
    src.buffer = buf
    src.playbackRate.value = playbackRate
    src.connect(gain)
    gain.connect(_pianoBus)
    gain.gain.setValueAtTime(0.3, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.5)
    src.start()
    duckMusic(800)
    // Echo-suppression hint for pitch detectors:
    // Mark the global "tone is currently sounding" window so that microphone-fed
    // pitch detection can ignore the speaker bleed. Browser AEC handles most of
    // it, but cheap laptop speakers + no headphones still cause false positives.
    if (typeof window !== 'undefined') {
      ;(window as any).__pdLastToneAt = performance.now()
      ;(window as any).__pdToneSuppressMs = 350 // duration to suppress mic input
    }
  } catch { /* Audio unavailable */ }
}

// Piano bus volume control — used by backing-track games (SimplySing, etc.)
// to scale how loud the piano plunks are relative to other audio sources.
// pct: 0-200 (0% silent, 100% default, 200% double). Clamped to [0, 2].
export function setPianoVolume(pct: number) {
  if (!_pianoBus) ctx() // lazy init
  if (_pianoBus) {
    const v = Math.max(0, Math.min(2, pct / 100))
    _pianoBus.gain.setValueAtTime(v, _ctx!.currentTime)
  }
}

export function getPianoVolume(): number {
  if (!_pianoBus) return 100
  return Math.round(_pianoBus.gain.value * 100)
}

// Generic helper any system can call (e.g. ChoirPractice's playGuideNote) to
// announce "I just made noise; ignore mic input briefly" for echo suppression.
export function markToneEmitted(suppressMs = 350) {
  if (typeof window !== 'undefined') {
    ;(window as any).__pdLastToneAt = performance.now()
    ;(window as any).__pdToneSuppressMs = suppressMs
  }
}

// True if a tone was emitted recently and pitch input should be ignored.
export function isWithinToneSuppressionWindow(): boolean {
  if (typeof window === 'undefined') return false
  const last = (window as any).__pdLastToneAt as number | undefined
  const span = (window as any).__pdToneSuppressMs as number | undefined
  if (!last || !span) return false
  return performance.now() - last < span
}

// ─── Background Music ────────────────────────────────────────────────────────

const MUSIC_WORLDS: Record<string, { root: number; detune: number; filterFreq: number; lfoRate: number }> = {
  'Sound Scouts':       { root: 110,    detune: 0.5,  filterFreq: 400, lfoRate: 0.12 },
  'Frequency Fighters': { root: 130.81, detune: 0.7,  filterFreq: 500, lfoRate: 0.15 },
  'Echo Station':       { root: 146.83, detune: 0.4,  filterFreq: 350, lfoRate: 0.1  },
  'Harmonic Ridge':     { root: 98,     detune: 0.8,  filterFreq: 300, lfoRate: 0.18 },
  'The Frontier':       { root: 82.41,  detune: 1.0,  filterFreq: 250, lfoRate: 0.2  },
}

export function startMusic(worldName?: string) {
  if (_musicPlaying) stopMusic()

  const c = ctx()
  if (!_musicBus) return
  const config = MUSIC_WORLDS[worldName ?? 'Sound Scouts'] ?? MUSIC_WORLDS['Sound Scouts']

  // Lowpass filter → music bus
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = config.filterFreq
  filter.Q.value = 2
  filter.connect(_musicBus)
  _musicFilter = filter

  // LFO modulating filter cutoff for movement
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.type = 'sine'
  lfo.frequency.value = config.lfoRate
  lfoGain.gain.value = 150
  lfo.connect(lfoGain)
  lfoGain.connect(filter.frequency)
  lfo.start()
  _musicLfo = lfo
  _musicLfoGain = lfoGain

  // Two slightly detuned sine oscillators (creates shimmer/beating)
  const osc1 = c.createOscillator()
  osc1.type = 'sine'
  osc1.frequency.value = config.root
  osc1.connect(filter)
  osc1.start()

  const osc2 = c.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.value = config.root + config.detune
  osc2.connect(filter)
  osc2.start()

  // Sub oscillator (octave below, adds depth)
  const sub = c.createOscillator()
  const subGain = c.createGain()
  sub.type = 'sine'
  sub.frequency.value = config.root / 2
  subGain.gain.value = 0.3
  sub.connect(subGain)
  subGain.connect(filter)
  sub.start()

  _musicOscs = [osc1, osc2, sub]
  _musicPlaying = true

  // Fade in (stay muted if mic is active to prevent speaker→mic feedback)
  const targetGain = _micActive ? 0 : 0.12
  _musicBus.gain.setValueAtTime(0, c.currentTime)
  _musicBus.gain.linearRampToValueAtTime(targetGain, c.currentTime + 1.5)
}

export function stopMusic() {
  if (!_ctx || !_musicPlaying || !_musicBus) return

  const now = _ctx.currentTime
  _musicBus.gain.cancelScheduledValues(now)
  _musicBus.gain.setValueAtTime(_musicBus.gain.value, now)
  _musicBus.gain.linearRampToValueAtTime(0, now + 0.5)

  const oscsToStop = [..._musicOscs]
  const lfoToStop = _musicLfo
  const lfoGainToStop = _musicLfoGain

  _musicOscs = []
  _musicLfo = null
  _musicLfoGain = null
  _musicFilter = null
  _musicPlaying = false

  setTimeout(() => {
    oscsToStop.forEach(o => { try { o.stop(); o.disconnect() } catch {} })
    if (lfoToStop) { try { lfoToStop.stop(); lfoToStop.disconnect() } catch {} }
    if (lfoGainToStop) { try { lfoGainToStop.disconnect() } catch {} }
    if (_musicBus) _musicBus.gain.value = 0.12
  }, 600)
}

export function changeMusic(worldName: string) {
  if (_changeMusicTimer) { clearTimeout(_changeMusicTimer); _changeMusicTimer = null }
  if (!_musicPlaying) {
    startMusic(worldName)
    return
  }
  stopMusic()
  _changeMusicTimer = setTimeout(() => { _changeMusicTimer = null; startMusic(worldName) }, 700)
}

// Mute/unmute music when mic is active (prevents speaker→mic feedback in Echo Cannon)
export function setMicActive(active: boolean) {
  _micActive = active
  if (!_musicBus || !_ctx || !_musicPlaying) return
  const now = _ctx.currentTime
  _musicBus.gain.cancelScheduledValues(now)
  if (active) {
    _musicBus.gain.setValueAtTime(_musicBus.gain.value, now)
    _musicBus.gain.linearRampToValueAtTime(0, now + 0.1)
  } else {
    _musicBus.gain.setValueAtTime(_musicBus.gain.value, now)
    _musicBus.gain.linearRampToValueAtTime(0.12, now + 0.5)
  }
}

function duckMusic(durationMs: number) {
  if (!_musicBus || !_ctx || !_musicPlaying) return
  const now = _ctx.currentTime
  _musicBus.gain.cancelScheduledValues(now)
  _musicBus.gain.setValueAtTime(_musicBus.gain.value, now)
  _musicBus.gain.linearRampToValueAtTime(0.03, now + 0.05)
  _musicBus.gain.linearRampToValueAtTime(0.12, now + durationMs / 1000)
}

// ─── SFX: Correct Answer ────────────────────────────────────────────────────

function sfxCorrect(c: AudioContext, now: number, combo: number) {
  if (!_sfxBus) return
  const pitchMult = 1 + Math.min(combo, 20) * 0.02

  // Layer 1: Ascending chime
  const osc1 = c.createOscillator()
  const gain1 = c.createGain()
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(880 * pitchMult, now)
  osc1.frequency.exponentialRampToValueAtTime(1320 * pitchMult, now + 0.08)
  gain1.gain.setValueAtTime(0.12, now)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
  osc1.connect(gain1)
  gain1.connect(_sfxBus)
  osc1.start(now); osc1.stop(now + 0.16)

  // Layer 2: High shimmer (octave above, quieter)
  const osc2 = c.createOscillator()
  const gain2 = c.createGain()
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(1760 * pitchMult, now + 0.02)
  osc2.frequency.exponentialRampToValueAtTime(2200 * pitchMult, now + 0.1)
  gain2.gain.setValueAtTime(0.04, now + 0.02)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
  osc2.connect(gain2)
  gain2.connect(_sfxBus)
  osc2.start(now + 0.02); osc2.stop(now + 0.19)

  // Layer 3: Crisp noise burst (adds presence)
  const bufSize = Math.floor(c.sampleRate * 0.04)
  const buf = c.createBuffer(1, bufSize, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize)
  const noise = c.createBufferSource()
  noise.buffer = buf
  const nFilter = c.createBiquadFilter()
  nFilter.type = 'bandpass'
  nFilter.frequency.value = 4000 * pitchMult
  nFilter.Q.value = 1
  const nGain = c.createGain()
  nGain.gain.setValueAtTime(0.03, now)
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
  noise.connect(nFilter)
  nFilter.connect(nGain)
  nGain.connect(_sfxBus)
  noise.start(now); noise.stop(now + 0.07)

  duckMusic(200)
}

// ─── SFX: Wrong Answer ──────────────────────────────────────────────────────

function sfxWrong(c: AudioContext, now: number) {
  if (!_sfxBus) return

  // Layer 1: Low buzz with lowpass sweep
  const osc = c.createOscillator()
  const filter = c.createBiquadFilter()
  const gain = c.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.2)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(800, now)
  filter.frequency.exponentialRampToValueAtTime(200, now + 0.2)
  gain.gain.setValueAtTime(0.08, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(_sfxBus)
  osc.start(now); osc.stop(now + 0.26)

  // Layer 2: Static burst
  const bufSize = Math.floor(c.sampleRate * 0.08)
  const buf = c.createBuffer(1, bufSize, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5
  const noise = c.createBufferSource()
  noise.buffer = buf
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 600
  bp.Q.value = 2
  const nGain = c.createGain()
  nGain.gain.setValueAtTime(0.04, now)
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
  noise.connect(bp)
  bp.connect(nGain)
  nGain.connect(_sfxBus)
  noise.start(now); noise.stop(now + 0.11)
}

// ─── SFX: Explosion ─────────────────────────────────────────────────────────

function sfxExplosion(c: AudioContext, now: number) {
  if (!_sfxBus) return

  // Layer 1: Filtered noise sweep (main explosion body)
  const bufSize = Math.floor(c.sampleRate * 0.4)
  const buf = c.createBuffer(1, bufSize, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
  const noise = c.createBufferSource()
  noise.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(3000, now)
  filter.frequency.exponentialRampToValueAtTime(200, now + 0.3)
  filter.Q.value = 3
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.15, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
  noise.connect(filter)
  filter.connect(gain)
  gain.connect(_sfxBus)
  noise.start(now); noise.stop(now + 0.41)

  // Layer 2: Sub-bass thud
  const sub = c.createOscillator()
  const subGain = c.createGain()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(80, now)
  sub.frequency.exponentialRampToValueAtTime(30, now + 0.2)
  subGain.gain.setValueAtTime(0.15, now)
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
  sub.connect(subGain)
  subGain.connect(_sfxBus)
  sub.start(now); sub.stop(now + 0.31)

  // Layer 3: Metallic ping (cuts through the noise)
  const ping = c.createOscillator()
  const pingGain = c.createGain()
  ping.type = 'triangle'
  ping.frequency.setValueAtTime(2200, now)
  ping.frequency.exponentialRampToValueAtTime(800, now + 0.15)
  pingGain.gain.setValueAtTime(0.04, now)
  pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
  ping.connect(pingGain)
  pingGain.connect(_sfxBus)
  ping.start(now); ping.stop(now + 0.21)

  duckMusic(500)
}

// ─── SFX: Level Up ──────────────────────────────────────────────────────────

function sfxLevelUp(c: AudioContext, now: number) {
  if (!_sfxBus) return

  // Sequential ascending arpeggio: C5 → E5 → G5 → C6
  const notes = [523.25, 659.25, 783.99, 1046.5]
  const noteLen = 0.09

  notes.forEach((freq, i) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = now + i * noteLen
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.12, t + 0.01)
    gain.gain.setValueAtTime(0.12, t + noteLen * 0.6)
    gain.gain.exponentialRampToValueAtTime(0.001, t + noteLen + 0.1)
    osc.connect(gain)
    gain.connect(_sfxBus!)
    osc.start(t); osc.stop(t + noteLen + 0.11)
  })

  // Shimmer pad under the arpeggio
  const pad = c.createOscillator()
  const padGain = c.createGain()
  pad.type = 'sine'
  pad.frequency.value = 261.63
  padGain.gain.setValueAtTime(0, now)
  padGain.gain.linearRampToValueAtTime(0.05, now + 0.1)
  padGain.gain.setValueAtTime(0.05, now + 0.35)
  padGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
  pad.connect(padGain)
  padGain.connect(_sfxBus!)
  pad.start(now); pad.stop(now + 0.61)

  duckMusic(600)
}

// ─── SFX: Damage ────────────────────────────────────────────────────────────

function sfxDamage(c: AudioContext, now: number) {
  if (!_sfxBus) return

  // Heavy impact with soft-clipping distortion
  const osc = c.createOscillator()
  const gain = c.createGain()
  const dist = c.createWaveShaper()

  const curve = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1
    curve[i] = (Math.PI + 3) * x / (Math.PI + 3 * Math.abs(x))
  }
  dist.curve = curve
  dist.oversample = '2x'

  osc.type = 'square'
  osc.frequency.setValueAtTime(180, now)
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.3)
  gain.gain.setValueAtTime(0.06, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
  osc.connect(dist)
  dist.connect(gain)
  gain.connect(_sfxBus)
  osc.start(now); osc.stop(now + 0.36)

  // Impact noise burst
  const bufSize = Math.floor(c.sampleRate * 0.1)
  const buf = c.createBuffer(1, bufSize, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize)
  const noise = c.createBufferSource()
  noise.buffer = buf
  const nGain = c.createGain()
  nGain.gain.setValueAtTime(0.06, now)
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
  noise.connect(nGain)
  nGain.connect(_sfxBus)
  noise.start(now); noise.stop(now + 0.13)

  duckMusic(400)
}

// ─── SFX: Combo Tick ────────────────────────────────────────────────────────

function sfxComboTick(c: AudioContext, now: number, combo: number) {
  if (!_sfxBus) return
  const pitch = 1200 + Math.min(combo, 20) * 80
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'triangle'
  osc.frequency.value = pitch
  gain.gain.setValueAtTime(0.06, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
  osc.connect(gain)
  gain.connect(_sfxBus)
  osc.start(now); osc.stop(now + 0.06)
}

// ─── SFX: Wave Start ────────────────────────────────────────────────────────

function sfxWaveStart(c: AudioContext, now: number) {
  if (!_sfxBus) return

  // Upward noise sweep (woosh)
  const bufSize = Math.floor(c.sampleRate * 0.8)
  const buf = c.createBuffer(1, bufSize, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
  const noise = c.createBufferSource()
  noise.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(200, now)
  filter.frequency.exponentialRampToValueAtTime(4000, now + 0.6)
  filter.Q.value = 1
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.06, now + 0.2)
  gain.gain.setValueAtTime(0.06, now + 0.5)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
  noise.connect(filter)
  filter.connect(gain)
  gain.connect(_sfxBus)
  noise.start(now); noise.stop(now + 0.81)
}

// ─── SFX: Wave Clear ────────────────────────────────────────────────────────

function sfxWaveClear(c: AudioContext, now: number) {
  if (!_sfxBus) return

  // Triumphant major chord stab
  const freqs = [523.25, 659.25, 783.99, 1046.5]
  freqs.forEach(freq => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05)
    gain.gain.setValueAtTime(0.08, now + 0.3)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
    osc.connect(gain)
    gain.connect(_sfxBus!)
    osc.start(now); osc.stop(now + 0.81)
  })

  duckMusic(800)
}

// ─── SFX: Boss Appear ───────────────────────────────────────────────────────

function sfxBossAppear(c: AudioContext, now: number) {
  if (!_sfxBus) return

  // Deep ominous chord: low fifths with slow attack
  const freqs = [55, 82.41, 110]
  freqs.forEach(freq => {
    const osc = c.createOscillator()
    const filter = c.createBiquadFilter()
    const gain = c.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    filter.type = 'lowpass'
    filter.frequency.value = 400
    filter.Q.value = 3
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.06, now + 0.5)
    gain.gain.setValueAtTime(0.06, now + 1.0)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(_sfxBus!)
    osc.start(now); osc.stop(now + 1.81)
  })

  duckMusic(2000)
}
