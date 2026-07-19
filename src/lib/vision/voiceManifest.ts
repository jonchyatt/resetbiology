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
