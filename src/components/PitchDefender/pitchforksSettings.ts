export const PITCHFORKS_SETTINGS_KEY = 'pitchforks3_settings_v1'

export interface PitchforksSettingsSnapshot {
  readonly version: 1
  readonly noteNames: boolean
  readonly referenceAudio: boolean
  readonly speakerPlayback: boolean
  readonly cueDurationMs: number
  readonly referenceGainPct: number
  readonly microphoneGainPct: number
}

export interface PitchforksSettingsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const DEFAULT_PITCHFORKS_SETTINGS: PitchforksSettingsSnapshot = Object.freeze({
  version: 1,
  noteNames: true,
  referenceAudio: true,
  speakerPlayback: false,
  cueDurationMs: 600,
  referenceGainPct: 100,
  microphoneGainPct: 100,
})

function normalizeGainPercent(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(200, Math.round(value)))
    : 100
}

export function normalizePitchforksSettings(value: unknown): PitchforksSettingsSnapshot {
  const candidate = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}

  return Object.freeze({
    version: 1,
    noteNames: typeof candidate.noteNames === 'boolean'
      ? candidate.noteNames
      : DEFAULT_PITCHFORKS_SETTINGS.noteNames,
    referenceAudio: typeof candidate.referenceAudio === 'boolean'
      ? candidate.referenceAudio
      : DEFAULT_PITCHFORKS_SETTINGS.referenceAudio,
    speakerPlayback: typeof candidate.speakerPlayback === 'boolean'
      ? candidate.speakerPlayback
      : DEFAULT_PITCHFORKS_SETTINGS.speakerPlayback,
    cueDurationMs: typeof candidate.cueDurationMs === 'number' && Number.isFinite(candidate.cueDurationMs)
      ? Math.max(600, Math.min(2000, Math.round(candidate.cueDurationMs / 100) * 100))
      : DEFAULT_PITCHFORKS_SETTINGS.cueDurationMs,
    referenceGainPct: normalizeGainPercent(candidate.referenceGainPct),
    microphoneGainPct: normalizeGainPercent(candidate.microphoneGainPct),
  })
}

export function loadPitchforksSettings(storage: Pick<PitchforksSettingsStorage, 'getItem'>): PitchforksSettingsSnapshot {
  try {
    const raw = storage.getItem(PITCHFORKS_SETTINGS_KEY)
    return raw ? normalizePitchforksSettings(JSON.parse(raw)) : DEFAULT_PITCHFORKS_SETTINGS
  } catch {
    return DEFAULT_PITCHFORKS_SETTINGS
  }
}

export function savePitchforksSettings(
  storage: Pick<PitchforksSettingsStorage, 'setItem'>,
  settings: PitchforksSettingsSnapshot,
): boolean {
  try {
    storage.setItem(PITCHFORKS_SETTINGS_KEY, JSON.stringify(normalizePitchforksSettings(settings)))
    return true
  } catch {
    return false
  }
}
