/**
 * Manifest-backed lookup for the pre-rendered Fish Audio vision-educator
 * voice cues (T5). Fetched once, lazily, and memoized as an exact
 * text -> web-path map. SpeechQueue (audioKit.ts) is the only consumer.
 */

interface ManifestEntry {
  file: string
  text: string
}

let manifestPromise: Promise<Map<string, string>> | null = null
const preloadedAudio = new Map<string, HTMLAudioElement>()
const MAX_PRELOADED_CUES = 4

async function loadManifest(): Promise<Map<string, string>> {
  if (typeof window === 'undefined') return new Map()
  if (!manifestPromise) {
    manifestPromise = fetch('/audio/vision-cues/manifest.json')
      .then((res): Promise<Record<string, ManifestEntry>> => (res.ok ? res.json() : Promise.resolve({})))
      .then((raw) => {
        const map = new Map<string, string>()
        for (const entry of Object.values(raw)) {
          const basename = entry.file.split(/[\\/]/).pop()
          if (basename) map.set(entry.text, `/audio/vision-cues/${basename}`)
        }
        return map
      })
      .catch(() => new Map<string, string>())
  }
  return manifestPromise
}

/** Exact-text lookup. Returns the mp3 URL for a pre-rendered cue, or null
 * if this text wasn't rendered (caller falls back to speechSynthesis). */
export async function resolveVoiceCue(text: string): Promise<string | null> {
  const map = await loadManifest()
  return map.get(text) ?? null
}

/** Start buffering a small, known cue set while the session intro is visible.
 * This keeps the first exercise cue off the tap-critical path. */
export async function preloadVoiceCues(texts: readonly string[] = []): Promise<void> {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return
  const map = await loadManifest()
  for (const text of texts.slice(0, MAX_PRELOADED_CUES)) {
    const url = map.get(text)
    if (!url || preloadedAudio.has(url)) continue
    try {
      const audio = new Audio(url)
      audio.preload = 'auto'
      audio.load()
      preloadedAudio.set(url, audio)
    } catch {
      /* cue playback still falls back to a fresh element / speechSynthesis */
    }
  }
}

/** Consume one intro-warmed element so SpeechQueue can start it immediately. */
export function takePreloadedVoiceCue(url: string): HTMLAudioElement | null {
  const audio = preloadedAudio.get(url)
  if (!audio) return null
  preloadedAudio.delete(url)
  try {
    audio.currentTime = 0
  } catch {
    /* metadata may not have arrived yet; play() will continue loading it */
  }
  return audio
}
