'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useUser } from '@auth0/nextjs-auth0'

export const PITCH_SCORE_SYNC_META_KEY = 'pitch_score_sync_meta_v1'

export const PITCH_SCORE_STATIC_KEYS = [
  'pitch_fsrs_memory',
  'pitch_defender_progress',
  'pitch_drill_progress',
  'nt_v2_state',
  'lt_v1_state',
  'vt2_v1_state',
  'vt3_take_summaries_v1',
  'vt3_engraving_reports_v1',
  'pitch_custom_songs',
] as const

export const PITCH_SCORE_DYNAMIC_PREFIXES = ['pd_composed_'] as const

export interface PitchScoreEnvelope<T = unknown> {
  payload: T
  updatedAt: string
  serverUpdatedAt?: string
}

type PitchScoreMap = Record<string, PitchScoreEnvelope>
type MetaMap = Record<string, string>

let signedInSyncEnabled = false
const pendingPushes = new Map<string, ReturnType<typeof setTimeout>>()

function nowIso() {
  return new Date().toISOString()
}

function isValidDate(value: string | undefined): value is string {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()))
}

function parseJson(raw: string | null): unknown | undefined {
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

function readMeta(): MetaMap {
  if (typeof window === 'undefined') return {}
  const parsed = parseJson(window.localStorage.getItem(PITCH_SCORE_SYNC_META_KEY))
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as MetaMap
    : {}
}

function writeMeta(meta: MetaMap) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PITCH_SCORE_SYNC_META_KEY, JSON.stringify(meta))
  } catch {
    // localStorage is best-effort; gameplay must never block on sync metadata.
  }
}

function payloadTimestamp(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  for (const key of ['updatedAt', 'savedAt', 'publishedAt', 'createdAt']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && isValidDate(candidate)) return candidate
  }
  return null
}

function shouldSyncKey(key: string, keys: Set<string>, includeCompositions: boolean): boolean {
  if (keys.has(key)) return true
  return includeCompositions && PITCH_SCORE_DYNAMIC_PREFIXES.some(prefix => key.startsWith(prefix))
}

function readLocalEnvelope(key: string, meta: MetaMap): PitchScoreEnvelope | null {
  if (typeof window === 'undefined') return null
  const payload = parseJson(window.localStorage.getItem(key))
  if (payload === undefined) return null

  const updatedAt = isValidDate(meta[key])
    ? meta[key]
    : payloadTimestamp(payload) ?? nowIso()

  if (meta[key] !== updatedAt) {
    meta[key] = updatedAt
    writeMeta(meta)
  }

  return { payload, updatedAt }
}

function writeLocalEnvelope(key: string, envelope: PitchScoreEnvelope) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(envelope.payload))
    const meta = readMeta()
    meta[key] = envelope.updatedAt
    writeMeta(meta)
  } catch {
    // Offline/local play continues even if persistence is unavailable.
  }
}

function collectLocalScores(keys: Set<string>, includeCompositions: boolean): PitchScoreMap {
  if (typeof window === 'undefined') return {}

  const meta = readMeta()
  const out: PitchScoreMap = {}
  for (const key of keys) {
    const envelope = readLocalEnvelope(key, meta)
    if (envelope) out[key] = envelope
  }

  if (includeCompositions) {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !shouldSyncKey(key, keys, true)) continue
      const envelope = readLocalEnvelope(key, meta)
      if (envelope) out[key] = envelope
    }
  }

  return out
}

async function pushScore(key: string, envelope: PitchScoreEnvelope) {
  if (!signedInSyncEnabled) return

  try {
    const response = await fetch('/api/pitch-scores', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scores: [{
          gameKey: key,
          payload: envelope.payload,
          updatedAt: envelope.updatedAt,
        }],
      }),
    })

    if (response.status === 401) {
      signedInSyncEnabled = false
      return
    }

    if (!response.ok) {
      console.warn('[pitch-score-sync] push failed', response.status)
    }
  } catch (error) {
    console.warn('[pitch-score-sync] push failed', error)
  }
}

