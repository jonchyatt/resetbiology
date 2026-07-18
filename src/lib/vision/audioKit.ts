/**
 * Audio kit (W0.4) — voice, tones, metronome for vision engines.
 *  - SpeechQueue: TTS without overlapping utterances (v1 bug: cancel-and-clobber)
 *  - Metronome: WebAudio lookahead scheduler (drift-free, unlike setInterval)
 *  - playTone: short sine cue
 * Voice routing goes through here ONLY, so the RB voice stack (Kokoro/Polly
 * agents) can replace Web Speech later without touching any engine.
 * Plan: docs/plans/vision-training-interactive-overhaul.md §Tier 0
 */

import { resolveVoiceCue } from './voiceManifest'

let sharedCtx: AudioContext | null = null

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!sharedCtx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    sharedCtx = new AC()
  }
  return sharedCtx
}

// ponytail: standard silent-WAV iOS unlock trick — no new dependency, decoupled
// from the vision-cues asset set so it works even before the manifest loads.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
let assetAudioUnlocked = false

/** Call from a user-gesture handler (Start button) — unlocks iOS Safari audio
 * for both WebAudio (tones/metronome) and HTMLAudioElement (voice-cue mp3s). */
export function unlockAudio(): void {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') void ctx.resume()
  if (typeof window === 'undefined' || assetAudioUnlocked) return
  assetAudioUnlocked = true
  try {
    const el = new Audio(SILENT_WAV)
    el.muted = true
    void el.play().catch(() => {
      /* best-effort — asset cues fall back to speechSynthesis if never unlocked */
    })
  } catch {
    /* audio unavailable — engines must remain fully usable silent */
  }
}

export function playTone(frequency = 440, durationMs = 100, volume = 0.3): void {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    osc.type = 'sine'
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationMs / 1000)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + durationMs / 1000)
  } catch {
    /* audio unavailable — engines must remain fully usable silent */
  }
}

/** Session ritual signatures (consult 2 #3): recognizable arrival + victory motifs. */
export function playArrivalMotif(): void {
  playTone(392, 140, 0.2) // G4
  setTimeout(() => playTone(523, 220, 0.22), 160) // C5
}

export function playVictoryMotif(): void {
  playTone(523, 130, 0.25) // C5
  setTimeout(() => playTone(659, 130, 0.25), 150) // E5
  setTimeout(() => playTone(784, 320, 0.28), 300) // G5
}

// ---------------------------------------------------------------------------
// SpeechQueue
// ---------------------------------------------------------------------------

// One console.debug per unpronounced text, ever — not per occurrence.
const loggedManifestMisses = new Set<string>()

export class SpeechQueue {
  private queue: string[] = []
  private speaking = false
  private _muted = false
  /** Currently-playing pre-rendered cue, if any (T5 manifest-backed asset path). */
  private currentAudio: HTMLAudioElement | null = null
  /** Bumped on stop()/interrupt/mute-on so async continuations (manifest
   * resolve, play() promise, onended/onerror, fallback) that captured a
   * stale epoch at dispatch no-op instead of racing a since-invalidated cue. */
  private epoch = 0
  rate = 0.95
  pitch = 1.0
  volume = 0.85

  get muted(): boolean {
    return this._muted
  }

  /** Same public field contract as before — setting true also cancels an
   * in-flight asset cue immediately (mobile safety contract C3). */
  set muted(value: boolean) {
    this._muted = value
    if (value) {
      this.epoch++
      if (this.currentAudio) {
        this.stopCurrentAudio()
        this.speaking = false
        this.drain()
      }
    }
  }

