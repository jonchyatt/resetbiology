export const RETRO_PLACEMENT_EXTENSION_KEY = 'retroPlacement'

export const RETRO_PACES = ['cadet', 'pilot', 'ace', 'commander'] as const
export type RetroPace = typeof RETRO_PACES[number]
export type RetroPlacementLane = 'ear' | 'voice'
export type RetroPlacementSource = 'placement' | 'manual'

export interface RetroPlacementTrial {
  note: 'C4' | 'A4'
  firstAttemptCorrect: boolean
  latencyMs: number
}

export interface RetroPlacementSummary {
  version: 1
  pace: RetroPace
  source: RetroPlacementSource
  firstAttemptCorrect: number
  medianLatencyMs: number
  placedAtEpochMs: number
}

export interface RetroPlacementExtensionV1 {
  version: 1
  lanes: Partial<Record<RetroPlacementLane, RetroPlacementSummary>>
}

export interface RetroPaceConfig {
  responseWindowMs: number
  interAttackRestMs: number
  waveOneAlienCount: number
  waveOneMaxConcurrent: number
}

export const RETRO_PACE_CONFIG: Record<RetroPace, RetroPaceConfig> = {
  cadet: {
    responseWindowMs: 8000,
    interAttackRestMs: 2000,
    waveOneAlienCount: 1,
    waveOneMaxConcurrent: 1,
  },
  pilot: {
    responseWindowMs: 5500,
    interAttackRestMs: 1500,
    waveOneAlienCount: 2,
    waveOneMaxConcurrent: 1,
  },
  ace: {
    responseWindowMs: 3500,
    interAttackRestMs: 1200,
    waveOneAlienCount: 2,
    waveOneMaxConcurrent: 2,
  },
  commander: {
    responseWindowMs: 2400,
    interAttackRestMs: 900,
    waveOneAlienCount: 3,
    waveOneMaxConcurrent: 2,
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isRetroPace(value: unknown): value is RetroPace {
  return typeof value === 'string' && RETRO_PACES.includes(value as RetroPace)
}

function isPlacementSummary(value: unknown): value is RetroPlacementSummary {
  if (!isRecord(value)) return false
  return value.version === 1 &&
    isRetroPace(value.pace) &&
    (value.source === 'placement' || value.source === 'manual') &&
    Number.isInteger(value.firstAttemptCorrect) &&
    Number(value.firstAttemptCorrect) >= 0 && Number(value.firstAttemptCorrect) <= 4 &&
    Number.isFinite(value.medianLatencyMs) && Number(value.medianLatencyMs) >= 0 &&
    Number.isFinite(value.placedAtEpochMs) && Number(value.placedAtEpochMs) >= 0
}

export function parseRetroPlacementExtension(value: unknown): RetroPlacementExtensionV1 | null {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.lanes)) return null
  const lanes: Partial<Record<RetroPlacementLane, RetroPlacementSummary>> = {}
  for (const lane of ['ear', 'voice'] as const) {
    const summary = value.lanes[lane]
    if (summary === undefined) continue
    if (!isPlacementSummary(summary)) return null
    lanes[lane] = { ...summary }
  }
  return { version: 1, lanes }
}

export function placementForLane(
  extensionFields: Readonly<Record<string, unknown>>,
  lane: RetroPlacementLane,
): RetroPlacementSummary | null {
  return parseRetroPlacementExtension(extensionFields[RETRO_PLACEMENT_EXTENSION_KEY])?.lanes[lane] ?? null
}

function median(values: readonly number[]): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

export function placeRetroPace(
  trials: readonly RetroPlacementTrial[],
  placedAtEpochMs: number,
): RetroPlacementSummary {
  const bounded = trials.slice(0, 4)
  const firstAttemptCorrect = bounded.filter(trial => trial.firstAttemptCorrect).length
  const medianLatencyMs = median(bounded.map(trial => Math.max(0, trial.latencyMs)))
  let pace: RetroPace = 'cadet'
  if (bounded.length === 4 && firstAttemptCorrect === 4 && medianLatencyMs <= 1500) pace = 'commander'
  else if (bounded.length === 4 && firstAttemptCorrect === 4 && medianLatencyMs <= 2500) pace = 'ace'
  else if (bounded.length === 4 && firstAttemptCorrect >= 3 && medianLatencyMs <= 4500) pace = 'pilot'
  return {
    version: 1,
    pace,
    source: 'placement',
    firstAttemptCorrect,
    medianLatencyMs: Number.isFinite(medianLatencyMs) ? Math.round(medianLatencyMs) : 0,
    placedAtEpochMs: Math.max(0, Math.round(placedAtEpochMs)),
  }
}

export function manualRetroPlacement(pace: RetroPace, placedAtEpochMs: number): RetroPlacementSummary {
  return {
    version: 1,
    pace,
    source: 'manual',
    firstAttemptCorrect: 0,
    medianLatencyMs: 0,
    placedAtEpochMs: Math.max(0, Math.round(placedAtEpochMs)),
  }
}

export function placementExtensionPatch(
  extensionFields: Readonly<Record<string, unknown>>,
  lane: RetroPlacementLane,
  summary: RetroPlacementSummary,
): Record<string, unknown> {
  const raw = extensionFields[RETRO_PLACEMENT_EXTENSION_KEY]
  const existing = parseRetroPlacementExtension(raw)
  const patch: Record<string, unknown> = {
    [RETRO_PLACEMENT_EXTENSION_KEY]: {
      version: 1,
      lanes: {
        ...(existing?.lanes ?? {}),
        [lane]: { ...summary },
      },
    } satisfies RetroPlacementExtensionV1,
  }
  if (raw !== undefined && !existing && extensionFields.retroPlacementLegacy === undefined) {
    // ponytail: one recovery copy is enough; a future schema migrator can consume it.
    patch.retroPlacementLegacy = raw
  }
  return patch
}

export function hotterRetroPace(pace: RetroPace): RetroPace {
  const index = RETRO_PACES.indexOf(pace)
  return RETRO_PACES[Math.min(RETRO_PACES.length - 1, index + 1)]
}

export function gentlerRetroPace(pace: RetroPace): RetroPace {
  const index = RETRO_PACES.indexOf(pace)
  return RETRO_PACES[Math.max(0, index - 1)]
}

export function resolveRetroPlayPace(pace: RetroPace, difficulty: 'easy' | 'true'): RetroPace {
  return difficulty === 'true' ? hotterRetroPace(pace) : pace
}

export function retroPaceConfig(pace: RetroPace): RetroPaceConfig {
  return RETRO_PACE_CONFIG[pace]
}

export function retroMinimumDemandIntervalMs(pace: RetroPace): number {
  const config = retroPaceConfig(pace)
  return config.responseWindowMs + config.interAttackRestMs
}

export function retroRequiredApmCeiling(pace: RetroPace): number {
  return 60000 / retroMinimumDemandIntervalMs(pace)
}