async function deleteScore(key: string) {
  if (!signedInSyncEnabled) return

  try {
    const response = await fetch('/api/pitch-scores', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameKey: key }),
    })

    if (response.status === 401) {
      signedInSyncEnabled = false
      return
    }

    if (!response.ok) {
      console.warn('[pitch-score-sync] delete failed', response.status)
    }
  } catch (error) {
    console.warn('[pitch-score-sync] delete failed', error)
  }
}

function queuePush(key: string, envelope: PitchScoreEnvelope, debounceMs = 800) {
  if (!signedInSyncEnabled) return

  const existing = pendingPushes.get(key)
  if (existing) clearTimeout(existing)
  pendingPushes.set(key, setTimeout(() => {
    pendingPushes.delete(key)
    void pushScore(key, envelope)
  }, debounceMs))
}

export function savePitchScore<T>(key: string, payload: T, options: { updatedAt?: string; debounceMs?: number } = {}) {
  const updatedAt = isValidDate(options.updatedAt) ? options.updatedAt : nowIso()
  const envelope: PitchScoreEnvelope<T> = { payload, updatedAt }
  writeLocalEnvelope(key, envelope)
  queuePush(key, envelope, options.debounceMs)
  return updatedAt
}

export function loadPitchScore<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const payload = parseJson(window.localStorage.getItem(key))
  return payload === undefined ? fallback : payload as T
}

export function removePitchScore(key: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
    const meta = readMeta()
    delete meta[key]
    writeMeta(meta)
    const pending = pendingPushes.get(key)
    if (pending) clearTimeout(pending)
    pendingPushes.delete(key)
    void deleteScore(key)
  } catch {
    // no-op
  }
}

export function usePitchScoreSync(options: {
  keys?: readonly string[]
  includeCompositions?: boolean
  onHydrate?: (scores: PitchScoreMap) => void
} = {}) {
  const { user, isLoading } = useUser()
  const onHydrateRef = useRef(options.onHydrate)
  onHydrateRef.current = options.onHydrate

  const keys = useMemo(
    () => new Set(options.keys ?? PITCH_SCORE_STATIC_KEYS),
    [options.keys],
  )
  const keySignature = useMemo(
    () => Array.from(keys).sort().join('|'),
    [keys],
  )
  const includeCompositions = options.includeCompositions ?? false
  const hydrationRunRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || isLoading) return

    if (!user) {
      signedInSyncEnabled = false
      return
    }

    signedInSyncEnabled = true
    const userKey = `${user.sub ?? user.email ?? 'auth0-user'}:${keySignature}:${includeCompositions}`
    if (hydrationRunRef.current === userKey) return
    hydrationRunRef.current = userKey

    let cancelled = false

    async function hydrate() {
      const localScores = collectLocalScores(keys, includeCompositions)

      try {
        const response = await fetch('/api/pitch-scores', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        })

        if (response.status === 401) {
          signedInSyncEnabled = false
          return
        }

        if (!response.ok) {
          console.warn('[pitch-score-sync] hydration failed', response.status)
          return
        }

        const body = await response.json() as { scores?: PitchScoreMap }
        const serverScores = body.scores ?? {}
        const hydrated: PitchScoreMap = {}
        const allKeys = new Set([
          ...Object.keys(localScores),
          ...Object.keys(serverScores).filter(key => shouldSyncKey(key, keys, includeCompositions)),
        ])

        for (const key of allKeys) {
          const local = localScores[key]
          const remote = serverScores[key]
          if (!remote && local) {
            queuePush(key, local, 0)
            continue
          }
          if (!remote) continue

          if (!local || new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime()) {
            writeLocalEnvelope(key, remote)
            hydrated[key] = remote
          } else if (new Date(local.updatedAt).getTime() > new Date(remote.updatedAt).getTime()) {
            queuePush(key, local, 0)
          }
        }

        if (!cancelled && Object.keys(hydrated).length > 0) {
          onHydrateRef.current?.(hydrated)
        }
      } catch (error) {
        console.warn('[pitch-score-sync] hydration failed', error)
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [isLoading, user, keySignature, includeCompositions, keys])
}