  private get synth(): SpeechSynthesis | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
    return window.speechSynthesis
  }

  /**
   * Queue a phrase. `interrupt: true` drops anything pending/speaking first —
   * use for state changes ("Exercise complete"), not for rhythm cues.
   *
   * Resolution order per phrase: exact-text match against the pre-rendered
   * voice-cue manifest (T5) plays the mp3; a miss falls back to
   * speechSynthesis unchanged.
   */
  speak(text: string, opts?: { interrupt?: boolean }): void {
    const synth = this.synth
    if (!synth || this.muted || !text) return
    if (opts?.interrupt) {
      this.epoch++
      this.queue = []
      synth.cancel()
      this.stopCurrentAudio()
      this.speaking = false
    }
    this.queue.push(text)
    this.drain()
  }

  private drain(): void {
    if (this.speaking) return
    const next = this.queue.shift()
    if (!next) return
    this.speaking = true
    this.speakOne(next)
  }

  private speakOne(text: string): void {
    const epoch = this.epoch
    void resolveVoiceCue(text)
      .then((url) => {
        if (epoch !== this.epoch) return
        if (this.muted) {
          this.finishOne()
          return
        }
        if (url) {
          this.playAsset(text, url, epoch)
          return
        }
        if (!loggedManifestMisses.has(text)) {
          loggedManifestMisses.add(text)
          console.debug('[SpeechQueue] no pre-rendered cue, falling back to speechSynthesis:', text)
        }
        this.speakSynth(text, epoch)
      })
      .catch(() => {
        if (epoch !== this.epoch) return
        this.speakSynth(text, epoch)
      })
  }

  private playAsset(text: string, url: string, epoch: number): void {
    if (epoch !== this.epoch) return
    if (this.muted) {
      this.finishOne()
      return
    }
    const audio = new Audio(url)
    audio.volume = this.volume
    this.currentAudio = audio
    // once-guard: onerror + play().catch can both fire for one bad asset —
    // make sure only the first one triggers a fallback/finish.
    let settled = false
    const fallbackToSynth = () => {
      if (settled) return
      settled = true
      if (this.currentAudio === audio) this.currentAudio = null
      // Asset failure (missing file / decode error / blocked play) must
      // never block instructions — fall back to the existing TTS path.
      this.speakSynth(text, epoch)
    }
    audio.onended = () => {
      if (settled) return
      settled = true
      if (this.currentAudio === audio) this.currentAudio = null
      this.finishOne()
    }
    audio.onerror = fallbackToSynth
    audio.play().catch(fallbackToSynth)
  }

  private speakSynth(text: string, epoch: number): void {
    if (epoch !== this.epoch) return
    const synth = this.synth
    if (!synth || this.muted) {
      this.finishOne()
      return
    }
    const u = new SpeechSynthesisUtterance(text)
    u.rate = this.rate
    u.pitch = this.pitch
    u.volume = this.volume
    u.onend = u.onerror = () => {
      if (epoch !== this.epoch) return
      this.finishOne()
    }
    synth.speak(u)
  }

  private finishOne(): void {
    this.speaking = false
    this.drain()
  }

  private stopCurrentAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.onended = null
      this.currentAudio.onerror = null
      this.currentAudio.pause()
      this.currentAudio = null
    }
  }

  stop(): void {
    this.epoch++
    this.queue = []
    this.synth?.cancel()
    this.stopCurrentAudio()
    this.speaking = false
  }
}

// ---------------------------------------------------------------------------
// Metronome — lookahead scheduling per https://web.dev/audio-scheduling pattern
// ---------------------------------------------------------------------------

export type BeatCallback = (beatIndex: number, audioTime: number) => void

export class Metronome {
  private bpm: number
  private nextBeatTime = 0
  private beatIndex = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private onBeat: BeatCallback
  muted = false
  /** Alternate high/low click pitch (saccade left/right cueing) */
  alternate = true

  private static LOOKAHEAD_MS = 25
  private static SCHEDULE_AHEAD_S = 0.12

  constructor(bpm: number, onBeat: BeatCallback) {
    this.bpm = bpm
    this.onBeat = onBeat
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(20, Math.min(200, bpm))
  }

  getBpm(): number {
    return this.bpm
  }

  start(): void {
    const ctx = getAudioContext()
    if (this.timer) return
    this.beatIndex = 0
    this.nextBeatTime = (ctx?.currentTime ?? 0) + 0.2
    this.timer = setInterval(() => this.scheduler(), Metronome.LOOKAHEAD_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private scheduler(): void {
    const ctx = getAudioContext()
    const now = ctx?.currentTime ?? performance.now() / 1000
    while (this.nextBeatTime < now + Metronome.SCHEDULE_AHEAD_S) {
      this.fireBeat(this.beatIndex, this.nextBeatTime)
      this.nextBeatTime += 60 / this.bpm
      this.beatIndex++
    }
  }

  private fireBeat(index: number, audioTime: number): void {
    if (!this.muted) {
      playTone(this.alternate && index % 2 === 1 ? 550 : 440, 60, 0.25)
    }
    // Defer UI callback to roughly the audible moment
    const ctx = getAudioContext()
    const delayMs = ctx ? Math.max(0, (audioTime - ctx.currentTime) * 1000) : 0
    setTimeout(() => this.onBeat(index, audioTime), delayMs)
  }
}
